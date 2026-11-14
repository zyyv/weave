package preferences

import (
	"fmt"
	"maps"
	"path/filepath"
	"slices"
	"strings"
	"weave/internal/scanignore"
)

type ScanIgnore struct {
	Global   []string                      `json:"global"`
	Projects map[string]scanignore.Project `json:"projects"`
}

// Seed global rules only when the user has never saved their own list.
var defaultScanIgnoreRules = []string{
	".DS_Store",
	"Thumbs.db",
	"Desktop.ini",
	"node_modules/",
	"bower_components/",
	"dist/",
	"build/",
	"output/",
	"coverage/",
	".next/",
	".nuxt/",
	".output/",
	".turbo/",
	"__pycache__/",
	"*.py[co]",
	"*.tsbuildinfo",
}

func (s *Store) ScanIgnore() ScanIgnore {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := ScanIgnore{
		Global:   append([]string{}, s.data.ScanIgnore.Global...),
		Projects: make(map[string]scanignore.Project, len(s.data.ScanIgnore.Projects)),
	}
	for root, project := range s.data.ScanIgnore.Projects {
		project.Rules = append([]string{}, project.Rules...)
		out.Projects[root] = project
	}
	return out
}

func (s *Store) ScanMatcher(root string) (scanignore.Matcher, error) {
	s.mu.Lock()
	global, project := s.data.ScanIgnore.Global, s.data.ScanIgnore.Projects[root]
	s.mu.Unlock()
	// Writers replace slices rather than editing them in place.
	return scanignore.Compile(global, project)
}

func (s *Store) SetGlobalIgnore(rules []string) error {
	if _, err := scanignore.Compile(rules, scanignore.Project{}); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.data
	// Persist an explicit empty list so removing every rule survives restart.
	d.ScanIgnore.Global = append([]string{}, rules...)
	return s.save(d)
}

func (s *Store) SetProjectIgnore(root string, project scanignore.Project) error {
	if !filepath.IsAbs(root) || filepath.Clean(root) != root || strings.ContainsRune(root, 0) {
		return fmt.Errorf("无效的项目目录")
	}
	if err := scanignore.ValidateProject(project); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !slices.ContainsFunc(s.data.Directories, func(dir Directory) bool { return dir.Path == root }) {
		return fmt.Errorf("找不到这条目录记录")
	}
	d := s.data
	d.ScanIgnore.Projects = make(map[string]scanignore.Project, len(d.ScanIgnore.Projects)+1)
	maps.Copy(d.ScanIgnore.Projects, s.data.ScanIgnore.Projects)
	if (project.Mode == scanignore.Inherit || project.Mode == "") && len(project.Rules) == 0 {
		delete(d.ScanIgnore.Projects, root)
	} else {
		project.Rules = slices.Clone(project.Rules)
		d.ScanIgnore.Projects[root] = project
	}
	return s.save(d)
}
