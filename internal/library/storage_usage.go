package library

import "strings"

// StorageUsage counts the indexed files in one directory overview category.
type StorageUsage struct {
	Count int   `json:"count"`
	Bytes int64 `json:"bytes"`
}

type storageBreakdown map[string]StorageUsage

func (usage storageBreakdown) add(category string, size int64) {
	stat := usage[category]
	stat.Count++
	stat.Bytes += size
	usage[category] = stat
}

// storageCategory refines the broad library filters for the storage overview.
func storageCategory(item Item) string {
	// The index stores app bundles as individual files. Group their contents
	// here so code, artwork, and libraries inside a bundle are counted once.
	for folder := range strings.SplitSeq(item.Folder, "/") {
		if strings.HasSuffix(strings.ToLower(folder), ".app") {
			return "app"
		}
	}

	switch item.Ext {
	case ".silk", ".amr":
		return "voice"
	case ".txt", ".md", ".markdown", ".rtf", ".mdx", ".log":
		return "text"
	case ".svg", ".ai", ".psd", ".psb", ".sketch", ".fig", ".xd", ".afdesign", ".afphoto", ".indd", ".aep", ".blend", ".kra":
		return "design"
	case ".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx", ".html", ".htm", ".css", ".scss", ".less",
		".vue", ".svelte", ".astro", ".go", ".rs", ".py", ".rb", ".php", ".java", ".kt", ".swift", ".m", ".mm",
		".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".sh", ".bash", ".zsh", ".lua", ".dart", ".wasm", ".graphql", ".gql":
		return "developer"
	case ".json", ".jsonc", ".json5", ".jsonl", ".ndjson", ".yaml", ".yml", ".toml", ".xml", ".plist", ".ini",
		".csv", ".tsv", ".parquet", ".db", ".sqlite", ".sqlite3", ".sql":
		return "data"
	case ".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".zst":
		return "archive"
	case ".app", ".dmg", ".pkg", ".ipa", ".apk", ".exe", ".msi", ".appimage", ".deb", ".rpm":
		return "app"
	case ".tif", ".tiff", ".dng", ".cr2", ".cr3", ".nef", ".ico":
		return "image"
	case ".mkv", ".flv", ".wmv", ".mpeg", ".mpg", ".3gp":
		return "video"
	case ".flac", ".aac", ".aiff", ".aif", ".opus", ".wma":
		return "audio"
	case ".odt", ".ods", ".odp", ".pages", ".numbers", ".key", ".epub":
		return "document"
	}

	switch item.Name {
	case "Dockerfile", "Makefile", "Gemfile", "Rakefile", "Procfile", "go.mod", "go.sum", "Cargo.lock", "yarn.lock", "bun.lock", "bun.lockb":
		return "developer"
	}

	switch item.Kind {
	case "image", "video", "audio", "document":
		return item.Kind
	default:
		return "other"
	}
}
