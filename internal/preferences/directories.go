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
	Pinned     bool   `json:"pinned,omitempty"`
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
		entry.Pinned = d.Directories[i].Pinned
		d.Directories = slices.Delete(d.Directories, i, i+1)
	}
	d.Directories = append([]Directory{entry}, d.Directories...)
	return s.save(d)
}

func (s *Store) EditDirectory(root, path, name string) error {
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
	if !filepath.IsAbs(path) || strings.ContainsRune(path, 0) {
		return errors.New("请输入绝对目录路径")
	}
	path = filepath.Clean(path)
	if path != root && slices.ContainsFunc(s.data.Directories, func(dir Directory) bool { return dir.Path == path }) {
		return errors.New("此路径已在资源目录历史中")
	}
	d := s.data
	d.Directories = slices.Clone(d.Directories)
	d.Directories[i].Path = path
	d.Directories[i].Name = name
	return s.save(d)
}

func (s *Store) PinDirectory(root string, pinned bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := slices.IndexFunc(s.data.Directories, func(dir Directory) bool { return dir.Path == root })
	if i < 0 {
		return errors.New("找不到这条目录记录")
	}
	if s.data.Directories[i].Pinned == pinned {
		return nil
	}
	d := s.data
	d.Directories = slices.Clone(d.Directories)
	d.Directories[i].Pinned = pinned
	return s.save(d)
}

// RemoveDirectory forgets a history entry without changing the active library.
func (s *Store) RemoveDirectory(root string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := slices.IndexFunc(s.data.Directories, func(dir Directory) bool { return dir.Path == root })
	if i < 0 {
		return nil
	}
	d := s.data
	d.Directories = slices.Delete(slices.Clone(d.Directories), i, i+1)
	return s.save(d)
}
