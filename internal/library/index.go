package library

import (
	"encoding/json"
	"sort"
	"strings"
	"sync"
)

// Immutable metadata indexes are built once per scan, never from file contents.
type catalogIndex struct {
	orders    map[string][]int
	groups    map[string]map[string][]int
	summaries map[bool]map[string]map[string]Scope
}
type queryResult struct {
	indices []int
	bytes   int64
}
type queryCache struct {
	mu     sync.Mutex
	values map[string]queryResult
	keys   []string
}

func buildIndex(items []Item) *catalogIndex {
	idx := &catalogIndex{orders: map[string][]int{}, groups: map[string]map[string][]int{}, summaries: map[bool]map[string]map[string]Scope{false: {}, true: {}}}
	date := make([]int, len(items))
	for i := range items {
		date[i] = i
	}
	idx.orders["date"] = date
	for _, order := range []string{"size", "name"} {
		indices := append([]int(nil), date...)
		sort.SliceStable(indices, func(i, j int) bool {
			a, b := items[indices[i]], items[indices[j]]
			if order == "size" {
				return a.Size > b.Size
			}
			return a.Name < b.Name
		})
		idx.orders[order] = indices
	}
	for order, indices := range idx.orders {
		for _, i := range indices {
			g := items[i].Group
			if idx.groups[g] == nil {
				idx.groups[g] = map[string][]int{}
			}
			idx.groups[g][order] = append(idx.groups[g][order], i)
		}
	}
	for _, x := range items {
		for _, thumbs := range []bool{false, true} {
			if !thumbs && x.Thumbnail {
				continue
			}
			byKind := idx.summaries[thumbs][x.Group]
			if byKind == nil {
				byKind = map[string]Scope{}
				idx.summaries[thumbs][x.Group] = byKind
			}
			g := byKind[x.Kind]
			if g.Hash == "" {
				g = Scope{Hash: x.Group, Counts: map[string]int{}, Covers: []string{}}
			}
			addScope(&g, x)
			byKind[x.Kind] = g
		}
	}
	return idx
}
func addScope(g *Scope, x Item) {
	g.Count++
	g.Bytes += x.Size
	g.Counts[x.Kind]++
	if x.Modified > g.Modified {
		g.Modified = x.Modified
	}
	if x.Preview != "" && len(g.Covers) < 4 {
		g.Covers = append(g.Covers, x.Preview)
	}
}
func kindsFor(s string) map[string]bool {
	m := map[string]bool{}
	for _, kind := range strings.Split(s, ",") {
		if kind != "" {
			m[kind] = true
		}
	}
	return m
}
func matches(x Item, m Mark, q Query, kinds map[string]bool, search string) bool {
	if !q.Thumbs && x.Thumbnail {
		return false
	}
	if len(kinds) > 0 && !kinds[x.Kind] {
		return false
	}
	if q.Group != "" && x.Group != q.Group {
		return false
	}
	if q.Star && !m.Star {
		return false
	}
	return search == "" || strings.Contains(strings.ToLower(x.Name+" "+x.Group+" "+m.Tags+" "+q.Names[x.Group]), search)
}
func (l *Library) candidates(q Query) []int {
	order := q.Sort
	if order != "size" && order != "name" {
		order = "date"
	}
	if q.Group != "" {
		return l.index.groups[q.Group][order]
	}
	return l.index.orders[order]
}
func (l *Library) resetCache() {
	l.cache.mu.Lock()
	defer l.cache.mu.Unlock()
	l.cache.values = nil
	l.cache.keys = nil
}
func (l *Library) query(q Query) queryResult {
	names := q.Names
	if q.Search == "" {
		names = nil
	}
	keyBytes, _ := json.Marshal(struct {
		Search, Kind, Group, Sort string
		Thumbs, Star              bool
		Names                     map[string]string
	}{strings.ToLower(q.Search), q.Kind, q.Group, q.Sort, q.Thumbs, q.Star, names})
	key := string(keyBytes)
	l.cache.mu.Lock()
	cached, ok := l.cache.values[key]
	l.cache.mu.Unlock()
	if ok {
		return cached
	}
	kinds, search := kindsFor(q.Kind), strings.ToLower(q.Search)
	r := queryResult{indices: []int{}}
	for _, i := range l.candidates(q) {
		x := l.items[i]
		if matches(x, l.marks[x.ID], q, kinds, search) {
			r.indices = append(r.indices, i)
			r.bytes += x.Size
		}
	}
	l.cache.mu.Lock()
	defer l.cache.mu.Unlock()
	if l.cache.values == nil {
		l.cache.values = map[string]queryResult{}
	}
	if _, ok := l.cache.values[key]; !ok {
		if len(l.cache.keys) >= 8 {
			delete(l.cache.values, l.cache.keys[0])
			l.cache.keys = l.cache.keys[1:]
		}
		l.cache.keys = append(l.cache.keys, key)
	}
	l.cache.values[key] = r
	return r
}
