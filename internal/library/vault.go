package library

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type vaultRecord struct {
	Salt  []byte          `json:"salt"`
	Hash  []byte          `json:"hash"`
	Paths map[string]bool `json:"paths"`
}

type pinAttempts struct {
	failures int
	retryAt  time.Time
}

type vaultState struct {
	path      string
	records   map[string]vaultRecord
	attempts  map[string]pinAttempts
	token     string
	owners    map[string]string // Absolute protected path to the resource root that owns it.
	items     map[string]string // Indexed media ID to the owning root.
	ancestors map[string]bool   // Public folders shown as navigation in this private space.
}

var pinPattern = regexp.MustCompile(`^[0-9]{6}$`)
var ErrVaultLocked = errors.New("请先解锁私密空间")

func (l *Library) loadVault(data string) error {
	l.vault = vaultState{
		path:     filepath.Join(data, "vault.json"),
		records:  map[string]vaultRecord{},
		attempts: map[string]pinAttempts{},
	}
	b, err := os.ReadFile(l.vault.path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, &l.vault.records); err != nil {
		return err
	}
	if l.vault.records == nil {
		return errors.New("私密空间记录无效")
	}
	return nil
}

func (l *Library) saveVault(root string, record vaultRecord) error {
	next := maps.Clone(l.vault.records)
	next[root] = record
	b, err := json.Marshal(next)
	if err != nil {
		return err
	}
	tmp := l.vault.path + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	if err = os.Rename(tmp, l.vault.path); err != nil {
		return err
	}
	l.vault.records = next
	return nil
}

func (l *Library) vaultAuthorized(token string) bool {
	return token != "" && subtle.ConstantTimeCompare([]byte(token), []byte(l.vault.token)) == 1
}

func (l *Library) LockVault(token string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.vaultAuthorized(token) {
		l.vault.token = ""
	}
}

func (l *Library) UnlockVault(root, pin string, create bool) (string, error) {
	if !pinPattern.MatchString(pin) {
		return "", errors.New("请输入 6 位数字 PIN")
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if root == "" || l.state.Scanning || l.state.Root != root || l.state.Updated == 0 {
		return "", errors.New("目录已变化，请重试")
	}
	record, exists := l.vault.records[root]
	if create == exists {
		return "", errors.New("私密空间设置已变化，请重试")
	}
	attempt := l.vault.attempts[root]
	now := time.Now()
	if now.Before(attempt.retryAt) {
		return "", errors.New("尝试次数过多，请稍后再试")
	}
	if create {
		record = vaultRecord{Salt: make([]byte, 16)}
		if _, err := rand.Read(record.Salt); err != nil {
			return "", err
		}
	}
	hash, err := pbkdf2.Key(sha256.New, pin, record.Salt, 600000, 32)
	if err != nil {
		return "", err
	}
	if !create && subtle.ConstantTimeCompare(record.Hash, hash) != 1 {
		attempt.failures++
		if attempt.failures == 5 {
			attempt = pinAttempts{retryAt: now.Add(30 * time.Second)}
		}
		l.vault.attempts[root] = attempt
		return "", errors.New("PIN 不正确")
	}
	session := make([]byte, 32)
	if _, err := rand.Read(session); err != nil {
		return "", err
	}
	if create {
		record.Hash = hash
		if err := l.saveVault(root, record); err != nil {
			return "", err
		}
	}
	delete(l.vault.attempts, root)
	l.vault.token = hex.EncodeToString(session)
	return l.vault.token, nil
}

func (l *Library) SetPrivate(root, token string, ids []string, private bool) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if root == "" || l.state.Root != root || l.state.Scanning || l.state.Updated == 0 {
		return errors.New("目录已变化，请重试")
	}
	if len(ids) == 0 || len(ids) > 200 {
		return errors.New("每次请选择 1–200 个资源")
	}
	record, exists := l.vault.records[root]
	if !exists || (!private && !l.vaultAuthorized(token)) {
		return ErrVaultLocked
	}
	paths := make(map[string]bool, len(record.Paths))
	maps.Copy(paths, record.Paths)
	for _, id := range ids {
		var rel, owner string
		if strings.HasPrefix(id, "folder:") {
			rel = strings.TrimPrefix(id, "folder:")
			if _, ok := l.folders[rel]; !ok {
				return os.ErrNotExist
			}
			owner = l.privateOwner(filepath.Join(root, rel))
		} else {
			i, ok := l.ids[id]
			if !ok {
				return os.ErrNotExist
			}
			rel, _ = filepath.Rel(root, l.items[i].Path)
			owner = l.vault.items[id]
		}
		if private {
			if owner != "" && !paths[rel] {
				return os.ErrNotExist
			}
			paths[rel] = true
		} else {
			if !paths[rel] {
				return errors.New("请从上层文件夹移除私密设置")
			}
			delete(paths, rel)
		}
	}
	record.Paths = paths
	if err := l.saveVault(root, record); err != nil {
		return err
	}
	l.reindex()
	l.state.Updated = max(l.state.Updated+1, time.Now().UnixMilli())
	return nil
}

func (l *Library) privateOwner(path string) string {
	if len(l.vault.owners) == 0 {
		return ""
	}
	for {
		if owner := l.vault.owners[path]; owner != "" {
			return owner
		}
		parent := filepath.Dir(path)
		if parent == path {
			return ""
		}
		path = parent
	}
}

func (l *Library) reindex() {
	root := l.state.Root
	v := &l.vault
	v.owners, v.items, v.ancestors = map[string]string{}, map[string]string{}, map[string]bool{}
	for owner, record := range v.records {
		for rel := range record.Paths {
			abs := filepath.Join(owner, rel)
			v.owners[abs] = owner
		}
	}
	for _, item := range l.items {
		if owner := l.privateOwner(item.Path); owner != "" {
			v.items[item.ID] = owner
		}
	}
	// Thumbnail files are resources too. Hide a generated companion when its
	// original is private, even when thumbnail files are shown in the library.
	for _, item := range l.items {
		if owner := v.items[item.ID]; owner != "" && item.Preview != "" && v.items[item.Preview] == "" {
			v.items[item.Preview] = owner
		}
	}
	markAncestors := func(folder string) {
		for folder != "" && !v.ancestors[folder] {
			v.ancestors[folder] = true
			folder = folderParent(folder)
		}
	}
	st := &l.state
	st.Total, st.Scanned, st.Bytes, st.FolderCount = 0, 0, 0, 0
	st.Counts, st.AllCounts = map[string]int{}, map[string]int{}
	groups := map[string]bool{}
	for _, x := range l.items {
		if owner := v.items[x.ID]; owner != "" {
			if owner == root {
				markAncestors(x.Folder)
			}
			continue
		}
		st.Total++
		st.Bytes += x.Size
		st.AllCounts[x.Kind]++
		if !x.Thumbnail {
			st.Counts[x.Kind]++
		}
		groups[x.Group] = true
	}
	st.Scanned = st.Total
	st.Groups = sortedGroups(groups)
	for rel, d := range l.folders {
		switch l.privateOwner(filepath.Join(root, rel)) {
		case "":
			st.FolderCount++
		case root:
			markAncestors(d.Folder)
		}
	}
	l.index = buildIndex(l.items, v.items)
	l.resetCache()
}

func (l *Library) canRead(id string, tokens []string) bool {
	owner := l.vault.items[id]
	return owner == "" || (owner == l.state.Root && len(tokens) > 0 && l.vaultAuthorized(tokens[0]))
}

func folderParent(folder string) string {
	parent := filepath.Dir(folder)
	if parent == "." {
		return ""
	}
	return parent
}

func (l *Library) visible(id string, private bool) bool {
	owner := l.vault.items[id]
	if private {
		return owner == l.state.Root
	}
	return owner == ""
}

func (l *Library) itemForView(x Item, private bool) Item {
	if x.Preview != "" && !l.visible(x.Preview, private) {
		x.Preview = ""
		if x.Kind == "image" {
			x.Preview = x.ID
		}
	}
	if private {
		rel, _ := filepath.Rel(l.state.Root, x.Path)
		x.PrivateEntry = l.vault.records[l.state.Root].Paths[rel]
	}
	return x
}
