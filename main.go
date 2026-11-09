package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/egoist/mygo"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"weave/internal/library"
	"weave/internal/preferences"
)

//go:embed frontend/*
var assets embed.FS

func main() {
	serve := flag.Bool("serve", false, "仅启动本地浏览器预览服务")
	development := flag.Bool("dev", false, "启用开发工具和教程重播")
	root := flag.String("root", "", "资源目录")
	data := flag.String("data", "", "收藏和标签目录")
	frontendPath := flag.String("frontend", "", "开发预览前端目录，仅 --serve 可用")
	flag.Parse()
	if *data == "" {
		p, e := os.UserConfigDir()
		if e != nil {
			log.Fatal(e)
		}
		*data = filepath.Join(p, "Weave")
	}
	rootExplicit := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == "root" {
			rootExplicit = true
		}
	})
	if e := os.MkdirAll(*data, 0700); e != nil {
		log.Fatal(e)
	}
	prefs, e := preferences.New(*data)
	if e != nil {
		log.Fatal(e)
	}
	if last, _ := prefs.Directories(); last == "" {
		if b, err := os.ReadFile(filepath.Join(*data, "source.txt")); err == nil && len(b) > 0 {
			legacy, err := filepath.Abs(string(b))
			if err != nil {
				log.Fatal(err)
			}
			if resolved, err := library.ProbeRoot(legacy); err == nil {
				legacy = resolved
			}
			if err := prefs.ImportDirectory(legacy); err != nil {
				log.Fatal(err)
			}
		}
	}
	if !rootExplicit {
		*root, _ = prefs.Directories()
	}
	lib, e := library.New(*root, *data)
	if e != nil {
		log.Fatal(e)
	}
	message := func(key string) string { return localizedMessage(prefs.Get(lib.Status().Root).Preferences.Locale, key) }
	if *root != "" {
		if e = lib.ScanDirectory(*root, prefs.OpenDirectory); e != nil {
			log.Print(e)
		}
	}
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		log.Fatal(e)
	}
	secret := make([]byte, 24)
	if _, e = rand.Read(secret); e != nil {
		log.Fatal(e)
	}
	prefix := "/" + hex.EncodeToString(secret) + "/"
	origin := "http://" + listener.Addr().String()
	base := origin + prefix
	web, _ := fs.Sub(assets, "frontend")
	if *frontendPath != "" {
		if !*serve {
			log.Fatal("--frontend 仅用于 --serve")
		}
		web = os.DirFS(*frontendPath)
	}
	files := http.FileServer(http.FS(web))
	thumbnails := newThumbnailCache()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		if r.Host != listener.Addr().String() || !strings.HasPrefix(r.URL.Path, prefix) {
			http.NotFound(w, r)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && o != origin {
			http.Error(w, message("errors.origin"), 403)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, prefix)
		token := vaultCookie(r)
		setVaultCookie := func(value string, maxAge int) {
			http.SetCookie(w, &http.Cookie{Name: "weave-vault", Value: value, Path: prefix,
				HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: maxAge})
		}
		fail := func(err error) {
			http.Error(w, localizedError(prefs.Get(lib.Status().Root).Preferences.Locale, err.Error()), 400)
		}
		jsonOut := func(v any) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(v) }
		if strings.HasPrefix(path, "api/") {
			if r.Method != "GET" && r.Method != "POST" {
				http.Error(w, "method", 405)
				return
			}
			action := strings.TrimPrefix(path, "api/")
			if r.Method == "GET" && action != "status" && action != "list" && action != "scopes" && action != "browse" && action != "settings" && action != "histogram" && action != "directories" {
				http.Error(w, "POST required", 405)
				return
			}
			switch action {
			case "directories":
				last, dirs := prefs.Directories()
				type entry struct {
					preferences.Directory
					Broken bool `json:"broken"`
				}
				entries := make([]entry, 0, len(dirs))
				for _, dir := range dirs {
					_, err := library.ProbeRoot(dir.Path)
					entries = append(entries, entry{dir, err != nil})
				}
				jsonOut(struct {
					LastRoot string  `json:"lastRoot"`
					Entries  []entry `json:"entries"`
				}{last, entries})
			case "directory-name":
				var in struct{ Root, Name string }
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&in); e != nil {
					fail(e)
					return
				}
				if e := prefs.NameDirectory(in.Root, in.Name); e != nil {
					fail(e)
					return
				}
				jsonOut(true)
			case "vault-unlock":
				var in struct {
					Root, PIN string
					Create    bool
				}
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&in); e != nil {
					fail(e)
					return
				}
				session, e := lib.UnlockVault(in.Root, in.PIN, in.Create)
				if e != nil {
					fail(e)
					return
				}
				setVaultCookie(session, 0)
				jsonOut(true)
			case "vault-lock":
				lib.LockVault(token)
				setVaultCookie("", -1)
				jsonOut(true)
			case "vault-items":
				var in struct {
					Root    string
					IDs     []string
					Private bool
				}
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2*1024*1024)).Decode(&in); e != nil {
					fail(e)
					return
				}
				if e := lib.SetPrivate(in.Root, token, in.IDs, in.Private); e != nil {
					fail(e)
					return
				}
				jsonOut(true)
			case "source":
				var in struct {
					Root string `json:"root"`
					preferences.Source
				}
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&in); e != nil {
					fail(e)
					return
				}
				st := lib.Status()
				if st.Scanning || st.Root != in.Root {
					fail(fmt.Errorf("目录已变化，请重试"))
					return
				}
				if e := prefs.SetSource(st.Root, in.Source); e != nil {
					fail(e)
					return
				}
				jsonOut(prefs.Get(st.Root))
			case "histogram":
				thumbnails.serveHistogram(w, r, lib, r.URL.Query().Get("id"))
			case "status":
				status := lib.Status(token)
				status.Error = localizedError(prefs.Get(status.Root).Preferences.Locale, status.Error)
				jsonOut(status)
			case "settings":
				if r.Method == "POST" {
					var p preferences.Preferences
					if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&p); e != nil {
						fail(e)
						return
					}
					if e := prefs.Set(p); e != nil {
						fail(e)
						return
					}
				}
				jsonOut(struct {
					preferences.Snapshot
					Development bool `json:"development"`
				}{prefs.Get(lib.Status().Root), *development})
			case "bindings":
				var in map[string]preferences.Contact
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2*1024*1024)).Decode(&in); e != nil {
					fail(e)
					return
				}
				if len(in) > 5000 {
					fail(fmt.Errorf("%s", message("errors.bindingLimit")))
					return
				}
				st := lib.Status()
				sourceMode := prefs.Get(st.Root).Source.Mode
				if sourceMode == "auto" {
					sourceMode = st.DetectedMode
				}
				if sourceMode != "wechat" {
					fail(fmt.Errorf("当前目录不使用会话模式"))
					return
				}
				known := map[string]bool{}
				for _, g := range st.Groups {
					if g != "未分组" {
						known[g] = true
					}
				}
				for k := range in {
					if !known[k] {
						fail(fmt.Errorf(message("errors.unknownConversation"), k))
						return
					}
				}
				if e := prefs.Bind(st.Root, in); e != nil {
					fail(e)
					return
				}
				jsonOut(prefs.Get(st.Root))
			case "list", "scopes", "browse":
				q := r.URL.Query()
				offset, _ := strconv.Atoi(q.Get("offset"))
				limit, _ := strconv.Atoi(q.Get("limit"))
				names := map[string]string{}
				st := lib.Status()
				snapshot := prefs.Get(st.Root)
				mode := snapshot.Source.Mode
				if mode == "auto" {
					mode = st.DetectedMode
				}
				if mode == "wechat" {
					for k, v := range snapshot.Contacts {
						names[k] = v.Name + " " + v.Username
					}
				}
				if action == "scopes" && mode != "wechat" {
					fail(fmt.Errorf("当前目录不使用会话模式"))
					return
				}
				private := q.Get("private") == "1"
				if private && (action == "scopes" || !lib.Status(token).VaultUnlocked) {
					http.Error(w, message("errors.vaultLocked"), http.StatusForbidden)
					return
				}
				query := library.Query{Private: private, VaultToken: token, Search: q.Get("search"), Kind: q.Get("kind"), Group: q.Get("group"), Sort: q.Get("sort"), Star: q.Get("star") == "1", Thumbs: q.Get("thumbs") == "1", Offset: offset, Limit: limit, Names: names}
				if action == "scopes" {
					jsonOut(lib.Scopes(query))
				} else if action == "browse" {
					jsonOut(lib.Browse(query, q.Get("folder")))
				} else {
					jsonOut(lib.List(query))
				}
			case "scan":
				if e := lib.Scan(lib.Status().Root); e != nil {
					fail(e)
					return
				}
				jsonOut(true)
			case "choose":
				var in struct {
					Root string `json:"root"`
				}
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&in); e != nil {
					fail(e)
					return
				}
				paths := []string{}
				if in.Root != "" {
					paths = append(paths, in.Root)
				} else {
					if *serve {
						fail(fmt.Errorf("%s", message("errors.desktopChoose")))
						return
					}
					var e error
					paths, e = mygo.Dialog.Open(mygo.OpenDialogOptions{Title: message("native.chooseResources"), Directory: true, DefaultPath: lib.Status().Root})
					if e != nil {
						fail(e)
						return
					}
				}
				if len(paths) > 0 {
					if e := lib.ScanDirectory(paths[0], prefs.OpenDirectory); e != nil {
						fail(e)
						return
					}
				}
				jsonOut(len(paths) > 0)
			case "mark":
				var in struct {
					ID string `json:"id"`
					library.Mark
				}
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&in); e != nil {
					fail(e)
					return
				}
				if e := lib.Mark(in.ID, in.Mark, token); e != nil {
					fail(e)
					return
				}
				jsonOut(true)
			case "reveal", "export":
				var in struct {
					IDs []string `json:"ids"`
				}
				if e := json.NewDecoder(http.MaxBytesReader(w, r.Body, 65536)).Decode(&in); e != nil {
					fail(e)
					return
				}
				if len(in.IDs) == 0 {
					fail(fmt.Errorf("%s", message("errors.selectResources")))
					return
				}
				if action == "reveal" {
					x, e := lib.Item(in.IDs[0], token)
					if e != nil {
						fail(e)
						return
					}
					if e = exec.Command("/usr/bin/open", "-R", x.Path).Run(); e != nil {
						fail(e)
						return
					}
					jsonOut(true)
					return
				}
				if *serve {
					fail(fmt.Errorf("%s", message("errors.desktopExport")))
					return
				}
				paths, e := mygo.Dialog.Open(mygo.OpenDialogOptions{Title: message("native.chooseExport"), Directory: true, CreateDirectories: true})
				if e != nil {
					fail(e)
					return
				}
				if len(paths) == 0 {
					jsonOut(map[string]int{"count": 0})
					return
				}
				n, e := lib.Export(in.IDs, paths[0], token)
				if e != nil {
					fail(fmt.Errorf(message("errors.partialExport"), n, e))
					return
				}
				jsonOut(map[string]int{"count": n})
			default:
				http.NotFound(w, r)
			}
			return
		}
		if strings.HasPrefix(path, "raw/") {
			f, x, e := lib.Open(strings.TrimPrefix(path, "raw/"), token)
			if e != nil {
				http.NotFound(w, r)
				return
			}
			defer f.Close()
			if (x.Ext != ".silk" && x.Ext != ".amr") || x.Size > 16*1024*1024 {
				http.Error(w, message("errors.voiceFormat"), 415)
				return
			}
			w.Header().Set("Content-Type", "application/octet-stream")
			http.ServeContent(w, r, x.Name, time.UnixMilli(x.Modified), f)
			return
		}
		if strings.HasPrefix(path, "thumb/") {
			if r.Method != "GET" {
				http.Error(w, "method", 405)
				return
			}
			thumbnails.serve(w, r, lib, strings.TrimPrefix(path, "thumb/"))
			return
		}
		if strings.HasPrefix(path, "media/") {
			if r.Method != "GET" && r.Method != "HEAD" {
				http.Error(w, "method", 405)
				return
			}
			f, x, e := lib.Open(strings.TrimPrefix(path, "media/"), token)
			if e != nil {
				http.NotFound(w, r)
				return
			}
			defer f.Close()
			switch x.Ext {
			case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".mp4", ".mov", ".m4v", ".webm", ".mp3", ".wav", ".m4a", ".ogg":
				w.Header().Set("Content-Type", mime.TypeByExtension(x.Ext))
			case ".pic", ".record_thumb":
				b := make([]byte, 512)
				n, _ := f.Read(b)
				f.Seek(0, 0)
				t := http.DetectContentType(b[:n])
				if !strings.HasPrefix(t, "image/") {
					http.Error(w, message("errors.previewFormat"), 415)
					return
				}
				w.Header().Set("Content-Type", t)
			default:
				http.Error(w, message("errors.inlineFormat"), 415)
				return
			}
			http.ServeContent(w, r, x.Name, time.UnixMilli(x.Modified), f)
			return
		}
		if path == "text" {
			f, x, e := lib.Open(r.URL.Query().Get("id"), token)
			if e != nil {
				fail(e)
				return
			}
			defer f.Close()
			if x.Ext != ".txt" && x.Ext != ".md" && x.Ext != ".csv" {
				fail(fmt.Errorf("%s", message("errors.textFormat")))
				return
			}
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			io.Copy(w, io.LimitReader(f, 128*1024))
			return
		}
		// Hashes allow only the bundled player styles, including its thumbnail shadow template.
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self'; media-src 'self' blob:; worker-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; style-src-elem 'self' 'sha256-/wNXXQM7c2ofBcjrAABoSS5Ibbo1K6dLnomtT2ZNGIA=' 'sha256-20mtW7QL/m+GnGSlicaFajrhxQFmju52t2iGt9eIJ9A=' 'sha256-wMWywP4oD7M3MPJrCTXT/qIrEodBE+KXIgZo+N4zqb8=' 'sha256-zz2BvW4NBXbVhIbcWeI/pDZ75RKV4RxP8kKCc1LmW4E=' 'sha256-PbfLgFhtMIK34HBZHnBgjlprY2JWgUyFJC2UTVSMIKQ='; script-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; frame-ancestors 'none'")
		if path == "codec-worker.js" || path == "audio-codec-worker.js" || path == "vendor/amr-worker.js" {
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'")
		}
		r.URL.Path = "/" + path
		files.ServeHTTP(w, r)
	})
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if e := server.Serve(listener); e != nil && e != http.ErrServerClosed {
			log.Print(e)
		}
	}()
	defer server.Close()
	fmt.Println("WEAVE_URL=" + base)
	if *serve {
		select {}
	}
	mygo.App.WhenReady(func() {
		mygo.NewWindow(mygo.WindowOptions{Title: message("weaveResourceLibrary"), URL: base, BackgroundColor: "#212121", Width: 1440, Height: 920, MinWidth: 840, MinHeight: 620, TitleBarStyle: mygo.TitleBarHiddenInset, TrafficLightPosition: &mygo.Point{X: 20, Y: 20}})
	})
	if e = mygo.App.Run(); e != nil {
		log.Fatal(e)
	}
}

func vaultCookie(r *http.Request) string {
	cookie, err := r.Cookie("weave-vault")
	if err != nil {
		return ""
	}
	return cookie.Value
}
