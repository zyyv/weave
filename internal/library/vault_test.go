package library

import (
	"os"
	"path/filepath"
	"testing"
)

func TestVaultHidesFilesAndFoldersAcrossCatalogs(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	folder := filepath.Join(root, "private")
	if err := os.Mkdir(folder, 0700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"public.txt", "private/image.jpg", "private/image_thumb.jpg", "single.jpg", "single_thumb.jpg"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(name), 0600); err != nil {
			t.Fatal(err)
		}
	}
	l, err := New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	scan := func(l *Library, path string) string {
		t.Helper()
		if err := l.Scan(path); err != nil {
			t.Fatal(err)
		}
		waitScan(t, l)
		return l.Status().Root
	}
	root = scan(l, root)
	items := l.List(Query{Thumbs: true})
	ids := map[string]string{}
	for _, item := range items.Items {
		ids[item.Name] = item.ID
	}
	token, err := l.UnlockVault(root, "123456", true)
	if err != nil {
		t.Fatal(err)
	}
	if err = l.SetPrivate(root, token, []string{"folder:private", ids["single.jpg"]}, true); err != nil {
		t.Fatal(err)
	}
	l.LockVault(token)
	if got := l.List(Query{Thumbs: true}); got.Total != 1 || got.Items[0].Name != "public.txt" {
		t.Fatalf("public catalog leaked private entries: %+v", got)
	}
	if got := l.Browse(Query{}, "private"); got.Total != 0 {
		t.Fatalf("public browse leaked a private folder: %+v", got)
	}
	for _, q := range []Query{{Thumbs: true}, {Thumbs: true, Search: "image"}} {
		if got := l.Scopes(q); got.Resources > 1 {
			t.Fatalf("conversation summary leaked private files: %+v", got)
		}
	}
	for _, name := range []string{"image.jpg", "image_thumb.jpg", "single.jpg", "single_thumb.jpg"} {
		if f, _, err := l.Open(ids[name], token); err == nil {
			f.Close()
			t.Fatalf("locked vault opened %s", name)
		}
	}
	if _, err := l.UnlockVault(root, "000000", false); err == nil {
		t.Fatal("accepted an incorrect PIN")
	}
	token, err = l.UnlockVault(root, "123456", false)
	if err != nil {
		t.Fatal(err)
	}
	private := Query{Private: true, VaultToken: token, Thumbs: true}
	if got := l.Browse(private, ""); got.Total != 3 {
		t.Fatalf("expected folder, file and its companion: %+v", got)
	}
	if got := l.Browse(private, "private"); !got.FolderPrivateEntry || got.Total != 2 {
		t.Fatalf("expected an explicitly private folder with two files: %+v", got)
	}
	if err := l.SetPrivate(root, "", []string{"folder:private"}, false); err == nil {
		t.Fatal("restored a folder without unlocking")
	}
	scan(l, folder)
	if l.Status(token).VaultUnlocked || l.Status().Total != 0 || l.List(Query{Thumbs: true}).Total != 0 {
		t.Fatal("opening a nested directory bypassed the owning vault")
	}
	l, err = New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	scan(l, root)
	if st := l.Status(token); !st.VaultConfigured || st.VaultUnlocked || st.Total != 1 {
		t.Fatalf("restart did not preserve locked privacy: %+v", st)
	}
	token, err = l.UnlockVault(root, "123456", false)
	if err != nil {
		t.Fatal(err)
	}
	if err := l.SetPrivate(root, token, []string{"folder:private"}, false); err != nil {
		t.Fatal(err)
	}
	if got := l.Browse(Query{Thumbs: true}, "private"); got.Total != 2 {
		t.Fatalf("restored folder did not return to the library: %+v", got)
	}
}
