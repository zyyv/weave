package main

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"math"
	"net/http"
	"time"
	"weave/internal/library"
)

type imageHistogram struct {
	Channels [4][256]float64 `json:"channels"`
	Total    float64         `json:"total"`
}

// Statistics come from the same bounded, locally decoded thumbnail used by the
// list. This avoids large original-sized buffers and WebKit canvas readback.
func histogramForImage(src image.Image) imageHistogram {
	var result imageHistogram
	bounds := src.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := color.NRGBAModel.Convert(src.At(x, y)).(color.NRGBA)
			if c.A == 0 {
				continue
			}
			weight := float64(c.A) / 255
			result.Channels[0][c.R] += weight
			result.Channels[1][c.G] += weight
			result.Channels[2][c.B] += weight
			luma := int(math.Round(.2126*float64(c.R) + .7152*float64(c.G) + .0722*float64(c.B)))
			result.Channels[3][luma] += weight
			result.Total += weight
		}
	}
	return result
}
func (t *thumbnailCache) serveHistogram(w http.ResponseWriter, r *http.Request, lib *library.Library, id string) {
	item, err := lib.Item(id, vaultCookie(r))
	if err != nil || item.Kind != "image" {
		http.NotFound(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	select {
	case t.slots <- struct{}{}:
		defer func() { <-t.slots }()
	case <-ctx.Done():
		return
	}
	var src image.Image
	if data := t.get(thumbnailKey(item)); data != nil {
		src, _, err = image.Decode(bytes.NewReader(data))
	} else {
		f, _, openErr := lib.Open(id, vaultCookie(r))
		if openErr != nil {
			http.NotFound(w, r)
			return
		}
		f.Close()
		src, _, err = nativeThumbnail(ctx, item.Path)
	}
	if err != nil {
		http.Error(w, "histogram unavailable", http.StatusUnsupportedMediaType)
		return
	}
	if ctx.Err() != nil {
		return
	}
	if _, err := lib.Item(id, vaultCookie(r)); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(histogramForImage(src))
}
