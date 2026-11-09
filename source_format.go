package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
	"weave/internal/library"
)

const textPreviewLimit = 128 * 1024

var formatSlots = make(chan struct{}, 2)

func canFormatSource(ext string) bool {
	switch ext {
	case ".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx",
		".html", ".htm", ".css", ".scss", ".less", ".json", ".jsonc", ".json5",
		".yaml", ".yml", ".toml", ".graphql", ".gql", ".vue", ".mdx":
		return true
	default:
		return false
	}
}

func formatCommand(ctx context.Context, extension string) (*exec.Cmd, error) {
	if executable, err := os.Executable(); err == nil {
		dir := filepath.Dir(executable)
		script := filepath.Join(dir, "..", "Resources", "formatter", "format-preview.mjs")
		node := filepath.Join(dir, "formatter-node")
		if _, err := os.Stat(node); err == nil {
			return exec.CommandContext(ctx, node, "--max-old-space-size=160", script, extension), nil
		}
	}
	script, err := filepath.Abs("scripts/format-preview.mjs")
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(script), "..", "node_modules", "oxfmt", "package.json")); err != nil {
		return nil, err
	}
	node, err := exec.LookPath("node")
	if err != nil {
		return nil, err
	}
	return exec.CommandContext(ctx, node, "--max-old-space-size=160", script, extension), nil
}

func serveSourceFormat(w http.ResponseWriter, r *http.Request, lib *library.Library) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	item, err := lib.Item(r.URL.Query().Get("id"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if !canFormatSource(item.Ext) {
		http.Error(w, "format", http.StatusUnsupportedMediaType)
		return
	}
	source, err := io.ReadAll(http.MaxBytesReader(w, r.Body, textPreviewLimit))
	if err != nil {
		http.Error(w, "source", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	select {
	case formatSlots <- struct{}{}:
		defer func() { <-formatSlots }()
	case <-ctx.Done():
		http.Error(w, "timeout", http.StatusGatewayTimeout)
		return
	}
	cmd, err := formatCommand(ctx, item.Ext)
	if err != nil {
		http.Error(w, "formatter", http.StatusServiceUnavailable)
		return
	}
	cmd.Stdin = bytes.NewReader(source)
	result, err := cmd.Output()
	if err != nil {
		var exited *exec.ExitError
		switch {
		case ctx.Err() != nil:
			http.Error(w, "timeout", http.StatusGatewayTimeout)
		case errors.As(err, &exited) && exited.ExitCode() == 2:
			http.Error(w, "syntax", http.StatusUnprocessableEntity)
		default:
			http.Error(w, "formatter", http.StatusInternalServerError)
		}
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(result)
}
