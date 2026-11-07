package main

import (
	"image"
	"image/color"
	"image/jpeg"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
	"weave/internal/library"
)

func TestThumbnailBoundsAndLargeFileGuard(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	img := image.NewRGBA(image.Rect(0, 0, 1200, 800))
	for y := 0; y < 800; y++ {
		for x := 0; x < 1200; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 255), uint8(y % 255), 80, 255})
		}
	}
	f, err := os.Create(filepath.Join(root, "photo.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	jpeg.Encode(f, img, &jpeg.Options{Quality: 85})
	f.Close()
	huge, err := os.Create(filepath.Join(root, "huge.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	if err = huge.Truncate(256 * 1024 * 1024); err != nil {
		t.Fatal(err)
	}
	huge.Close()
	lib, err := library.New(root, data)
	if err != nil {
		t.Fatal(err)
	}
	lib.Scan(root)
	deadline := time.Now().Add(10 * time.Second)
	for lib.Status().Scanning {
		if time.Now().After(deadline) {
			t.Fatal("scan timeout")
		}
		runtime.Gosched()
	}
	cache := newThumbnailCache()
	items := lib.List(library.Query{}).Items
	for _, item := range items {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/thumb/"+item.ID, nil)
		cache.serve(w, r, lib, item.ID)
		if item.Name == "huge.jpg" {
			if w.Code != 413 {
				t.Fatalf("huge file was decoded: %d", w.Code)
			}
			continue
		}
		if w.Code != 200 {
			t.Fatalf("thumbnail failed: %d", w.Code)
		}
		out, _, err := image.DecodeConfig(w.Body)
		if err != nil {
			t.Fatal(err)
		}
		if out.Width > 384 || out.Height > 240 {
			t.Fatalf("unbounded thumbnail: %+v", out)
		}
		// Cached request survives source removal: no original file is reopened.
		os.Remove(item.Path)
		second := httptest.NewRecorder()
		cache.serve(second, r, lib, item.ID)
		if second.Code != 200 {
			t.Fatal("thumbnail cache missed")
		}
	}
}
