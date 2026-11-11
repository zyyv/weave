package library

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"time"
)

// Trash moves a single indexed file through the platform's trash service.
func (l *Library) Trash(root, id string, size, modified int64, move func(string) error, tokens ...string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if root == "" || root != l.state.Root || l.state.Scanning {
		return errors.New("目录已变化，请重试")
	}
	x, err := l.item(id, tokens)
	if err != nil {
		return err
	}
	resolved, err := filepath.EvalSymlinks(x.Path)
	if err != nil {
		return err
	}
	info, err := os.Lstat(x.Path)
	if err != nil {
		return err
	}
	if resolved != x.Path || !info.Mode().IsRegular() ||
		size != x.Size || modified != x.Modified ||
		info.Size() != size || info.ModTime().UnixMilli() != modified {
		return errors.New("文件已变化，请重新扫描后重试")
	}

	// Trashing a private original must not expose its remaining thumbnail.
	var restorePrivacy func() error
	if owner := l.vault.items[id]; owner != "" && x.Preview != id {
		if i, ok := l.ids[x.Preview]; ok {
			preview := l.items[i]
			if l.privateOwner(preview.Path) == "" {
				previous := l.vault.records[owner]
				record := previous
				record.Paths = maps.Clone(previous.Paths)
				rel, _ := filepath.Rel(owner, preview.Path)
				record.Paths[rel] = true
				if err := l.saveVault(owner, record); err != nil {
					return fmt.Errorf("无法移入废纸篓: %w", err)
				}
				restorePrivacy = func() error { return l.saveVault(owner, previous) }
			}
		}
	}
	if err := move(x.Path); err != nil {
		if restorePrivacy != nil {
			err = errors.Join(err, restorePrivacy())
		}
		return fmt.Errorf("无法移入废纸篓: %w", err)
	}

	i := l.ids[id]
	copy(l.items[i:], l.items[i+1:])
	l.items[len(l.items)-1] = Item{}
	l.items = l.items[:len(l.items)-1]
	delete(l.ids, id)
	for j := range l.items {
		if j >= i {
			l.ids[l.items[j].ID] = j
		}
		if l.items[j].Preview == id {
			l.items[j].Preview = ""
			if l.items[j].Kind == "image" {
				l.items[j].Preview = l.items[j].ID
			}
		}
	}
	l.reindex()
	l.state.Updated = max(l.state.Updated+1, time.Now().UnixMilli())
	return nil
}
