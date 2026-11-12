package library

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Rename changes only the stem of an indexed file.
func (l *Library) Rename(root, id, stem string, size, modified int64, tokens ...string) (Item, error) {
	if strings.HasPrefix(id, folderPrefix) {
		return l.RenameFolder(root, id, stem, tokens...)
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if root == "" || root != l.state.Root || l.state.Scanning {
		return Item{}, errors.New("目录已变化，请重试")
	}
	item, err := l.item(id, tokens)
	if err != nil {
		return Item{}, err
	}
	if strings.TrimSpace(stem) == "" || strings.HasPrefix(stem, ".") ||
		strings.ContainsAny(stem, "/\\\x00\r\n") {
		return Item{}, errors.New("文件名无效")
	}
	extension := filepath.Ext(item.Name)
	if extension == "" && filepath.Ext(stem) != "" {
		return Item{}, errors.New("不能更改文件后缀")
	}
	if err := validateFile(item, size, modified); err != nil {
		return Item{}, err
	}

	name := stem + extension
	owner := l.vault.items[id]
	if name == item.Name {
		return l.itemForView(item, owner != ""), nil
	}
	path := filepath.Join(filepath.Dir(item.Path), name)
	newID := pathID(path)
	if targetOwner := l.privateOwner(path); targetOwner != "" && targetOwner != owner {
		return Item{}, errors.New("目标文件名已存在")
	}

	// Protect the new path before moving any private file. Preserve a companion
	// thumbnail's protection when its old filename stops matching the original.
	previousVault := l.vault.records[owner]
	vaultChanged := false
	oldRelative, _ := filepath.Rel(owner, item.Path)
	if owner != "" {
		record := previousVault
		record.Paths = maps.Clone(previousVault.Paths)
		if l.privateOwner(filepath.Dir(path)) == "" {
			newRelative, _ := filepath.Rel(owner, path)
			record.Paths[newRelative] = true
			vaultChanged = true
		}
		if i, ok := l.ids[item.Preview]; ok && item.Preview != id {
			preview := l.items[i]
			if l.privateOwner(preview.Path) == "" {
				relative, _ := filepath.Rel(owner, preview.Path)
				record.Paths[relative] = true
				vaultChanged = true
			}
		}
		if vaultChanged {
			if err := l.saveVault(owner, record); err != nil {
				return Item{}, fmt.Errorf("无法重命名文件: %w", err)
			}
		}
	}
	restoreVault := func() error {
		if vaultChanged {
			return l.saveVault(owner, previousVault)
		}
		return nil
	}

	nextMarks := l.marks
	mark, hasMark := l.marks[id]
	_, hasDestinationMark := l.marks[newID]
	if hasMark || hasDestinationMark {
		nextMarks = maps.Clone(l.marks)
		delete(nextMarks, id)
		delete(nextMarks, newID)
		if hasMark {
			nextMarks[newID] = mark
		}
		if err := l.saveMarks(nextMarks); err != nil {
			return Item{}, fmt.Errorf("无法重命名文件: %w", errors.Join(err, restoreVault()))
		}
	}
	if err := renameFileExclusive(item.Path, path); err != nil {
		var restoreMarksErr error
		if hasMark || hasDestinationMark {
			restoreMarksErr = l.saveMarks(l.marks)
		}
		restoreErr := errors.Join(restoreMarksErr, restoreVault())
		if errors.Is(err, os.ErrExist) && restoreErr == nil {
			return Item{}, errors.New("目标文件名已存在")
		}
		return Item{}, fmt.Errorf("无法重命名文件: %w", errors.Join(err, restoreErr))
	}

	if previousVault.Paths[oldRelative] {
		record := l.vault.records[owner]
		record.Paths = maps.Clone(record.Paths)
		delete(record.Paths, oldRelative)
		// Both paths remain protected if removing the stale record fails.
		_ = l.saveVault(owner, record)
	}

	item.ID, item.Name, item.Path = newID, name, path
	item.Thumbnail = strings.Contains(name, "_thumb") || item.Ext == ".record_thumb"
	l.items[l.ids[id]] = item
	l.marks = nextMarks
	byPath := make(map[string]int, len(l.items))
	for i, entry := range l.items {
		byPath[entry.Path] = i
	}
	linkPreviews(l.items, byPath)
	l.ids = orderItems(l.items)
	l.reindex()
	l.state.Updated = max(l.state.Updated+1, time.Now().UnixMilli())
	return l.itemForView(l.items[l.ids[newID]], owner != ""), nil
}
