package library

import (
	"runtime"
	"syscall"

	"github.com/ebitengine/purego"
)

var renameExclusive func(string, string, uint32) int32
var renameErrno func() *int32

func init() {
	purego.RegisterLibFunc(&renameExclusive, purego.RTLD_DEFAULT, "renamex_np")
	purego.RegisterLibFunc(&renameErrno, purego.RTLD_DEFAULT, "__error")
}

func renameFileExclusive(oldPath, newPath string) error {
	const renameExcl = 0x00000004 // RENAME_EXCL from sys/stdio.h.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	if renameExclusive(oldPath, newPath, renameExcl) != 0 {
		return syscall.Errno(*renameErrno())
	}
	return nil
}
