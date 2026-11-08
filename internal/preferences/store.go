package preferences

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type Preferences struct {
	SetupTourDismissed bool    `json:"setupTourDismissed"`
	Locale             string  `json:"locale"`
	SidebarCollapsed   bool    `json:"sidebarCollapsed"`
	Theme              string  `json:"theme"`
	Palette            string  `json:"palette"`
	Grouped            bool    `json:"grouped"`
	TypeColors         bool    `json:"typeColors"`
	Thumbs             bool    `json:"thumbs"`
	Density            string  `json:"density"`
	View               string  `json:"view"`
	Sort               string  `json:"sort"`
	Volume             float64 `json:"volume"`
	Speed              float64 `json:"speed"`
}
type Contact struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Type     string `json:"type"`
}

// Source choices belong to a resource root, independently of app appearance.
type Source struct {
	Mode    string `json:"mode"`
	Grouped bool   `json:"grouped"`
}
type disk struct {
	Preferences Preferences                   `json:"preferences"`
	Bindings    map[string]map[string]Contact `json:"bindings"`
	Sources     map[string]Source             `json:"sources"`
}
type Store struct {
	mu   sync.Mutex
	path string
	data disk
}
type Snapshot struct {
	Preferences Preferences        `json:"preferences"`
	Contacts    map[string]Contact `json:"contacts"`
	Source      Source             `json:"source"`
}

func New(dir string) (*Store, error) {
	s := &Store{path: filepath.Join(dir, "settings.json"), data: disk{Preferences: Preferences{Locale: "zh-CN", Theme: "dark", Palette: "classic", Grouped: true, TypeColors: true, Density: "comfortable", View: "grid", Sort: "date", Volume: .8, Speed: 1}, Bindings: map[string]map[string]Contact{}}}
	b, e := os.ReadFile(s.path)
	if e == nil {
		e = json.Unmarshal(b, &s.data)
	}
	if e != nil && !os.IsNotExist(e) {
		return nil, e
	}
	if s.data.Bindings == nil {
		s.data.Bindings = map[string]map[string]Contact{}
	}
	if s.data.Sources == nil {
		s.data.Sources = map[string]Source{}
	}
	return s, nil
}
func (s *Store) Get(root string) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	m := map[string]Contact{}
	for k, v := range s.data.Bindings[root] {
		m[k] = v
	}
	source, ok := s.data.Sources[root]
	if !ok {
		source = Source{Mode: "auto", Grouped: true}
	}
	return Snapshot{Preferences: s.data.Preferences, Contacts: m, Source: source}
}
func (s *Store) SetSource(root string, source Source) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if root == "" || (source.Mode != "auto" && source.Mode != "folder" && source.Mode != "wechat") {
		return fmt.Errorf("无效的目录模式")
	}
	next := map[string]Source{}
	for k, v := range s.data.Sources {
		next[k] = v
	}
	next[root] = source
	d := s.data
	d.Sources = next
	return s.save(d)
}
func (s *Store) save(d disk) error {
	b, e := json.MarshalIndent(d, "", "  ")
	if e != nil {
		return e
	}
	if e = os.WriteFile(s.path+".tmp", b, 0600); e != nil {
		return e
	}
	if e = os.Rename(s.path+".tmp", s.path); e != nil {
		return e
	}
	s.data = d
	return nil
}
func (s *Store) Set(p Preferences) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	valid := func(v string, options ...string) bool {
		for _, o := range options {
			if o == v {
				return true
			}
		}
		return false
	}
	if p.Locale == "" {
		p.Locale = "zh-CN"
	}
	if !valid(p.Locale, "zh-CN", "en") || !valid(p.Theme, "dark", "light", "system") || !valid(p.Palette, "classic", "ocean", "forest") || !valid(p.Density, "comfortable", "compact") || !valid(p.View, "grid", "list") || !valid(p.Sort, "date", "size", "name") || p.Volume < 0 || p.Volume > 1 || p.Speed < .5 || p.Speed > 2 {
		return fmt.Errorf("无效的设置")
	}
	d := s.data
	d.Preferences = p
	return s.save(d)
}
func (s *Store) Bind(root string, contacts map[string]Contact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := map[string]map[string]Contact{}
	for k, v := range s.data.Bindings {
		next[k] = v
	}
	m := map[string]Contact{}
	for k, v := range next[root] {
		m[k] = v
	}
	for k, v := range contacts {
		if len(v.Name) > 200 || len(v.Username) > 200 {
			return fmt.Errorf("名称或账号过长")
		}
		if v.Type != "person" && v.Type != "group" && v.Type != "custom" {
			return fmt.Errorf("会话类型无效")
		}
		if v.Name == "" {
			delete(m, k)
		} else {
			m[k] = v
		}
	}
	next[root] = m
	d := s.data
	d.Bindings = next
	return s.save(d)
}
