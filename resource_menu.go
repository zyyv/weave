package main

import (
	"context"

	"github.com/egoist/mygo"
)

type resourceMenu struct {
	development bool
	message     func(string) string
}

type resourceMenuState struct {
	Starred         bool `json:"starred"`
	Image           bool `json:"image"`
	CopyImageBusy   bool `json:"copyImageBusy"`
	PrivateView     bool `json:"privateView"`
	PrivacyDisabled bool `json:"privacyDisabled"`
	TrashBusy       bool `json:"trashBusy"`
}

func (resourceMenu) CopyPath(path string) {
	mygo.Clipboard.WriteText(path)
}

// Show opens the native menu and returns the action chosen for the clicked resource.
func (m resourceMenu) Show(ctx context.Context, x, y int, state resourceMenuState) string {
	win := mygo.CallerWindow(ctx)
	if win == nil || ctx.Err() != nil {
		return ""
	}
	page := win.Page()
	chosen := ""
	item := func(id, key string) *mygo.MenuItem {
		return &mygo.MenuItem{
			Label: m.message(key),
			Click: func(*mygo.MenuItem, *mygo.Window) { chosen = id },
		}
	}
	favorite := "favorite"
	if state.Starred {
		favorite = "resourceMenu.unfavorite"
	}
	trash := item("trash", "moveToTrash")
	trash.Disabled = state.TrashBusy
	privacyLabel := "privateAddItem"
	if state.PrivateView {
		privacyLabel = "resourceMenu.removePrivacy"
	}
	privacy := item("privacy", privacyLabel)
	privacy.Disabled = state.PrivacyDisabled
	items := []*mygo.MenuItem{
		item("preview", "resourceMenu.preview"),
		item("favorite", favorite),
	}
	if state.Image {
		copyImage := item("copyImage", "copyImage")
		copyImage.Disabled = state.CopyImageBusy
		items = append(items, copyImage)
	}
	items = append(items,
		mygo.Separator(),
		item("reveal", "showInFinder"),
		item("export", "export"),
		mygo.Separator(),
		item("relativePath", "copyRelativePath"),
		item("absolutePath", "copyAbsolutePath"),
		mygo.Separator(),
		privacy,
		trash,
	)
	menu := mygo.NewMenu(items)
	if m.development {
		menu.Append(mygo.Separator(), item("reload", "resourceMenu.reload"), item("inspect", "resourceMenu.inspect"))
	}
	menu.PopupAt(win, x, y)
	switch chosen {
	case "reload":
		page.Reload()
	case "inspect":
		page.OpenDevTools()
	default:
		return chosen
	}
	return ""
}
