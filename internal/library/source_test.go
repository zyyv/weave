package library

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSourceDetection(t *testing.T) {
	hash := "0123456789abcdef0123456789abcdef"
	for _, tc := range []struct {
		name, root string
		folders    map[string]Item
		mode       string
	}{
		{"known path", "/Library/Containers/com.tencent.xinWeChat/Data/Message/MessageTemp", nil, "wechat"},
		{"copied tree", "/backup/MessageTemp", map[string]Item{hash + "/Image": {}}, "wechat"},
		{"hashes alone", "/backup/MessageTemp", map[string]Item{hash: {}}, "folder"},
		{"ordinary image folder", "/photos", map[string]Item{hash + "/Image": {}}, "folder"},
		{"ordinary directory", "/Downloads", nil, "folder"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mode, _ := detectSource(tc.root, tc.folders, nil)
			if mode != tc.mode {
				t.Fatalf("got %s, want %s", mode, tc.mode)
			}
		})
	}
}

func TestFolderBrowsing(t *testing.T) {
	root := t.TempDir()
	for _, dir := range []string{"projects/nested", "empty", ".hidden"} {
		if err := os.MkdirAll(filepath.Join(root, dir), 0700); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range []string{"root.txt", "projects/notes.txt", "projects/nested/photo.jpg", ".hidden/secret.txt"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte("sample"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	l, err := New(root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = l.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, l)
	if st := l.Status(); st.DetectedMode != "folder" || st.FolderCount != 3 {
		t.Fatalf("status: %+v", st)
	}
	r := l.Browse(Query{Sort: "name"}, "")
	if r.Total != 3 || r.FileCount != 1 || !r.Items[0].Directory || r.Items[0].Name != "empty" || r.Items[2].Name != "root.txt" {
		t.Fatalf("root: %+v", r)
	}
	r = l.Browse(Query{}, "projects")
	if r.Total != 2 || r.Items[0].Name != "nested" || r.Items[1].Folder != "projects" {
		t.Fatalf("nested: %+v", r)
	}
	if r = l.Browse(Query{Kind: "image"}, "empty"); r.Total != 0 || r.FolderFallback != nil {
		t.Fatalf("empty folder should remain available: %+v", r)
	}
	if r = l.Browse(Query{}, "../"); r.Total != 0 || r.FolderFallback == nil || *r.FolderFallback != "" {
		t.Fatal("out-of-root folder accepted")
	}
	if r = l.Browse(Query{Kind: "image"}, ""); r.Total != 1 || r.Items[0].Name != "projects" {
		t.Fatalf("image filter: %+v", r)
	}
	if r = l.Browse(Query{Search: "nested"}, "projects"); r.Total != 1 || r.Items[0].Name != "nested" {
		t.Fatalf("path search: %+v", r)
	}
	if r = l.Browse(Query{Search: "empty"}, ""); r.Total != 1 || r.Items[0].Name != "empty" {
		t.Fatalf("empty folder search: %+v", r)
	}
	if r = l.Browse(Query{Limit: 1, Offset: 2, Sort: "name"}, ""); r.Total != 3 || len(r.Items) != 1 || r.Items[0].Directory {
		t.Fatalf("paging: %+v", r)
	}
	if r = l.List(Query{}); r.Total != 3 {
		t.Fatalf("flat listing includes directories: %+v", r)
	}
	if r = l.List(Query{Folder: "projects", Sort: "name", Limit: 1}); r.Total != 2 || r.FileCount != 2 || r.Bytes != 12 || len(r.Items) != 1 || r.Items[0].Name != "notes.txt" {
		t.Fatalf("flat listing in projects: %+v", r)
	}
	if r = l.List(Query{Folder: "projects", Sort: "name", Offset: 1, Limit: 1}); r.Total != 2 || len(r.Items) != 1 || r.Items[0].Name != "photo.jpg" {
		t.Fatalf("flat listing includes descendant files: %+v", r)
	}
	if r = l.List(Query{Folder: "empty"}); r.Total != 0 || r.FolderFallback != nil {
		t.Fatalf("flat listing should preserve an empty directory: %+v", r)
	}
	if err := os.RemoveAll(filepath.Join(root, "projects/nested")); err != nil {
		t.Fatal(err)
	}
	if err := l.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, l)
	r = l.Browse(Query{Kind: "image"}, "projects/nested")
	if r.FolderFallback == nil || *r.FolderFallback != "projects" {
		t.Fatalf("removed folder should fall back to its nearest existing parent: %+v", r)
	}
	r = l.List(Query{Folder: "projects/nested"})
	if r.FolderFallback == nil || *r.FolderFallback != "projects" {
		t.Fatalf("flat listing should also fall back after a folder is removed: %+v", r)
	}
}
