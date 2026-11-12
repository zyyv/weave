//go:build !darwin

package library

import (
	"errors"
	"os"
)

func renameFileExclusive(oldPath, newPath string) error {
	if err := os.Link(oldPath, newPath); err != nil {
		return err
	}
	if err := os.Remove(oldPath); err != nil {
		return errors.Join(err, os.Remove(newPath))
	}
	return nil
}
