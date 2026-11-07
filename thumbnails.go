package main

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"sync"
	"weave/internal/library"
)

// The list never decodes original photographs in the WebView.
// Bound both decoded pixel count and server concurrency, and cache only small JPEGs.
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
	return t.values[key]
}
func (t *thumbnailCache) serve(w http.ResponseWriter, r *http.Request, lib *library.Library, id string) {
	x, err := lib.Item(id)
	if err != nil || x.Kind != "image" {
		http.NotFound(w, r)
		return
	}
	key := fmt.Sprintf("%s:%d:%d", id, x.Modified, x.Size)
	send := func(data []byte) {
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "private, max-age=3600")
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
	if x.Size > 12*1024*1024 {
		http.Error(w, "封面过大，请打开详情预览", http.StatusRequestEntityTooLarge)
		return
	}
	f, _, err := lib.Open(id)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	config, _, err := image.DecodeConfig(io.LimitReader(f, 512*1024))
	if err != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 24_000_000 {
		http.Error(w, "封面暂不可用", 415)
		return
	}
	f.Seek(0, 0)
	src, _, err := image.Decode(io.LimitReader(f, 12*1024*1024))
	if err != nil {
		http.Error(w, "封面暂不可用", 415)
		return
	}
	if r.Context().Err() != nil {
		return
	}
	width, height := config.Width, config.Height
	scale := min(1.0, min(384.0/float64(width), 240.0/float64(height)))
	width = max(1, int(float64(width)*scale))
	height = max(1, int(float64(height)*scale))
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	bounds := src.Bounds()
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			dst.Set(x, y, src.At(bounds.Min.X+x*bounds.Dx()/width, bounds.Min.Y+y*bounds.Dy()/height))
		}
	}
	var buf bytes.Buffer
	if jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 78}) != nil {
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
