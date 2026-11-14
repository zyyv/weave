package library

import (
	"path/filepath"
	"reflect"
	"testing"
)

func TestStorageBreakdownRefinesPublicFileTypes(t *testing.T) {
	root := t.TempDir()
	lib := &Library{
		state: Status{Root: root},
		vault: vaultState{records: map[string]vaultRecord{root: {Paths: map[string]bool{"private.db": true}}}},
		items: []Item{
			{ID: "photo", Kind: "image", Ext: ".jpg", Size: 5},
			{ID: "thumbnail", Kind: "image", Ext: ".jpg", Size: 2, Thumbnail: true},
			{ID: "voice", Kind: "audio", Ext: ".silk", Size: 3},
			{ID: "music", Kind: "audio", Ext: ".mp3", Size: 4},
			{ID: "app-code", Folder: "Tools/Demo.APP/Contents", Kind: "document", Ext: ".js", Size: 8},
			{ID: "app-art", Folder: "Tools/Demo.APP/Contents", Kind: "image", Ext: ".svg", Size: 9},
			{ID: "project-code", Kind: "document", Ext: ".js", Size: 6},
			{ID: "database", Kind: "other", Ext: ".sqlite", Size: 7},
			{ID: "private", Path: filepath.Join(root, "private.db"), Kind: "other", Ext: ".db", Size: 100},
			{ID: "archive", Kind: "other", Ext: ".zip", Size: 0},
		},
	}
	lib.reindex()
	got := lib.Status()
	want := storageBreakdown{
		"image":     {Count: 1, Bytes: 5},
		"voice":     {Count: 1, Bytes: 3},
		"audio":     {Count: 1, Bytes: 4},
		"app":       {Count: 2, Bytes: 17},
		"developer": {Count: 1, Bytes: 6},
		"data":      {Count: 1, Bytes: 7},
		"archive":   {Count: 1},
	}
	if !reflect.DeepEqual(got.Usage, want) {
		t.Fatalf("usage = %v, want %v", got.Usage, want)
	}
	want["image"] = StorageUsage{Count: 2, Bytes: 7}
	if !reflect.DeepEqual(got.AllUsage, want) {
		t.Fatalf("usage with thumbnails = %v, want %v", got.AllUsage, want)
	}
	if got.AllCounts["audio"] != 2 || got.AllCounts["document"] != 2 {
		t.Fatalf("library filters changed: %v", got.AllCounts)
	}
}
