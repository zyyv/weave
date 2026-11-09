package preferences

import (
	"errors"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

type Directory struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	LastOpened int64  `json:"lastOpened"`
}

func (s *Store) Directories() (string, []Directory) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data.LastDirectory, append([]Directory{}, s.data.Directories...)
}

// ImportDirectory preserves the last path even if the drive is currently offline.
func (s *Store) ImportDirectory(root string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if root == "" || s.data.LastDirectory != "" {
		return nil
	}
	d := s.data
	d.LastDirectory = root
	d.Directories = append(slices.Clone(d.Directories), Directory{Path: root})
	return s.save(d)
}

func (s *Store) OpenDirectory(root string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.data
	d.LastDirectory = root
	d.Directories = slices.Clone(d.Directories)
	entry := Directory{Path: root, LastOpened: time.Now().UnixMilli()}
	if i := slices.IndexFunc(d.Directories, func(dir Directory) bool { return dir.Path == root }); i >= 0 {
		entry.Name = d.Directories[i].Name
		d.Directories = slices.Delete(d.Directories, i, i+1)
	}
	d.Directories = append([]Directory{entry}, d.Directories...)
	return s.save(d)
}

func (s *Store) NameDirectory(root, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > 80 {
		return errors.New("目录名称最多 80 个字符")
	}
	i := slices.IndexFunc(s.data.Directories, func(dir Directory) bool { return dir.Path == root })
	if i < 0 || !filepath.IsAbs(root) {
		return errors.New("找不到这条目录记录")
	}
	d := s.data
	d.Directories = slices.Clone(d.Directories)
	d.Directories[i].Name = name
	return s.save(d)
}
