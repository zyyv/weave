package library

import (
	"os"
	"path/filepath"
	"slices"
	"testing"
	"weave/internal/preferences"
	"weave/internal/scanignore"
)

func TestScanIgnoreProjects(t *testing.T) {
	data := t.TempDir()
	prefs, err := preferences.New(data)
	if err != nil {
		t.Fatal(err)
	}
	makeProject := func() string {
		root, err := ProbeRoot(t.TempDir())
		if err != nil {
			t.Fatal(err)
		}
		if err := os.Mkdir(filepath.Join(root, "cache"), 0700); err != nil {
			t.Fatal(err)
		}
		for _, name := range []string{"keep.tmp", "skip.tmp", "readme.txt", "cache/keep.txt", ".hidden"} {
			if err := os.WriteFile(filepath.Join(root, name), nil, 0600); err != nil {
				t.Fatal(err)
			}
		}
		if err := prefs.OpenDirectory(root); err != nil {
			t.Fatal(err)
		}
		return root
	}
	custom, inherited, empty := makeProject(), makeProject(), makeProject()
	if err := prefs.SetGlobalIgnore([]string{"*.tmp", "/cache/"}); err != nil {
		t.Fatal(err)
	}
	if err := prefs.SetProjectIgnore(custom, scanignore.Project{Mode: scanignore.Append, Rules: []string{"!keep.tmp", "!cache/keep.txt"}}); err != nil {
		t.Fatal(err)
	}
	if err := prefs.SetProjectIgnore(empty, scanignore.Project{Mode: scanignore.Replace}); err != nil {
		t.Fatal(err)
	}
	if err := prefs.SetProjectIgnore(custom, scanignore.Project{Mode: scanignore.Append, Rules: []string{"["}}); err == nil {
		t.Fatal("saved malformed rule")
	}
	reopened, err := preferences.New(data)
	if err != nil {
		t.Fatal(err)
	}
	l, err := New("", data)
	if err != nil {
		t.Fatal(err)
	}
	l.SetScanRules(reopened.ScanMatcher)
	for _, test := range []struct {
		root  string
		files []string
	}{
		{custom, []string{"keep.tmp", "readme.txt"}},
		{inherited, []string{"readme.txt"}},
		{empty, []string{"keep.tmp", "keep.txt", "readme.txt", "skip.tmp"}},
	} {
		if err := l.Scan(test.root); err != nil {
			t.Fatal(err)
		}
		waitScan(t, l)
		files := []string{}
		for _, item := range l.List(Query{}).Items {
			files = append(files, item.Name)
		}
		slices.Sort(files)
		if !slices.Equal(files, test.files) {
			t.Fatalf("project %s scanned %v, want %v", test.root, files, test.files)
		}
		if test.root != empty && l.Status().FolderCount != 0 {
			t.Fatal("an ignored folder entered the catalog")
		}
	}

}

func TestIgnoringPrivateOriginalDoesNotExposeThumbnail(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"private.jpg", "private_thumb.jpg", "public.jpg"} {
		if err := os.WriteFile(filepath.Join(root, name), nil, 0600); err != nil {
			t.Fatal(err)
		}
	}
	l, err := New("", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, l)
	root = l.Status().Root
	token, err := l.UnlockVault(root, "123456", true)
	if err != nil {
		t.Fatal(err)
	}
	if err := l.SetPrivate(root, token, []string{pathID(filepath.Join(root, "private.jpg"))}, true); err != nil {
		t.Fatal(err)
	}
	l.LockVault(token)
	l.SetScanRules(func(string) (scanignore.Matcher, error) {
		return scanignore.Compile([]string{"private.jpg"}, scanignore.Project{})
	})
	if err := l.Rescan(); err != nil {
		t.Fatal(err)
	}
	waitScan(t, l)
	if got := l.List(Query{Thumbs: true}); got.Total != 1 || got.Items[0].Name != "public.jpg" {
		t.Fatalf("ignored private original exposed its thumbnail: %+v", got)
	}
}
