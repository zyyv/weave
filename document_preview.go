package main

import (
	"io/fs"
	"net"
	"net/http"
	"time"
	"weave/internal/library"
)

const maxOfficePreview = 100 << 20

func serveDocument(w http.ResponseWriter, r *http.Request, lib *library.Library, id string, message func(string) string) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	f, item, err := lib.Open(id, vaultCookie(r))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	switch item.Ext {
	case ".pdf":
		w.Header().Set("Content-Type", "application/pdf")
	case ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx":
		info, err := f.Stat()
		if err != nil || !info.Mode().IsRegular() {
			http.NotFound(w, r)
			return
		}
		if info.Size() > maxOfficePreview {
			http.Error(w, message("errors.officePreviewSize"), http.StatusRequestEntityTooLarge)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", "attachment")
	default:
		http.Error(w, message("errors.previewFormat"), http.StatusUnsupportedMediaType)
		return
	}
	http.ServeContent(w, r, item.Name, time.UnixMilli(item.Modified), f)
}

// The Office renderer needs inline styles and can process untrusted document
// markup. Its origin serves only viewer assets, with no resource or settings API.
func officePreviewServer(listener net.Listener, web fs.FS, appOrigin string) *http.Server {
	frameFiles, err := fs.Sub(web, "office-frame")
	if err != nil {
		panic(err)
	}
	files := http.FileServer(http.FS(frameFiles))
	return &http.Server{ReadHeaderTimeout: 5 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != listener.Addr().String() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors "+appOrigin)
		files.ServeHTTP(w, r)
	})}
}
