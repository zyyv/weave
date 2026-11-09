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
			if err := s.NameDirectory(root, "  Archive  "); err != nil {
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
