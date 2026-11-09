//go:build !darwin

package library

import "os"

func resolvedDirectory(_ *os.File, path string) string { return path }
