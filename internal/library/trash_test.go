package library

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestTrashFile(t *testing.T) {
	root, data, trash := t.TempDir(), t.TempDir(), t.TempDir()
	for _, name := range []string{"image.jpg", "image_thumb.jpg", "other.txt"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	l, err := New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	scan := func() {
		t.Helper()
		if err := l.Scan(root); err != nil {
			t.Fatal(err)
		}
		waitScan(t, l)
		root = l.Status().Root
	}
	scan()
	var x Item
	for _, item := range l.List(Query{Thumbs: true}).Items {
		if item.Name == "image.jpg" {
			x = item
		}
	}
	move := func(path string) error { return os.Rename(path, filepath.Join(trash, filepath.Base(path))) }
	unexpectedMove := func(string) error {
		t.Fatal("invalid request reached the trash service")
		return nil
	}
	if err := l.Trash(root, x.ID, x.Size+1, x.Modified, unexpectedMove); err == nil {
		t.Fatal("accepted a stale file")
	}
	if err := l.Trash(trash, x.ID, x.Size, x.Modified, unexpectedMove); err == nil {
		t.Fatal("accepted a different source")
	}
	token, err := l.UnlockVault(root, "123456", true)
	if err != nil {
		t.Fatal(err)
	}
	if err := l.SetPrivate(root, token, []string{x.ID}, true); err != nil {
		t.Fatal(err)
	}
	if err := l.Trash(root, x.ID, x.Size, x.Modified, unexpectedMove); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("trash without vault token: %v", err)
	}
	failure := errors.New("trash unavailable")
	before := l.Status().Updated
	if err := l.Trash(root, x.ID, x.Size, x.Modified, func(string) error { return failure }, token); !errors.Is(err, failure) {
		t.Fatalf("trash failure: %v", err)
	}
	if _, err := l.Item(x.ID, token); err != nil || l.Status().Updated != before {
		t.Fatal("trash failure changed the catalog")
	}
	if err := l.Trash(root, x.ID, x.Size, x.Modified, move, token); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(x.Path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("source still exists: %v", err)
	}
	if contents, err := os.ReadFile(filepath.Join(trash, x.Name)); err != nil || string(contents) != x.Name {
		t.Fatalf("original not preserved in trash: %q, %v", contents, err)
	}
	if _, err := l.Item(x.ID, token); !errors.Is(err, os.ErrNotExist) || l.Status().Updated <= before {
		t.Fatal("trashed file remains indexed")
	}
	for range 2 {
		if got := l.List(Query{Thumbs: true}); got.Total != 1 || got.Items[0].Name != "other.txt" {
			t.Fatalf("unexpected public catalog: %+v", got)
		}
		scan()
	}
}
