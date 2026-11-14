package library

import (
	"path"
	"path/filepath"
	"sort"
	"strings"
)

func isConversationHash(name string) bool {
	if len(name) != 32 {
		return false
	}
	for _, c := range strings.ToLower(name) {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

// A hash alone is not evidence of a conversation. Recognize the known source
// path, or a copied MessageTemp tree with both hashes and WeChat media layout.
func detectSource(root string, folders map[string]Item, items []Item) (string, string) {
	p := strings.ToLower(filepath.ToSlash(root))
	if strings.EqualFold(filepath.Base(root), "MessageTemp") {
		for _, segment := range strings.Split(p, "/") {
			if segment == "com.tencent.xinwechat" || segment == "wechat" || segment == "weixin" {
				return "wechat", "knownWechatPath"
			}
		}
		for folder := range folders {
			parts := strings.Split(folder, "/")
			if len(parts) >= 2 && isConversationHash(parts[0]) {
				switch strings.ToLower(parts[1]) {
				case "image", "video", "audio", "file":
					return "wechat", "wechatStructure"
				}
			}
		}
		for _, item := range items {
			if isConversationHash(item.Group) && (item.Ext == ".silk" || item.Ext == ".record_thumb" || item.Ext == ".pic") {
				return "wechat", "wechatStructure"
			}
		}
	}
	return "folder", "ordinaryDirectory"
}

// wechatHiddenImages groups WeChat image variants within one folder and
// visibility boundary. An HD file takes precedence over its standard version.
func wechatHiddenImages(items []Item, owners map[string]string) map[string]bool {
	type imageKey struct {
		folder, stem, owner string
	}
	hd := map[imageKey]string{}
	standard := map[imageKey][]string{}
	thumbs := map[imageKey][]string{}
	hidden := map[string]bool{}
	for _, item := range items {
		if item.Kind != "image" {
			continue
		}
		name := strings.ToLower(item.Name)
		stem := name
		if item.Ext != ".pic" {
			stem = strings.TrimSuffix(name, item.Ext)
		}
		key := imageKey{folder: item.Folder, owner: owners[item.ID]}
		switch {
		case strings.HasSuffix(stem, ".pic_thumb"), strings.HasSuffix(stem, ".pic_hd_thumb"):
			hidden[item.ID] = true
		case strings.HasSuffix(stem, ".pic_hd"):
			key.stem = strings.TrimSuffix(stem, ".pic_hd")
			if hd[key] == "" {
				hd[key] = item.ID
			} else {
				hidden[item.ID] = true
			}
		case strings.HasSuffix(stem, ".pic"):
			key.stem = strings.TrimSuffix(stem, ".pic")
			standard[key] = append(standard[key], item.ID)
		case strings.HasSuffix(stem, "_thumb"):
			key.stem = strings.TrimSuffix(stem, "thumb")
			thumbs[key] = append(thumbs[key], item.ID)
		}
	}
	for key, ids := range standard {
		if hd[key] == "" {
			ids = ids[1:]
		}
		for _, id := range ids {
			hidden[id] = true
		}
	}
	for key, ids := range thumbs {
		if hd[key] == "" && len(standard[key]) == 0 {
			key.stem = strings.TrimSuffix(key.stem, "_")
			if hd[key] == "" && len(standard[key]) == 0 {
				continue
			}
		}
		for _, id := range ids {
			hidden[id] = true
		}
	}
	return hidden
}

// Browse uses only the scanned catalog; a client path never opens a filesystem
// path. Folders and files share pagination so large directories stay virtualized.
func (l *Library) Browse(q Query, folder string) Result {
	l.mu.RLock()
	defer l.mu.RUnlock()
	r := Result{Items: []Item{}}
	if q.Private && !l.vaultAuthorized(q.VaultToken) {
		return r
	}
	if r.FolderFallback = l.folderFallback(folder, q.Private); r.FolderFallback != nil {
		return r
	}
	r.FolderPrivateEntry = q.Private && l.vault.records[l.state.Root].Paths[folder]
	entries := []Item{}
	dirs := map[string]bool{}
	filtered := q.Search != "" || q.Kind != "" || q.TagColors != "" || q.Star
	for _, i := range l.query(q).indices {
		x := l.items[i]
		if x.Folder == folder {
			m := l.marks[x.ID]
			x.Star, x.Tags = m.Star, m.Tags
			entries = append(entries, l.itemForView(x, q.Private))
			r.FileCount++
			r.Bytes += x.Size
		} else {
			rel := x.Folder
			if folder != "" {
				if !strings.HasPrefix(rel, folder+"/") {
					continue
				}
				rel = strings.TrimPrefix(rel, folder+"/")
			}
			dirs[path.Join(folder, strings.Split(rel, "/")[0])] = true
		}
	}
	for rel, d := range l.folders {
		nameMatch := q.Search != "" && q.Kind == "" && q.TagColors == "" && !q.Star && strings.Contains(strings.ToLower(rel), strings.ToLower(q.Search))
		if d.Folder == folder && l.folderVisible(rel, q.Private) && (!filtered || dirs[rel] || nameMatch) {
			d.Path = filepath.Join(l.state.Root, rel)
			d.Tags = l.marks[folderMarkID(d.Path)].Tags
			d.PrivateEntry = q.Private && l.vault.records[l.state.Root].Paths[rel]
			entries = append(entries, d)
		}
	}
	sort.SliceStable(entries, func(i, j int) bool {
		a, b := entries[i], entries[j]
		if a.Directory != b.Directory {
			return a.Directory
		}
		if q.Sort == "size" && a.Size != b.Size {
			return a.Size > b.Size
		}
		if q.Sort != "name" && q.Sort != "size" && a.Modified != b.Modified {
			return a.Modified > b.Modified
		}
		return a.Name < b.Name
	})
	r.Total = len(entries)
	start := max(0, q.Offset)
	limit := q.Limit
	if limit <= 0 || limit > 200 {
		limit = 80
	}
	if start < r.Total {
		r.Items = entries[start:min(start+limit, r.Total)]
	}
	return r
}

// folderFallback returns the nearest visible ancestor when the requested folder is unavailable.
func (l *Library) folderFallback(folder string, private bool) *string {
	candidate := folder
	for candidate != "" {
		if _, ok := l.folders[candidate]; ok && l.folderVisible(candidate, private) {
			break
		}
		candidate = candidate[:max(0, strings.LastIndexByte(candidate, '/'))]
	}
	if candidate == folder {
		return nil
	}
	return &candidate
}

func (l *Library) folderVisible(rel string, private bool) bool {
	owner := l.privateOwner(filepath.Join(l.state.Root, rel))
	if private {
		return owner == l.state.Root || l.vault.ancestors[rel]
	}
	return owner == ""
}
