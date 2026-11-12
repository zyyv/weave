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

func (s *Store) NeedsDirectoryImport() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.data.DirectorySelectionSaved && s.data.LastDirectory == "" && len(s.data.Directories) == 0
}

// ImportDirectory preserves the last path even if the drive is currently offline.
func (s *Store) ImportDirectory(root string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if root == "" || s.data.DirectorySelectionSaved || s.data.LastDirectory != "" || len(s.data.Directories) != 0 {
		return nil
	}
	d := s.data
	d.DirectorySelectionSaved = true
	d.LastDirectory = root
	d.Directories = append(slices.Clone(d.Directories), Directory{Path: root})
	return s.save(d)
}

func (s *Store) OpenDirectory(root string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.data
	d.DirectorySelectionSaved = true
	d.LastDirectory = root
	d.Directories = slices.Clone(d.Directories)
	now := time.Now().UnixMilli()
	if i := slices.IndexFunc(d.Directories, func(dir Directory) bool { return dir.Path == root }); i >= 0 {
		d.Directories[i].LastOpened = now
	} else {
		d.Directories = append(d.Directories, Directory{Path: root, LastOpened: now})
	}
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
	if path != root && d.LastDirectory == root {
		d.DirectorySelectionSaved = true
		d.LastDirectory = ""
	}
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

// RemoveDirectory forgets the entry and clears the selection if it was active.
func (s *Store) RemoveDirectory(root string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := slices.IndexFunc(s.data.Directories, func(dir Directory) bool { return dir.Path == root })
	d := s.data
	if i < 0 && d.LastDirectory != root {
		return nil
	}
	d.DirectorySelectionSaved = true
	if d.LastDirectory == root {
		d.LastDirectory = ""
	}
	if i >= 0 {
		d.Directories = slices.Delete(slices.Clone(d.Directories), i, i+1)
	}
	return s.save(d)
}
