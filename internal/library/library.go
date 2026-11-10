package library

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Item struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Path         string `json:"path"`
	Group        string `json:"group"`
	Folder       string `json:"folder"`
	Directory    bool   `json:"directory,omitempty"`
	PrivateEntry bool   `json:"privateEntry,omitempty"`
	Kind         string `json:"kind"`
	Ext          string `json:"ext"`
	Size         int64  `json:"size"`
	Modified     int64  `json:"modified"`
	Thumbnail    bool   `json:"thumbnail"`
	Preview      string `json:"preview"`
	Star         bool   `json:"star"`
	Tags         string `json:"tags"`
}
type Mark struct {
	Star bool   `json:"star"`
	Tags string `json:"tags"`
}
type Status struct {
	VaultConfigured  bool             `json:"vaultConfigured"`
	VaultUnlocked    bool             `json:"vaultUnlocked"`
	Root             string           `json:"root"`
	Scanning         bool             `json:"scanning"`
	Scanned          int              `json:"scanned"`
	Total            int              `json:"total"`
	Bytes            int64            `json:"bytes"`
	Counts           map[string]int   `json:"counts"`
	AllCounts        map[string]int   `json:"allCounts"`
	KindBytes        map[string]int64 `json:"kindBytes"`
	AllKindBytes     map[string]int64 `json:"allKindBytes"`
	FavoriteCount    int              `json:"favoriteCount"`
	FavoriteBytes    int64            `json:"favoriteBytes"`
	AllFavoriteCount int              `json:"allFavoriteCount"`
	AllFavoriteBytes int64            `json:"allFavoriteBytes"`
	Groups           []string         `json:"groups"`
	Error            string           `json:"error"`
	Skipped          int              `json:"skipped"`
	Updated          int64            `json:"updated"`
	DetectedMode     string           `json:"detectedMode"`
	DetectionReason  string           `json:"detectionReason"`
	FolderCount      int              `json:"folderCount"`
}
type Library struct {
	mu        sync.RWMutex
	items     []Item
	ids       map[string]int
	marks     map[string]Mark
	state     Status
	stateFile string
	index     *catalogIndex
	cache     queryCache
	folders   map[string]Item
	vault     vaultState
	dataDir   string
}

func New(root, data string) (*Library, error) {
	if err := os.MkdirAll(data, 0700); err != nil {
		return nil, err
	}
	l := &Library{ids: map[string]int{}, marks: map[string]Mark{}, stateFile: filepath.Join(data, "marks.json")}
	if b, e := os.ReadFile(l.stateFile); e == nil {
		if e = json.Unmarshal(b, &l.marks); e != nil {
			return nil, fmt.Errorf("收藏文件读取失败: %w", e)
		}
	} else if !os.IsNotExist(e) {
		return nil, e
	}
	l.index = buildIndex(nil)
	l.dataDir, _ = ProbeRoot(data)
	if err := l.loadVault(data); err != nil {
		return nil, err
	}
	l.state = Status{Root: root, Counts: map[string]int{}, AllCounts: map[string]int{}, KindBytes: map[string]int64{}, AllKindBytes: map[string]int64{}, Groups: []string{}}
	return l, nil
}
func IsTextExtension(ext string) bool {
	switch ext {
	case ".txt", ".md", ".markdown", ".csv", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx",
		".html", ".htm", ".css", ".scss", ".less", ".json", ".jsonc", ".json5", ".yaml", ".yml",
		".toml", ".graphql", ".gql", ".vue", ".mdx", ".xml", ".svg":
		return true
	default:
		return false
	}
}

func kind(ext string) string {
	if IsTextExtension(ext) {
		return "document"
	}
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp", ".pic", ".record_thumb":
		return "image"
	case ".mp4", ".mov", ".m4v", ".avi", ".webm":
		return "video"
	case ".silk", ".amr", ".mp3", ".wav", ".m4a", ".ogg":
		return "audio"
	case ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx":
		return "document"
	default:
		return "other"
	}
}

// ProbeRoot verifies that the directory can actually be listed.
func ProbeRoot(root string) (string, error) {
	if strings.TrimSpace(root) == "" {
		return "", fmt.Errorf("请选择目录")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	abs, err = filepath.EvalSymlinks(abs)
	if err != nil {
		return "", err
	}
	f, err := os.Open(abs)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := f.Readdirnames(1); err != nil && err != io.EOF {
		return "", err
	}
	return resolvedDirectory(f, abs), nil
}

// CloseDirectory persists the directory change before dropping the active catalog.
func (l *Library) CloseDirectory(root string, persist func() error) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.state.Scanning {
		return fmt.Errorf("正在扫描，请等待完成")
	}
	if err := persist(); err != nil {
		return err
	}
	if l.state.Root == root {
		l.items, l.folders, l.ids = nil, nil, nil
		l.vault.token = ""
		l.state = Status{}
		l.reindex()
	}
	return nil
}

func (l *Library) Rescan() error {
	return l.scanDirectory(l.Status().Root, nil, true)
}

func (l *Library) Scan(root string) error {
	return l.ScanDirectory(root, nil)
}

func (l *Library) ScanDirectory(root string, onOpen func(string) error) error {
	return l.scanDirectory(root, onOpen, false)
}

func (l *Library) scanDirectory(root string, onOpen func(string) error, rescan bool) error {
	requested := root
	resolved, err := ProbeRoot(root)
	if err != nil {
		err = fmt.Errorf("目录无法打开: %w", err)
		l.mu.Lock()
		if l.state.Root == root || (!rescan && l.state.Updated == 0) {
			l.state.Error = err.Error()
		}
		l.mu.Unlock()
		return err
	}
	root = resolved
	l.mu.Lock()
	if l.state.Scanning {
		l.mu.Unlock()
		return fmt.Errorf("正在扫描，请等待完成")
	}
	if rescan && l.state.Root != requested {
		l.mu.Unlock()
		return fmt.Errorf("目录已变化，请重试")
	}
	switching := l.state.Root != root
	if switching {
		l.vault.token = ""
	}
	showProgress := len(l.vault.records) == 0
	l.state.Scanning = true
	l.state.Scanned = 0
	l.state.Error = ""
	l.mu.Unlock()
	go func() {
		items := make([]Item, 0, 10000)
		byPath := map[string]int{}
		folders := map[string]Item{}
		skipped := 0
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, e error) error {
			if e != nil {
				if path == root {
					return e
				}
				skipped++
				return nil
			}
			if path != root && strings.HasPrefix(d.Name(), ".") {
				if d.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				if path != root {
					rel, _ := filepath.Rel(root, path)
					parent := filepath.ToSlash(filepath.Dir(rel))
					if parent == "." {
						parent = ""
					}
					modified := int64(0)
					if info, e := d.Info(); e == nil {
						modified = info.ModTime().UnixMilli()
					}
					folders[filepath.ToSlash(rel)] = Item{ID: "folder:" + filepath.ToSlash(rel), Name: d.Name(), Folder: parent, Kind: "folder", Directory: true, Modified: modified}
				}
				return nil
			}
			if d.Type()&os.ModeSymlink != 0 || l.isMetadata(path) {
				return nil
			}
			info, e := d.Info()
			if e != nil {
				skipped++
				return nil
			}
			if !info.Mode().IsRegular() {
				return nil
			}
			rel, e := filepath.Rel(root, path)
			if e != nil {
				return e
			}
			group := strings.Split(rel, string(filepath.Separator))[0]
			if group == rel {
				group = "未分组"
			}
			ext := strings.ToLower(filepath.Ext(path))
			hash := sha256.Sum256([]byte(path))
			id := hex.EncodeToString(hash[:12])
			thumb := strings.Contains(d.Name(), "_thumb") || ext == ".record_thumb"
			byPath[path] = len(items)
			parent := filepath.ToSlash(filepath.Dir(rel))
			if parent == "." {
				parent = ""
			}
			items = append(items, Item{ID: id, Name: d.Name(), Path: path, Group: group, Folder: parent, Kind: kind(ext), Ext: ext, Size: info.Size(), Modified: info.ModTime().UnixMilli(), Thumbnail: thumb})
			if showProgress && len(items)%1000 == 0 {
				l.mu.Lock()
				l.state.Scanned = len(items)
				l.mu.Unlock()
			}
			return nil
		})
		for i := range items {
			p := strings.TrimSuffix(items[i].Path, items[i].Ext) + "_thumb.jpg"
			if j, ok := byPath[p]; ok {
				items[i].Preview = items[j].ID
			}
			if items[i].Kind == "image" && items[i].Preview == "" {
				items[i].Preview = items[i].ID
			}
		}
		sort.Slice(items, func(i, j int) bool {
			if items[i].Modified == items[j].Modified {
				return items[i].Path < items[j].Path
			}
			return items[i].Modified > items[j].Modified
		})
		ids := map[string]int{}
		for i, x := range items {
			ids[x.ID] = i
		}
		l.mu.Lock()
		defer l.mu.Unlock()
		if err == nil && onOpen != nil {
			err = onOpen(root)
		}
		if err != nil {
			l.state.Scanning = false
			l.state.Scanned = l.state.Total
			l.state.Error = err.Error()
			return
		}
		l.items, l.folders, l.ids = items, folders, ids
		l.state = Status{Root: root, Skipped: skipped, Updated: max(l.state.Updated+1, time.Now().UnixMilli())}
		l.reindex()
		l.state.DetectedMode, l.state.DetectionReason = detectSource(root, folders, items)
	}()
	return nil
}

func (l *Library) isMetadata(path string) bool {
	if filepath.Dir(path) != l.dataDir {
		return false
	}
	switch strings.TrimSuffix(filepath.Base(path), ".tmp") {
	case "vault.json", "settings.json", "source.txt", "marks.json":
		return true
	}
	return false
}

func sortedGroups(groups map[string]bool) []string {
	result := make([]string, 0, len(groups))
	for group := range groups {
		result = append(result, group)
	}
	sort.Strings(result)
	return result
}

func (l *Library) Status(tokens ...string) Status {
	l.mu.RLock()
	defer l.mu.RUnlock()
	st := l.state
	_, st.VaultConfigured = l.vault.records[st.Root]
	st.VaultUnlocked = len(tokens) > 0 && l.vaultAuthorized(tokens[0])
	return st
}

type Query struct {
	Search, Kind, Group, Sort, Folder string
	ModifiedFrom, ModifiedBefore      *int64 // Milliseconds since epoch, inclusive start and exclusive end.
	Names                             map[string]string
	Thumbs, Star                      bool
	Offset, Limit                     int
	Private                           bool
	VaultToken                        string
}
type Result struct {
	Items              []Item  `json:"items"`
	Total              int     `json:"total"`
	Bytes              int64   `json:"bytes"`
	FileCount          int     `json:"fileCount"`
	FolderPrivateEntry bool    `json:"folderPrivateEntry,omitempty"`
	FolderFallback     *string `json:"folderFallback,omitempty"`
}

func (l *Library) List(q Query) Result {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if q.Private && !l.vaultAuthorized(q.VaultToken) {
		return Result{Items: []Item{}}
	}
	r := Result{Items: []Item{}}
	if r.FolderFallback = l.folderFallback(q.Folder, q.Private); r.FolderFallback != nil {
		return r
	}
	matches := l.query(q)
	r.Total, r.FileCount, r.Bytes = len(matches.indices), len(matches.indices), matches.bytes
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 80
	}
	if q.Offset < 0 {
		q.Offset = 0
	}
	end := q.Offset + q.Limit
	if end > r.Total {
		end = r.Total
	}
	for i := q.Offset; i < end; i++ {
		x := l.items[matches.indices[i]]
		m := l.marks[x.ID]
		x.Star = m.Star
		x.Tags = m.Tags
		r.Items = append(r.Items, l.itemForView(x, q.Private))
	}
	return r
}
func (l *Library) Item(id string, tokens ...string) (Item, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.item(id, tokens)
}

// PublicItem resolves a saved resource against its original, currently active source.
func (l *Library) PublicItem(root, id string) (Item, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if root != l.state.Root || l.state.Scanning {
		return Item{}, os.ErrNotExist
	}
	x, err := l.item(id, nil)
	if err != nil {
		return Item{}, err
	}
	return l.itemForView(x, false), nil
}

func (l *Library) item(id string, tokens []string) (Item, error) {
	i, ok := l.ids[id]
	if !ok || !l.canRead(id, tokens) {
		return Item{}, os.ErrNotExist
	}
	x := l.items[i]
	m := l.marks[id]
	x.Star = m.Star
	x.Tags = m.Tags
	return x, nil
}
func (l *Library) Open(id string, tokens ...string) (*os.File, Item, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	x, e := l.item(id, tokens)
	if e != nil {
		return nil, x, e
	}
	p, e := filepath.EvalSymlinks(x.Path)
	if e != nil {
		return nil, x, e
	}
	if p != x.Path {
		return nil, x, fmt.Errorf("资源路径已变化，请重新扫描")
	}
	f, e := os.Open(p)
	return f, x, e
}
func (l *Library) Mark(id string, m Mark, tokens ...string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	i, ok := l.ids[id]
	if !ok || !l.canRead(id, tokens) {
		return os.ErrNotExist
	}
	if len(m.Tags) > 1000 {
		return fmt.Errorf("标签过长")
	}
	next := map[string]Mark{}
	for k, v := range l.marks {
		next[k] = v
	}
	next[id] = m
	b, e := json.Marshal(next)
	if e != nil {
		return e
	}
	tmp := l.stateFile + ".tmp"
	if e = os.WriteFile(tmp, b, 0600); e != nil {
		return e
	}
	if e = os.Rename(tmp, l.stateFile); e != nil {
		return e
	}
	previous := l.marks[id]
	item := l.items[i]
	if previous.Star != m.Star && l.vault.items[id] == "" {
		delta := int64(-1)
		if m.Star {
			delta = 1
		}
		l.state.AllFavoriteCount += int(delta)
		l.state.AllFavoriteBytes += delta * item.Size
		if !item.Thumbnail {
			l.state.FavoriteCount += int(delta)
			l.state.FavoriteBytes += delta * item.Size
		}
	}
	l.marks = next
	l.resetCache()
	return nil
}
func (l *Library) Export(ids []string, dest string, tokens ...string) (int, error) {
	if len(ids) == 0 || len(ids) > 200 {
		return 0, fmt.Errorf("每次请选择 1–200 个资源")
	}
	n := 0
	for _, id := range ids {
		f, x, e := l.Open(id, tokens...)
		if e != nil {
			return n, e
		}
		out, e := os.OpenFile(filepath.Join(dest, x.ID+"_"+x.Name), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			f.Close()
			return n, e
		}
		_, e = io.Copy(out, f)
		f.Close()
		ce := out.Close()
		if e != nil {
			return n, e
		}
		if ce != nil {
			return n, ce
		}
		n++
	}
	return n, nil
}

type ScopeCover struct {
	ID       string `json:"id"`
	Kind     string `json:"kind"`
	Preview  string `json:"preview"`
	Modified int64  `json:"modified"`
}

type Scope struct {
	Hash     string         `json:"hash"`
	Count    int            `json:"count"`
	Bytes    int64          `json:"bytes"`
	Modified int64          `json:"modified"`
	Counts   map[string]int `json:"counts"`
	Covers   []ScopeCover   `json:"covers"`
}
type Scopes struct {
	Items     []Scope `json:"items"`
	Total     int     `json:"total"`
	Resources int     `json:"resources"`
	Bytes     int64   `json:"bytes"`
}

func (l *Library) Scopes(q Query) Scopes {
	l.mu.RLock()
	defer l.mu.RUnlock()
	m := map[string]*Scope{}
	r := Scopes{Items: []Scope{}}
	kinds := kindsFor(q.Kind)
	if q.Search == "" && !q.Star {
		for hash, byKind := range l.index.summaries[q.Thumbs] {
			if q.Group != "" && hash != q.Group {
				continue
			}
			g := &Scope{Hash: hash, Counts: map[string]int{}, Covers: []ScopeCover{}}
			for _, kind := range []string{"image", "video", "audio", "document", "other"} {
				part, ok := byKind[kind]
				if !ok || (len(kinds) > 0 && !kinds[kind]) {
					continue
				}
				g.Count += part.Count
				g.Bytes += part.Bytes
				if part.Modified > g.Modified {
					g.Modified = part.Modified
				}
				for k, n := range part.Counts {
					g.Counts[k] += n
				}
				for _, id := range part.Covers {
					if len(g.Covers) < 4 {
						g.Covers = append(g.Covers, id)
					}
				}
			}
			if g.Count > 0 {
				m[hash] = g
				r.Resources += g.Count
				r.Bytes += g.Bytes
			}
		}
	} else {
		search := strings.ToLower(q.Search)
		// Group aggregation never sorts individual resources.
		candidates := l.index.orders["date"]
		if q.Group != "" {
			candidates = l.index.groups[q.Group]["date"]
		}
		for _, i := range candidates {
			x := l.items[i]
			if !l.visible(x.ID, false) || !matches(x, l.marks[x.ID], q, kinds, search) {
				continue
			}
			g := m[x.Group]
			if g == nil {
				g = &Scope{Hash: x.Group, Counts: map[string]int{}, Covers: []ScopeCover{}}
				m[x.Group] = g
			}
			addScope(g, l.itemForView(x, false))
			r.Resources++
			r.Bytes += x.Size
		}
	}
	gs := make([]Scope, 0, len(m))
	for _, g := range m {
		gs = append(gs, *g)
	}
	sort.Slice(gs, func(i, j int) bool {
		a, b := gs[i], gs[j]
		if q.Sort == "size" && a.Bytes != b.Bytes {
			return a.Bytes > b.Bytes
		}
		if q.Sort == "name" {
			an, bn := q.Names[a.Hash], q.Names[b.Hash]
			if an != bn {
				return an < bn
			}
		}
		if a.Modified != b.Modified {
			return a.Modified > b.Modified
		}
		return a.Hash < b.Hash
	})
	r.Total = len(gs)
	start := q.Offset
	if start < 0 {
		start = 0
	}
	if start < len(gs) {
		limit := q.Limit
		if limit <= 0 || limit > 200 {
			limit = 24
		}
		end := start + limit
		if end > len(gs) {
			end = len(gs)
		}
		r.Items = gs[start:end]
	}
	return r
}
