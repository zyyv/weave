package library

import (
	"bytes"
	"os"
	"syscall"
	"unsafe"
)

// Ask the filesystem for the spelling of the open directory. EvalSymlinks
// alone preserves input casing, which can create aliases on macOS volumes.
func resolvedDirectory(file *os.File, fallback string) string {
	var path [1024]byte
	_, _, err := syscall.Syscall(syscall.SYS_FCNTL, file.Fd(), syscall.F_GETPATH, uintptr(unsafe.Pointer(&path[0])))
	if end := bytes.IndexByte(path[:], 0); err == 0 && end > 0 {
		return string(path[:end])
	}
	return fallback
}
