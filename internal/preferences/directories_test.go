package preferences

import (
	"path/filepath"
	"testing"
)

func TestDirectoryHistoryPreservesAliasesAndLastRoot(t *testing.T) {
	data := t.TempDir()
	s, err := New(data)
	if err != nil {
		t.Fatal(err)
	}
	first, second := filepath.Join(data, "disconnected"), filepath.Join(data, "other")
	if err := s.ImportDirectory(first); err != nil {
		t.Fatal(err)
	}
	for _, root := range []string{first, second, first} {
		if err := s.OpenDirectory(root); err != nil {
			t.Fatal(err)
		}
		if root == first {
			if err := s.EditDirectory(root, root, "  Archive  "); err != nil {
				t.Fatal(err)
			}
		}
	}
	s, err = New(data)
	if err != nil {
		t.Fatal(err)
	}
	last, dirs := s.Directories()
	if last != first || len(dirs) != 2 || dirs[0].Path != first || dirs[0].Name != "Archive" || dirs[0].LastOpened == 0 || dirs[1].Path != second {
		t.Fatalf("unexpected directory history: %q %+v", last, dirs)
	}
}

func TestEditingActiveDirectoryPathClearsSelection(t *testing.T) {
	data := t.TempDir()
	s, err := New(data)
	if err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(data, "current")
	other := filepath.Join(data, "other")
	offline := filepath.Join(data, "offline")
	for _, path := range []string{other, current} {
		if err := s.OpenDirectory(path); err != nil {
			t.Fatal(err)
		}
	}
	_, before := s.Directories()
	if err := s.EditDirectory(current, other, "Duplicate"); err == nil {
		t.Fatal("accepted a duplicate path")
	}
	if err := s.EditDirectory(current, offline, "Offline archive"); err != nil {
		t.Fatal(err)
	}
	if err := s.RemoveDirectory(other); err != nil {
		t.Fatal(err)
	}
	s, err = New(data)
	if err != nil {
		t.Fatal(err)
	}
	last, history := s.Directories()
	if last != "" || len(history) != 1 || history[0] != (Directory{Path: offline, Name: "Offline archive", LastOpened: before[0].LastOpened}) {
		t.Fatalf("unexpected current root or history: %q %+v", last, history)
	}
}

func TestRemoveAllDirectoriesPreservesEmptySelection(t *testing.T) {
	data := t.TempDir()
	s, err := New(data)
	if err != nil {
		t.Fatal(err)
	}
	first, second := filepath.Join(data, "first"), filepath.Join(data, "second")
	if err := s.ImportDirectory(first); err != nil {
		t.Fatal(err)
	}
	if err := s.OpenDirectory(second); err != nil {
		t.Fatal(err)
	}
	if err := s.RemoveDirectory(second); err != nil {
		t.Fatal(err)
	}
	if last, dirs := s.Directories(); last != "" || len(dirs) != 1 || dirs[0].Path != first {
		t.Fatalf("unexpected directory selection: %q %+v", last, dirs)
	}
	if err := s.RemoveDirectory(first); err != nil {
		t.Fatal(err)
	}
	s, err = New(data)
	if err != nil {
		t.Fatal(err)
	}
	if s.NeedsDirectoryImport() {
		t.Fatal("empty selection requested a legacy import")
	}
	if err := s.ImportDirectory(first); err != nil {
		t.Fatal(err)
	}
	if last, dirs := s.Directories(); last != "" || len(dirs) != 0 {
		t.Fatalf("directories reappeared: %q %+v", last, dirs)
	}
}
