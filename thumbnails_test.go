package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
	"weave/internal/library"
)

func TestThumbnailBoundsAndInvalidFile(t *testing.T) {
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
			if w.Code != 415 {
				t.Fatalf("invalid image was accepted: %d", w.Code)
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

// Exercise the real native downsampler with every EXIF transform. Comparing
// colored quadrants catches both double rotation and lost mirrored directions.
func TestThumbnailEXIFAndLargeSources(t *testing.T) {
	root, data := t.TempDir(), t.TempDir()
	img := image.NewRGBA(image.Rect(0, 0, 120, 80))
	colors := []color.RGBA{{240, 10, 10, 255}, {10, 240, 10, 255}, {10, 10, 240, 255}, {240, 240, 10, 255}}
	for y := 0; y < 80; y++ {
		for x := 0; x < 120; x++ {
			img.Set(x, y, colors[(y/40)*2+x/60])
		}
	}
	var encoded bytes.Buffer
	if err := jpeg.Encode(&encoded, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	originals := map[string][]byte{}
	for orientation := 1; orientation <= 8; orientation++ {
		exif := []byte{'E', 'x', 'i', 'f', 0, 0, 'I', 'I', 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 1, 3, 0, 1, 0, 0, 0, byte(orientation), 0, 0, 0, 0, 0, 0, 0}
		body := append([]byte{255, 216, 255, 225, 0, byte(len(exif) + 2)}, exif...)
		body = append(body, encoded.Bytes()[2:]...)
		// Valid JPEG with trailing bytes exceeded the previous encoded-size guard.
		if orientation == 1 {
			body = append(body, make([]byte, 13*1024*1024)...)
		}
		name := fmt.Sprintf("direction-%d.jpg", orientation)
		originals[name] = body
		if err := os.WriteFile(filepath.Join(root, name), body, 0600); err != nil {
			t.Fatal(err)
		}
	}
	transparent := image.NewNRGBA(image.Rect(0, 0, 100, 100))
	var alpha bytes.Buffer
	png.Encode(&alpha, transparent)
	os.WriteFile(filepath.Join(root, "transparent.png"), alpha.Bytes(), 0600)
	// A highly compressible photo over the former 24 MP rejection threshold.
	var big bytes.Buffer
	jpeg.Encode(&big, image.NewGray(image.Rect(0, 0, 6000, 4200)), nil)
	os.WriteFile(filepath.Join(root, "large.jpg"), big.Bytes(), 0600)
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
	expected := [][4]int{{}, {0, 1, 2, 3}, {1, 0, 3, 2}, {3, 2, 1, 0}, {2, 3, 0, 1}, {0, 2, 1, 3}, {2, 0, 3, 1}, {3, 1, 2, 0}, {1, 3, 0, 2}}
	for _, item := range lib.List(library.Query{}).Items {
		w := httptest.NewRecorder()
		newThumbnailCache().serve(w, httptest.NewRequest("GET", "/thumb/"+item.ID, nil), lib, item.ID)
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", item.Name, w.Code, w.Body.String())
		}
		out, _, err := image.Decode(w.Body)
		if err != nil {
			t.Fatal(err)
		}
		b := out.Bounds()
		if b.Dx() > 384 || b.Dy() > 240 {
			t.Fatalf("unbounded: %v", b)
		}
		if item.Name == "transparent.png" {
			_, _, _, a := out.At(10, 10).RGBA()
			if a != 0 {
				t.Fatal("transparency lost")
			}
			continue
		}
		var orientation int
		if _, err := fmt.Sscanf(item.Name, "direction-%d.jpg", &orientation); err != nil {
			continue
		}
		if (orientation >= 5) != (b.Dy() > b.Dx()) {
			t.Fatalf("orientation %d dimensions: %v", orientation, b)
		}
		for q, want := range expected[orientation] {
			c := color.RGBAModel.Convert(out.At(b.Dx()*(1+2*(q%2))/4, b.Dy()*(1+2*(q/2))/4)).(color.RGBA)
			target := colors[want]
			if absInt(int(c.R)-int(target.R)) > 30 || absInt(int(c.G)-int(target.G)) > 30 || absInt(int(c.B)-int(target.B)) > 30 {
				t.Fatalf("orientation %d quadrant %d: %v want %v", orientation, q, c, target)
			}
		}
		after, err := os.ReadFile(item.Path)
		if err != nil || !bytes.Equal(after, originals[item.Name]) {
			t.Fatalf("source modified: %s", item.Name)
		}
	}
}
func absInt(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func TestEmbeddedRAWPreview(t *testing.T) {
	var encoded bytes.Buffer
	if err := jpeg.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 96, 48)), nil); err != nil {
		t.Fatal(err)
	}
	const previewOffset = 64
	data := make([]byte, previewOffset)
	copy(data, "II\x2a\x00")
	order := binary.LittleEndian
	order.PutUint32(data[4:], 8)
	order.PutUint16(data[8:], 2)
	for i, value := range []uint32{previewOffset, uint32(encoded.Len())} {
		entry := data[10+12*i:]
		order.PutUint16(entry, uint16(513+i))
		order.PutUint16(entry[2:], 4)
		order.PutUint32(entry[4:], 1)
		order.PutUint32(entry[8:], value)
	}
	data = append(data, encoded.Bytes()...)
	preview := embeddedRAWPreview(bytes.NewReader(data), data[:previewOffset], 48)
	if preview == nil || preview.Bounds() != image.Rect(0, 0, 48, 24) {
		t.Fatalf("unexpected embedded preview: %v", preview)
	}

	order.PutUint32(data[18:], uint32(len(data)))
	if preview := embeddedRAWPreview(bytes.NewReader(data), data[:previewOffset], 48); preview != nil {
		t.Fatal("accepted a JPEG offset outside the source")
	}
}
