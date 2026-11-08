package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"math"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
	"weave/internal/library"
)

func TestHistogramChannelsAndTransparency(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 4, 1))
	for x, c := range []color.NRGBA{{255, 0, 0, 255}, {0, 255, 0, 255}, {0, 0, 255, 0}, {255, 255, 255, 128}} {
		src.SetNRGBA(x, 0, c)
	}
	got := histogramForImage(src)
	half := 128.0 / 255
	if got.Total != 2+half || got.Channels[0][255] != 1+half || got.Channels[1][255] != 1+half || got.Channels[2][255] != half || got.Channels[3][54] != 1 {
		t.Fatalf("incorrect histogram: %+v", got)
	}
	for _, channel := range got.Channels {
		sum := 0.0
		for _, n := range channel {
			sum += n
		}
		if math.Abs(sum-got.Total) > 1e-9 {
			t.Fatal("channel totals differ")
		}
	}
}
func TestHistogramEndpointCacheAndNativeFallback(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	img := image.NewNRGBA(image.Rect(0, 0, 8, 8))
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			img.SetNRGBA(x, y, color.NRGBA{255, 0, 0, 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(root, "photo.png"), encoded.Bytes(), 0600)
	os.WriteFile(filepath.Join(root, "note.txt"), []byte("test"), 0600)
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
	for _, item := range lib.List(library.Query{}).Items {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/api/histogram?id="+item.ID, nil)
		cache.serveHistogram(w, r, lib, item.ID)
		if item.Kind != "image" {
			if w.Code != 404 {
				t.Fatalf("non-image accepted: %d", w.Code)
			}
			continue
		}
		if w.Code != 200 {
			t.Fatalf("native histogram failed: %d", w.Code)
		}
		var result imageHistogram
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Total <= 0 || result.Channels[0][255] != result.Total || result.Channels[1][0] != result.Total {
			t.Fatal("native image samples missing")
		}
		cache.values[thumbnailKey(item)] = encoded.Bytes()
		os.Remove(item.Path)
		cached := httptest.NewRecorder()
		cache.serveHistogram(cached, r, lib, item.ID)
		if cached.Code != 200 {
			t.Fatal("cached histogram reopened original")
		}
		json.Unmarshal(cached.Body.Bytes(), &result)
		if result.Total != 64 || result.Channels[0][255] != 64 {
			t.Fatal("cached histogram incorrect")
		}
	}
	missing := httptest.NewRecorder()
	cache.serveHistogram(missing, httptest.NewRequest("GET", "/api/histogram?id=missing", nil), lib, "missing")
	if missing.Code != 404 {
		t.Fatal("missing id accepted")
	}
}
