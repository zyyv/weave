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
	if r = l.Browse(Query{}, "empty"); r.Total != 0 {
		t.Fatal("empty folder contains resources")
	}
	if r = l.Browse(Query{}, "../"); r.Total != 0 {
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
}
