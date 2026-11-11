package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"os/exec"
	"slices"
	"sync"
	"time"
	"weave/internal/library"
)

// Decode/downsample with macOS ImageIO via sips; originals are read-only.
// Bound process concurrency and cache only small, orientation-correct PNGs.
type thumbnailCache struct {
	mu     sync.Mutex
	values map[string][]byte
	keys   []string
	slots  chan struct{}
}

func newThumbnailCache() *thumbnailCache {
	return &thumbnailCache{values: map[string][]byte{}, slots: make(chan struct{}, 2)}
}
func (t *thumbnailCache) get(key string) []byte {
	t.mu.Lock()
	defer t.mu.Unlock()
	data := t.values[key]
	// Keep recently revisited covers resident when scrolling through a large catalog.
	if data == nil {
		return nil
	}
	if index := slices.Index(t.keys, key); index >= 0 && index < len(t.keys)-1 {
		copy(t.keys[index:], t.keys[index+1:])
		t.keys[len(t.keys)-1] = key
	}
	return data
}
func (t *thumbnailCache) serve(w http.ResponseWriter, r *http.Request, lib *library.Library, id string) {
	x, err := lib.Item(id, vaultCookie(r))
	if err != nil || x.Kind != "image" {
		http.NotFound(w, r)
		return
	}
	key := thumbnailKey(x)
	send := func(data []byte) {
		if _, err := lib.Item(id, vaultCookie(r)); err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(data)
	}
	if data := t.get(key); data != nil {
		send(data)
		return
	}
	select {
	case t.slots <- struct{}{}:
		defer func() { <-t.slots }()
	case <-r.Context().Done():
		return
	}
	if data := t.get(key); data != nil {
		send(data)
		return
	}
	if r.Context().Err() != nil {
		return
	}
	// Open through the library to validate the resource before passing its path to sips.
	f, _, err := lib.Open(id, vaultCookie(r))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	f.Close()
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	src, orientation, err := nativeThumbnail(ctx, x.Path)
	if err != nil {
		http.Error(w, "封面暂不可用", http.StatusUnsupportedMediaType)
		return
	}
	if r.Context().Err() != nil {
		return
	}
	bounds := src.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	scale := min(1.0, min(384.0/float64(width), 240.0/float64(height)))
	if orientation >= 5 {
		scale = min(1.0, min(240.0/float64(width), 384.0/float64(height)))
	}
	width = max(1, int(float64(width)*scale))
	height = max(1, int(float64(height)*scale))
	var buf bytes.Buffer
	if png.Encode(&buf, orientedImage(src, width, height, orientation)) != nil {
		http.Error(w, "封面生成失败", 500)
		return
	}
	data := buf.Bytes()
	t.mu.Lock()
	if _, exists := t.values[key]; !exists {
		if len(t.keys) >= 128 {
			delete(t.values, t.keys[0])
			t.keys = t.keys[1:]
		}
		t.keys = append(t.keys, key)
	}
	t.values[key] = data
	t.mu.Unlock()
	send(data)
}

func orientedImage(src image.Image, width, height, orientation int) image.Image {
	bounds := src.Bounds()
	outWidth, outHeight := width, height
	if orientation >= 5 {
		outWidth, outHeight = height, width
	}
	dst := image.NewNRGBA(image.Rect(0, 0, outWidth, outHeight))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			dx, dy := x, y
			switch orientation {
			case 2:
				dx = width - 1 - x
			case 3:
				dx, dy = width-1-x, height-1-y
			case 4:
				dy = height - 1 - y
			case 5:
				dx, dy = y, x
			case 6:
				dx, dy = height-1-y, x
			case 7:
				dx, dy = height-1-y, width-1-x
			case 8:
				dx, dy = y, width-1-x
			}
			dst.Set(dx, dy, src.At(bounds.Min.X+x*bounds.Dx()/width, bounds.Min.Y+y*bounds.Dy()/height))
		}
	}
	return dst
}

// sips writes only to a private temporary output, never to the source path.
func nativeThumbnail(ctx context.Context, path string) (image.Image, int, error) {
	orientation := 1
	if f, err := os.Open(path); err == nil {
		header, _ := io.ReadAll(io.LimitReader(f, 1024*1024))
		f.Close()
		orientation = imageOrientation(header)
	}
	dir, err := os.MkdirTemp("", "weave-thumb-")
	if err != nil {
		return nil, 0, err
	}
	defer os.RemoveAll(dir)
	output := dir + "/preview.png"
	// sips preserves the stored pixel direction; apply EXIF once ourselves below.
	if err := exec.CommandContext(ctx, "/usr/bin/sips", "-Z", "384", "-s", "format", "png", path, "--out", output).Run(); err != nil {
		return nil, 0, err
	}
	data, err := os.ReadFile(output)
	if err != nil {
		return nil, 0, err
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width > 384 || cfg.Height > 384 {
		return nil, 0, fmt.Errorf("invalid thumbnail dimensions")
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	return img, orientation, err
}

// EXIF is presentation metadata. Read it before conversion, because sips drops
// the tag while leaving JPEG pixels in their stored direction.
func imageOrientation(data []byte) int {
	if len(data) > 2 && data[0] == 0xff && data[1] == 0xd8 {
		for pos := 2; pos+4 <= len(data); {
			if data[pos] != 0xff {
				break
			}
			marker := data[pos+1]
			pos += 2
			if marker == 0xda || marker == 0xd9 {
				break
			}
			if marker == 0xff {
				pos--
				continue
			}
			if marker == 1 || marker >= 0xd0 && marker <= 0xd7 {
				continue
			}
			size := int(binary.BigEndian.Uint16(data[pos : pos+2]))
			if size < 2 || pos+size > len(data) {
				break
			}
			segment := data[pos+2 : pos+size]
			if marker == 0xe1 && bytes.HasPrefix(segment, []byte("Exif\x00\x00")) {
				return tiffOrientation(segment[6:])
			}
			pos += size
		}
	}
	if bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) {
		for pos := 8; pos+12 <= len(data); {
			size := uint64(binary.BigEndian.Uint32(data[pos : pos+4]))
			if size > uint64(len(data)-pos-12) {
				break
			}
			end := pos + 8 + int(size)
			if string(data[pos+4:pos+8]) == "eXIf" {
				return tiffOrientation(data[pos+8 : end])
			}
			pos = end + 4
		}
	}
	return 1
}
func tiffOrientation(data []byte) int {
	if len(data) < 8 {
		return 1
	}
	var order binary.ByteOrder
	switch string(data[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 1
	}
	if order.Uint16(data[2:4]) != 42 {
		return 1
	}
	offset := uint64(order.Uint32(data[4:8]))
	if offset+2 > uint64(len(data)) {
		return 1
	}
	count := int(order.Uint16(data[offset : offset+2]))
	pos := int(offset) + 2
	for i := 0; i < count && pos+12 <= len(data); i++ {
		entry := data[pos : pos+12]
		if order.Uint16(entry[:2]) == 274 && order.Uint16(entry[2:4]) == 3 && order.Uint32(entry[4:8]) == 1 {
			n := int(order.Uint16(entry[8:10]))
			if n >= 1 && n <= 8 {
				return n
			}
			return 1
		}
		pos += 12
	}
	return 1
}

func thumbnailKey(item library.Item) string {
	return fmt.Sprintf("v2:%s:%d:%d", item.ID, item.Modified, item.Size)
}
