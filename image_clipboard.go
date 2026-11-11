package main

import (
	"bytes"
	"context"
	"errors"
	"image/png"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"
	"weave/internal/library"

	"github.com/egoist/mygo"
)

const (
	maxClipboardImageBytes  = 128 << 20
	maxClipboardImagePixels = 100_000_000
)

var errClipboardImageTooLarge = errors.New("clipboard image exceeds size limit")

func copyLibraryImage(ctx context.Context, lib *library.Library, root, id, token string) error {
	if lib.Status().Root != root {
		return errors.New("图片已不可用")
	}
	source, item, err := lib.Open(id, token)
	if err != nil || item.Kind != "image" {
		if source != nil {
			source.Close()
		}
		return errors.New("图片已不可用")
	}
	defer source.Close()

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	data, err := clipboardImagePNG(ctx, source, item.Ext)
	if errors.Is(err, errClipboardImageTooLarge) {
		return errors.New("图片过大，无法复制")
	}
	if err != nil || ctx.Err() != nil {
		return errors.New("无法复制图片")
	}
	if _, err := lib.Item(id, token); err != nil || lib.Status().Root != root {
		return errors.New("图片已不可用")
	}
	if err := mygo.Clipboard.WriteImage(data); err != nil {
		return errors.New("无法复制图片")
	}
	return nil
}

func clipboardImagePNG(ctx context.Context, source *os.File, extension string) ([]byte, error) {
	header, err := io.ReadAll(io.LimitReader(source, 1<<20))
	if err != nil {
		return nil, err
	}
	orientation := imageOrientation(header)
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}

	var data []byte
	if bytes.HasPrefix(header, []byte("\x89PNG\r\n\x1a\n")) {
		data, err = readClipboardPNG(source)
	} else {
		data, err = convertClipboardPNG(ctx, source, extension)
	}
	if err != nil {
		return nil, err
	}
	config, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if config.Width > maxClipboardImagePixels/config.Height {
		return nil, errClipboardImageTooLarge
	}
	if orientation == 1 {
		return data, nil
	}
	image, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	var result bytes.Buffer
	err = png.Encode(&result, orientedImage(image, config.Width, config.Height, orientation))
	return result.Bytes(), err
}

func convertClipboardPNG(ctx context.Context, source *os.File, extension string) ([]byte, error) {
	dir, err := os.MkdirTemp("", "weave-copy-image-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	input, err := os.Create(filepath.Join(dir, "source"+extension))
	if err != nil {
		return nil, err
	}
	size, copyErr := io.Copy(input, io.LimitReader(source, maxClipboardImageBytes+1))
	if err := errors.Join(copyErr, input.Close()); err != nil {
		return nil, err
	}
	if size > maxClipboardImageBytes {
		return nil, errClipboardImageTooLarge
	}
	output := filepath.Join(dir, "image.png")
	if err := exec.CommandContext(ctx, "/usr/bin/sips", "-s", "format", "png", input.Name(), "--out", output).Run(); err != nil {
		return nil, err
	}
	converted, err := os.Open(output)
	if err != nil {
		return nil, err
	}
	defer converted.Close()
	return readClipboardPNG(converted)
}

func readClipboardPNG(source io.Reader) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(source, maxClipboardImageBytes+1))
	if len(data) > maxClipboardImageBytes {
		return nil, errClipboardImageTooLarge
	}
	return data, err
}
