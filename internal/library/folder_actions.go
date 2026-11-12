package library

import (
	"errors"
	"io"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const folderPrefix = "folder:"

func (l *Library) Entry(root, id string, tokens ...string) (Item, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if strings.HasPrefix(id, folderPrefix) && root != l.state.Root {
		return Item{}, os.ErrNotExist
	}
	return l.entry(id, tokens)
}

func (l *Library) entry(id string, tokens []string) (Item, error) {
	if strings.HasPrefix(id, folderPrefix) {
		return l.folderItem(id, tokens)
	}
	return l.item(id, tokens)
}

func (l *Library) folderItem(id string, tokens []string) (Item, error) {
	rel, ok := strings.CutPrefix(id, folderPrefix)
	if !ok {
		return Item{}, os.ErrNotExist
	}
	folder, ok := l.folders[rel]
	private := len(tokens) > 0 && l.vaultAuthorized(tokens[0])
	if !ok || (!l.folderVisible(rel, false) && !(private && l.folderVisible(rel, true))) {
		return Item{}, os.ErrNotExist
	}
	folder.Path = filepath.Join(l.state.Root, filepath.FromSlash(rel))
	folder.Tags = l.marks[folderMarkID(folder.Path)].Tags
	return folder, nil
}

func folderMarkID(path string) string { return folderPrefix + pathID(path) }

func validEntryName(name string) bool {
	return strings.TrimSpace(name) != "" && !strings.HasPrefix(name, ".") && !strings.ContainsAny(name, "/\\\x00\r\n")
}

func (l *Library) editableRoot(root string) bool {
	return root != "" && root == l.state.Root && !l.state.Scanning
}

func checkEntry(path string, directory bool) error {
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		return err
	}
	if resolved != path {
		return os.ErrNotExist
	}
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if (directory && !info.IsDir()) || (!directory && !info.Mode().IsRegular()) {
		return os.ErrNotExist
	}
	return nil
}

func (l *Library) folderPath(id string, tokens []string) (string, error) {
	if id == "" {
		return l.state.Root, nil
	}
	item, err := l.folderItem(id, tokens)
	return item.Path, err
}

func (l *Library) CreateFolder(root, parent, name string, tokens ...string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if !l.editableRoot(root) {
		return errors.New("目录已变化，请重试")
	}
	if !validEntryName(name) {
		return errors.New("文件名无效")
	}
	path, err := l.folderPath(parent, tokens)
	if err != nil {
		return err
	}
	if err = checkEntry(path, true); err != nil {
		return err
	}
	target := filepath.Join(path, name)
	if owner := l.privateOwner(target); owner != "" && owner != l.privateOwner(path) {
		return errors.New("目标文件名已存在")
	}
	if err = os.Mkdir(target, 0755); err != nil {
		return err
	}
	rel, _ := filepath.Rel(root, target)
	l.folders[filepath.ToSlash(rel)] = l.catalogFolder(target)
	l.catalogChanged()
	return nil
}

func (l *Library) catalogFolder(path string) Item {
	rel, _ := filepath.Rel(l.state.Root, path)
	parent := filepath.ToSlash(filepath.Dir(rel))
	if parent == "." {
		parent = ""
	}
	modified := int64(0)
	if info, err := os.Stat(path); err == nil {
		modified = info.ModTime().UnixMilli()
	}
	return Item{ID: folderPrefix + filepath.ToSlash(rel), Name: filepath.Base(path), Folder: parent, Directory: true, Kind: "folder", Modified: modified}
}

type EntryRef struct {
	ID             string
	Size, Modified int64
}

type relocation struct {
	item   Item
	target string
}

func (l *Library) MoveEntries(root, destination string, refs []EntryRef, tokens ...string) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if !l.editableRoot(root) {
		return 0, errors.New("目录已变化，请重试")
	}
	if len(refs) == 0 || len(refs) > 200 {
		return 0, errors.New("每次请选择 1–200 个资源")
	}
	dest, err := l.folderPath(destination, tokens)
	if err != nil {
		return 0, err
	}
	if err = checkEntry(dest, true); err != nil {
		return 0, err
	}
	entries := make([]relocation, 0, len(refs))
	targets := map[string]bool{}
	sources := map[string]bool{}
	for _, ref := range refs {
		item, err := l.entry(ref.ID, tokens)
		if err != nil {
			return 0, err
		}
		if !item.Directory {
			if err = validateFile(item, ref.Size, ref.Modified); err != nil {
				return 0, err
			}
		}
		if filepath.Dir(item.Path) == dest {
			continue
		}
		target := filepath.Join(dest, item.Name)
		if targets[target] || sources[item.Path] {
			return 0, errors.New("目标文件名已存在")
		}
		sources[item.Path], targets[target] = true, true
		entries = append(entries, relocation{item, target})
	}
	return l.relocate(entries)
}

func (l *Library) RenameFolder(root, id, name string, tokens ...string) (Item, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if !l.editableRoot(root) {
		return Item{}, errors.New("目录已变化，请重试")
	}
	if !validEntryName(name) {
		return Item{}, errors.New("文件名无效")
	}
	item, err := l.folderItem(id, tokens)
	if err != nil || item.Name == name {
		return item, err
	}
	target := filepath.Join(filepath.Dir(item.Path), name)
	if _, err = l.relocate([]relocation{{item, target}}); err != nil {
		return Item{}, err
	}
	rel, _ := filepath.Rel(root, target)
	return l.folderItem(folderPrefix+filepath.ToSlash(rel), tokens)
}

func containsPath(parent, path string) bool {
	return path == parent || strings.HasPrefix(path, parent+string(filepath.Separator))
}

func (l *Library) relocate(entries []relocation) (int, error) {
	for _, entry := range entries {
		src, dst := entry.item.Path, entry.target
		if l.isMetadata(dst) {
			return 0, errors.New("不能移动应用数据目录")
		}
		if containsPath(src, dst) {
			return 0, errors.New("不能将文件夹移到自身或子文件夹")
		}
		if err := checkEntry(src, entry.item.Directory); err != nil {
			return 0, err
		}
		if err := checkEntry(filepath.Dir(dst), true); err != nil {
			return 0, err
		}
		if targetInfo, err := os.Lstat(dst); err == nil {
			sourceInfo, sourceErr := os.Lstat(src)
			caseOnlyRename := filepath.Dir(src) == filepath.Dir(dst) && strings.EqualFold(filepath.Base(src), filepath.Base(dst)) && sourceErr == nil && os.SameFile(sourceInfo, targetInfo)
			if !caseOnlyRename {
				return 0, errors.New("目标文件名已存在")
			}
		} else if !os.IsNotExist(err) {
			return 0, err
		}
		if l.privateOwner(src) != "" || l.privateOwner(dst) != "" {
			return 0, errors.New("暂不支持移动或重命名受私密保护的文件夹或移动私密文件")
		}
		if entry.item.Directory {
			if containsPath(src, l.dataDir) {
				return 0, errors.New("不能移动应用数据目录")
			}
			for protected := range l.vault.owners {
				if containsPath(src, protected) || containsPath(dst, protected) {
					return 0, errors.New("暂不支持移动或重命名受私密保护的文件夹或移动私密文件")
				}
			}
			for _, other := range entries {
				if other.item.Path != src && containsPath(src, other.item.Path) {
					return 0, errors.New("不能同时移动文件夹和其中的资源")
				}
			}
		}
	}
	count := 0
	defer func() {
		if count > 0 {
			l.catalogChanged()
		}
	}()
	for _, entry := range entries {
		src, dst := entry.item.Path, entry.target
		marks := maps.Clone(l.marks)
		rekey := func(oldID, newID string) {
			delete(marks, newID)
			if mark, ok := marks[oldID]; ok {
				marks[newID] = mark
				delete(marks, oldID)
			}
		}
		if !entry.item.Directory {
			rekey(entry.item.ID, pathID(dst))
		} else {
			for _, item := range l.items {
				if item.Path != src && containsPath(src, item.Path) {
					rekey(item.ID, pathID(dst+strings.TrimPrefix(item.Path, src)))
				}
			}
			for rel := range l.folders {
				path := filepath.Join(l.state.Root, rel)
				if containsPath(src, path) {
					rekey(folderMarkID(path), folderMarkID(dst+strings.TrimPrefix(path, src)))
				}
			}
		}
		changed := !maps.Equal(marks, l.marks)
		if changed {
			if err := l.saveMarks(marks); err != nil {
				return count, err
			}
		}
		if err := renameFileExclusive(src, dst); err != nil {
			if changed {
				err = errors.Join(err, l.saveMarks(l.marks))
			}
			return count, err
		}
		l.marks = marks
		count++
		updateFile := func(i int, item Item) {
			item.Path = dst + strings.TrimPrefix(item.Path, src)
			item.ID = pathID(item.Path)
			rel, _ := filepath.Rel(l.state.Root, item.Path)
			item.Group, _, _ = strings.Cut(filepath.ToSlash(rel), "/")
			if item.Group == rel {
				item.Group = "未分组"
			}
			item.Folder = filepath.ToSlash(filepath.Dir(rel))
			if item.Folder == "." {
				item.Folder = ""
			}
			l.items[i] = item
		}
		if !entry.item.Directory {
			updateFile(l.ids[entry.item.ID], entry.item)
			continue
		}
		for i, item := range l.items {
			if containsPath(src, item.Path) {
				updateFile(i, item)
			}
		}
		movedFolders := map[string]Item{}
		for rel := range l.folders {
			path := filepath.Join(l.state.Root, rel)
			if !containsPath(src, path) {
				continue
			}
			moved := l.catalogFolder(dst + strings.TrimPrefix(path, src))
			movedFolders[strings.TrimPrefix(moved.ID, folderPrefix)] = moved
			delete(l.folders, rel)
		}
		maps.Copy(l.folders, movedFolders)
	}
	return count, nil
}

func (l *Library) catalogChanged() {
	byPath := make(map[string]int, len(l.items))
	for i, item := range l.items {
		byPath[item.Path] = i
	}
	linkPreviews(l.items, byPath)
	l.ids = orderItems(l.items)
	l.reindex()
	l.state.DetectedMode, l.state.DetectionReason = detectSource(l.state.Root, l.folders, l.items)
	l.state.Updated = max(l.state.Updated+1, time.Now().UnixMilli())
}

func (l *Library) exportFolder(root, id, dest string, tokens []string) error {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if root != l.state.Root {
		return os.ErrNotExist
	}
	folder, err := l.folderItem(id, tokens)
	if err != nil {
		return err
	}
	if l.privateOwner(folder.Path) == "" {
		tokens = nil
	}
	if err = checkEntry(folder.Path, true); err != nil {
		return err
	}
	resolved, err := filepath.EvalSymlinks(dest)
	if err != nil {
		return err
	}
	if containsPath(folder.Path, resolved) {
		return errors.New("不能将文件夹导出到自身或子文件夹")
	}
	target := filepath.Join(resolved, folder.Name)
	if err = os.Mkdir(target, 0755); err != nil {
		return err
	}
	for _, entry := range l.folders {
		child, err := l.folderItem(entry.ID, tokens)
		if err != nil || child.Path == folder.Path || !containsPath(folder.Path, child.Path) {
			continue
		}
		if err = os.MkdirAll(target+strings.TrimPrefix(child.Path, folder.Path), 0755); err != nil {
			return err
		}
	}
	for _, item := range l.items {
		if !containsPath(folder.Path, item.Path) || !l.canRead(item.ID, tokens) {
			continue
		}
		path := target + strings.TrimPrefix(item.Path, folder.Path)
		if err = os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}
		if err = copyCatalogFile(item.Path, path); err != nil {
			return err
		}
	}
	return nil
}

func copyCatalogFile(source, target string) error {
	if err := checkEntry(source, false); err != nil {
		return err
	}
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	return errors.Join(err, out.Close())
}
