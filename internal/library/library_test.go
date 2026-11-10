package library

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func waitScan(t *testing.T, l *Library) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for l.Status().Scanning {
		if time.Now().After(deadline) {
			t.Fatal("scan did not finish")
		}
		runtime.Gosched()
	}
}
func TestScanRequiresResourceDirectory(t *testing.T) {
	l, err := New("", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = l.Scan(""); err == nil {
		t.Fatal("empty root must not scan the working directory")
	}
	if status := l.Status(); status.Scanning || status.Total != 0 || status.Root != "" {
		t.Fatalf("unexpected scan without a resource directory: %+v", status)
	}
}

func TestLibraryWorkflow(t *testing.T) {
	root := t.TempDir()
	data := t.TempDir()
	folder := filepath.Join(root, "session", "Image")
	os.MkdirAll(folder, 0700)
	for name, body := range map[string]string{"42.pic.jpg": "original", "42.pic_thumb.jpg": "thumb", "notes.txt": "hello", ".hidden": "hidden"} {
		if e := os.WriteFile(filepath.Join(folder, name), []byte(body), 0600); e != nil {
			t.Fatal(e)
		}
	}
	os.Symlink("/etc/hosts", filepath.Join(folder, "outside.txt"))
	l, e := New(root, data)
	if e != nil {
		t.Fatal(e)
	}
	if e = l.Scan(root); e != nil {
		t.Fatal(e)
	}
	waitScan(t, l)
	if l.Status().Total != 3 {
		t.Fatalf("unexpected scan: %+v", l.Status())
	}
	r := l.List(Query{Kind: "image"})
	if r.Total != 1 || len(r.Items) != 1 {
		t.Fatalf("thumbnail dedup failed: %+v", r)
	}
	x := r.Items[0]
	if x.Preview == x.ID || x.Preview == "" {
		t.Fatal("thumbnail not paired")
	}
	if e = l.Mark(x.ID, Mark{Star: true, Tags: "工作,灵感"}); e != nil {
		t.Fatal(e)
	}
	if l.List(Query{Star: true, Search: "灵感"}).Total != 1 {
		t.Fatal("tag and favorite search failed")
	}
	l2, e := New(root, data)
	if e != nil {
		t.Fatal(e)
	}
	l2.Scan(root)
	waitScan(t, l2)
	if l2.List(Query{Star: true}).Total != 1 {
		t.Fatal("marks lost on restart")
	}
	dest := t.TempDir()
	if n, e := l.Export([]string{x.ID}, dest); e != nil || n != 1 {
		t.Fatalf("export: %d %v", n, e)
	}
	if _, e = l.Export([]string{x.ID}, dest); e == nil {
		t.Fatal("export overwrote existing file")
	}
	b, _ := os.ReadFile(x.Path)
	if string(b) != "original" {
		t.Fatal("source changed")
	}
	os.Remove(x.Path)
	os.Symlink("/etc/hosts", x.Path)
	if f, _, e := l.Open(x.ID); e == nil {
		f.Close()
		t.Fatal("replaced symlink was accepted")
	}
	if l.List(Query{Thumbs: true, Offset: 1, Limit: 1}).Total != 3 || len(l.List(Query{Thumbs: true, Offset: 1, Limit: 1}).Items) != 1 {
		t.Fatal("pagination failed")
	}
	if _, e := l.Item("../../etc/hosts"); e == nil {
		t.Fatal("unindexed path accepted")
	}
}
func TestScopesReconcileAndContactSearch(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	for _, group := range []string{"a", "b"} {
		os.MkdirAll(filepath.Join(root, group), 0700)
		for _, name := range []string{"one.jpg", "one_thumb.jpg", "voice.silk"} {
			os.WriteFile(filepath.Join(root, group, name), []byte("1234"), 0600)
		}
	}
	l, e := New(root, data)
	if e != nil {
		t.Fatal(e)
	}
	l.Scan(root)
	waitScan(t, l)
	q := Query{Names: map[string]string{"a": "家人 account_test"}}
	gs := l.Scopes(q)
	if gs.Total != 2 || gs.Resources != 4 || gs.Bytes != 16 {
		t.Fatalf("groups must reconcile after thumbnails filtered: %+v", gs)
	}
	sum := 0
	for _, g := range gs.Items {
		sum += g.Count
		if g.Counts["audio"] != 1 || g.Counts["image"] != 1 {
			t.Fatalf("wrong group type counts: %+v", g)
		}
	}
	if sum != gs.Resources {
		t.Fatal("group counts do not reconcile")
	}
	q.Search = "家人"
	if l.List(q).Total != 2 || l.Scopes(q).Total != 1 {
		t.Fatal("contact search did not filter resource and group views")
	}
	q.Search = ""
	q.Thumbs = true
	if l.Scopes(q).Resources != 6 {
		t.Fatal("thumbnail setting not applied to groups")
	}
}

func TestScopeBatchContinuation(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	for i := 0; i < 31; i++ {
		dir := filepath.Join(root, fmt.Sprintf("group-%02d", i))
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "image.jpg"), []byte("image"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	lib, err := New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	if err := lib.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, lib)
	first := lib.Scopes(Query{Limit: 20})
	second := lib.Scopes(Query{Offset: 20, Limit: 20})
	if first.Total != 31 || len(first.Items) != 20 || len(second.Items) != 11 {
		t.Fatalf("wrong continuation sizes: %d, %d, %d", first.Total, len(first.Items), len(second.Items))
	}
	seen := map[string]bool{}
	for _, batch := range []Scopes{first, second} {
		for _, scope := range batch.Items {
			if seen[scope.Hash] {
				t.Fatalf("duplicate scope %s", scope.Hash)
			}
			seen[scope.Hash] = true
		}
	}
	if len(seen) != first.Total {
		t.Fatal("continuation lost scopes")
	}
}

func TestIndexedSortFiltersAndInvalidation(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	for _, v := range []struct{ group, name, body string }{{"a", "small.jpg", "a"}, {"a", "large.mp4", "123456789"}, {"a", "voice.silk", "abc"}, {"b", "note.txt", "12345"}} {
		dir := filepath.Join(root, v.group)
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, v.name), []byte(v.body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	lib, err := New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	lib.Scan(root)
	waitScan(t, lib)
	q := Query{Sort: "size", Kind: "image,video", Group: "a", Limit: 1}
	first := lib.List(q)
	if first.Total != 2 || first.Bytes != 10 || first.Items[0].Kind != "video" {
		t.Fatalf("indexed OR filter wrong: %+v", first)
	}
	q.Offset = 1
	second := lib.List(q)
	if len(second.Items) != 1 || second.Items[0].Kind != "image" {
		t.Fatal("cached continuation lost order")
	}
	groups := lib.Scopes(Query{Sort: "size", Kind: "image,audio"})
	if groups.Total != 1 || groups.Resources != 2 || groups.Bytes != 4 {
		t.Fatalf("summary OR filter wrong: %+v", groups)
	}
	if got := lib.Scopes(Query{Sort: "size"}); got.Items[0].Hash != "a" || got.Items[0].Bytes != 13 {
		t.Fatalf("summary byte ordering wrong: %+v", got)
	}
	if got := lib.List(Query{Star: true}); got.Total != 0 {
		t.Fatal("unexpected initial favorites")
	}
	if err := lib.Mark(first.Items[0].ID, Mark{Star: true, Tags: "新标签"}); err != nil {
		t.Fatal(err)
	}
	if got := lib.List(Query{Star: true, Search: "新标签"}); got.Total != 1 || !got.Items[0].Star {
		t.Fatal("mark did not invalidate cached filters")
	}
	if got := lib.Scopes(Query{Star: true, Search: "新标签"}); got.Resources != 1 || got.Bytes != 9 {
		t.Fatal("filtered summary did not use marks")
	}
	if err := os.WriteFile(filepath.Join(root, "b", "new.jpg"), []byte("new"), 0600); err != nil {
		t.Fatal(err)
	}
	lib.Scan(root)
	waitScan(t, lib)
	if got := lib.List(Query{Sort: "size"}); got.Total != 5 {
		t.Fatal("scan did not invalidate indexes")
	}
}

func TestListModifiedDateRange(t *testing.T) {
	root := t.TempDir()
	start := time.Date(2025, 3, 9, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 1)
	for name, modified := range map[string]time.Time{
		"before.txt": start.Add(-time.Millisecond),
		"start.txt":  start,
		"last.txt":   end.Add(-time.Millisecond),
		"end.txt":    end,
	} {
		file := filepath.Join(root, name)
		if err := os.WriteFile(file, []byte("x"), 0600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(file, modified, modified); err != nil {
			t.Fatal(err)
		}
	}
	lib, err := New(root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := lib.Scan(root); err != nil {
		t.Fatal(err)
	}
	waitScan(t, lib)

	from, before := start.UnixMilli(), end.UnixMilli()
	query := Query{ModifiedFrom: &from, ModifiedBefore: &before, Limit: 1}
	got := lib.List(query)
	if got.Total != 2 || got.Bytes != 2 || len(got.Items) != 1 || got.Items[0].Name != "last.txt" {
		t.Fatalf("first filtered page: %+v", got)
	}
	query.Offset = 1
	got = lib.List(query)
	if got.Total != 2 || len(got.Items) != 1 || got.Items[0].Name != "start.txt" {
		t.Fatalf("second filtered page: %+v", got)
	}
	query.Offset, query.ModifiedBefore = 0, nil
	got = lib.List(query)
	if got.Total != 3 || len(got.Items) != 1 || got.Items[0].Name != "end.txt" {
		t.Fatalf("open-ended range: %+v", got)
	}
}

func BenchmarkScopeSizeMetadata(b *testing.B) {
	lib := &Library{marks: map[string]Mark{}}
	for i := 0; i < 160000; i++ {
		lib.items = append(lib.items, Item{ID: fmt.Sprint(i), Group: fmt.Sprintf("g%03d", i%200), Kind: "image", Name: "large.jpg", Size: int64(i) * 1024 * 1024, Modified: int64(i)})
	}
	lib.index = buildIndex(lib.items)
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		lib.Scopes(Query{Sort: "size", Limit: 24})
	}
}

func TestScopeCoversFollowMediaFilters(t *testing.T) {
	lib := &Library{marks: map[string]Mark{}}
	lib.items = []Item{
		{ID: "video-no-thumb", Group: "a", Kind: "video", Name: "clip.mp4", Modified: 4},
		{ID: "image", Group: "a", Kind: "image", Name: "photo.jpg", Preview: "image-thumb", Modified: 3},
		{ID: "video-with-thumb", Group: "a", Kind: "video", Name: "clip2.mp4", Preview: "video-thumb", Modified: 2},
		{ID: "audio", Group: "a", Kind: "audio", Name: "voice.silk", Modified: 1},
	}
	lib.index = buildIndex(lib.items)
	for _, item := range lib.items {
		lib.marks[item.ID] = Mark{Star: true}
	}
	// Exercise both the indexed summaries and the search/favorites aggregation.
	for _, filter := range []Query{{}, {Search: "."}, {Star: true}} {
		for _, kind := range []string{"image", "video", "image,video"} {
			q := filter
			q.Kind = kind
			scopes := lib.Scopes(q)
			if scopes.Total != 1 {
				t.Fatalf("missing scope for %+v: %+v", q, scopes)
			}
			covers := scopes.Items[0].Covers
			want := 3
			if kind == "image" {
				want = 1
			}
			if kind == "video" {
				want = 2
			}
			if len(covers) != want {
				t.Fatalf("wrong cover count for %+v: %+v", q, covers)
			}
			for _, cover := range covers {
				if !kindsFor(kind)[cover.Kind] || cover.ID == "" || cover.Modified == 0 {
					t.Fatalf("cover outside filter or missing metadata: %+v", cover)
				}
				if cover.ID == "video-no-thumb" && cover.Preview != "" {
					t.Fatalf("unpaired video should be captured by ID: %+v", cover)
				}
				if cover.ID == "image" && cover.Preview != "image-thumb" {
					t.Fatalf("image lost paired thumbnail: %+v", cover)
				}
			}
		}
	}
}
