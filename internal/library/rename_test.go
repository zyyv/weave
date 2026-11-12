package library

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestRenamePrivateFilePreservesMarksAndProtection(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	for _, name := range []string{"photo.JPG", "photo_thumb.jpg", "taken.JPG", "private.jpg", "private_thumb.jpg"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	l, err := New(root, data)
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
	id := pathID(filepath.Join(root, "private.jpg"))
	item, err := l.Item(id)
	if err != nil {
		t.Fatal(err)
	}
	mark := Mark{Star: true, Tags: "red"}
	if err := l.Mark(id, mark); err != nil {
		t.Fatal(err)
	}
	if err := l.SetPrivate(root, token, []string{id}, true); err != nil {
		t.Fatal(err)
	}
	publicID := pathID(filepath.Join(root, "photo.JPG"))
	public, err := l.Item(publicID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Rename(root, public.ID, "taken", public.Size, public.Modified); err == nil {
		t.Fatal("overwrote an existing filename")
	}
	caseChanged, err := l.Rename(root, public.ID, "Photo", public.Size, public.Modified)
	if err != nil || caseChanged.Name != "Photo.JPG" {
		t.Fatalf("case-only rename: %+v, %v", caseChanged, err)
	}
	renamed, err := l.Rename(root, item.ID, "edited.version", item.Size, item.Modified, token)
	if err != nil {
		t.Fatal(err)
	}
	if renamed.Name != "edited.version.jpg" || renamed.ID == item.ID || !renamed.PrivateEntry || !renamed.Star || renamed.Tags != mark.Tags {
		t.Fatalf("unexpected renamed item: %+v", renamed)
	}
	reloaded, err := New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	if err := reloaded.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, reloaded)
	for _, hidden := range []string{renamed.ID, item.Preview} {
		if _, err := reloaded.Item(hidden); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("private resource became public: %v", err)
		}
	}
	token, err = reloaded.UnlockVault(root, "123456", false)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := reloaded.Item(renamed.ID, token)
	if err != nil || !saved.Star || saved.Tags != mark.Tags {
		t.Fatalf("marks were not persisted: %+v, %v", saved, err)
	}
}
