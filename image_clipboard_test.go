package main

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestClipboardImagePNG(t *testing.T) {
	source := image.NewNRGBA(image.Rect(0, 0, 640, 480))
	source.SetNRGBA(0, 0, color.NRGBA{R: 100, A: 64})
	for _, ext := range []string{".png", ".jpg"} {
		t.Run(ext, func(t *testing.T) {
			if ext == ".jpg" && runtime.GOOS != "darwin" {
				t.Skip("JPEG conversion requires macOS ImageIO")
			}
			file, err := os.Create(filepath.Join(t.TempDir(), "source"+ext))
			if err != nil {
				t.Fatal(err)
			}
			defer file.Close()
			if ext == ".png" {
				err = png.Encode(file, source)
			} else {
				err = jpeg.Encode(file, source, nil)
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err := file.Seek(0, io.SeekStart); err != nil {
				t.Fatal(err)
			}
			data, err := clipboardImagePNG(t.Context(), file, ext)
			if err != nil {
				t.Fatal(err)
			}
			got, err := png.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatal(err)
			}
			if got.Bounds() != source.Bounds() {
				t.Fatalf("clipboard image has bounds %v, want %v", got.Bounds(), source.Bounds())
			}
			if ext == ".png" && got.At(0, 0) != source.At(0, 0) {
				t.Fatalf("clipboard PNG pixel is %v, want %v", got.At(0, 0), source.At(0, 0))
			}
		})
	}
}
