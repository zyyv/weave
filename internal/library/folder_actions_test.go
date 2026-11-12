package library

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestFolderActionsKeepTagsAndExportPublicContents(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("folder moves use macOS exclusive rename")
	}
	root := t.TempDir()
	l, err := New(root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = l.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, l)
	root = l.Status().Root
	if err = l.CreateFolder(root, "", "Project"); err != nil {
		t.Fatal(err)
	}
	if err = l.CreateFolder(root, "folder:Project", "Empty"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"notes.txt", "private.txt"} {
		if err = os.WriteFile(filepath.Join(root, name), []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err = l.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, l)
	if err = l.UpdateEntryMark(root, "folder:Project", nil, new("blue")); err != nil {
		t.Fatal(err)
	}
	refs := []EntryRef{}
	for _, item := range l.List(Query{}).Items {
		if err = l.Mark(item.ID, Mark{Tags: "red"}); err != nil {
			t.Fatal(err)
		}
		refs = append(refs, EntryRef{ID: item.ID, Size: item.Size, Modified: item.Modified})
	}
	if count, err := l.MoveEntries(root, "folder:Project", refs); err != nil || count != 2 {
		t.Fatalf("move: %d %v", count, err)
	}
	folder, err := l.RenameFolder(root, "folder:Project", "Archive")
	if err != nil || folder.Tags != "blue" {
		t.Fatalf("rename: %+v %v", folder, err)
	}
	items := l.Browse(Query{}, "Archive").Items
	if len(items) != 3 || items[1].Tags != "red" || items[2].Tags != "red" {
		t.Fatalf("browse: %+v", items)
	}
	token, err := l.UnlockVault(root, "123456", true)
	if err != nil {
		t.Fatal(err)
	}
	privateID := pathID(filepath.Join(root, "Archive", "private.txt"))
	if err = l.SetPrivate(root, token, []string{privateID}, true); err != nil {
		t.Fatal(err)
	}
	if _, err = l.RenameFolder(root, folder.ID, "WouldExposePrivate", token); err == nil {
		t.Fatal("renamed a folder with protected contents")
	}
	dest := t.TempDir()
	if count, err := l.Export([]string{folder.ID}, dest, token); err != nil || count != 1 {
		t.Fatalf("export: %d %v", count, err)
	}
	if _, err = os.Stat(filepath.Join(dest, "Archive", "Empty")); err != nil {
		t.Fatal(err)
	}
	if content, err := os.ReadFile(filepath.Join(dest, "Archive", "notes.txt")); err != nil || string(content) != "notes.txt" {
		t.Fatalf("exported file: %q %v", content, err)
	}
	if _, err = os.Stat(filepath.Join(dest, "Archive", "private.txt")); !os.IsNotExist(err) {
		t.Fatalf("private content was exported: %v", err)
	}
}
