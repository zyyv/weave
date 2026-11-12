package main

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"math"
	"slices"
	"sync"

	"github.com/egoist/mygo"
)

type resourceMenu struct {
	development bool
	message     func(string) string
}

type resourceMenuState struct {
	Directory       bool     `json:"directory"`
	Background      bool     `json:"background"`
	RenameDisabled  bool     `json:"renameDisabled"`
	Starred         bool     `json:"starred"`
	Image           bool     `json:"image"`
	CopyImageBusy   bool     `json:"copyImageBusy"`
	PrivateView     bool     `json:"privateView"`
	PrivacyDisabled bool     `json:"privacyDisabled"`
	TagColors       []string `json:"tagColors"`
	TrashBusy       bool     `json:"trashBusy"`
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
	if state.Background {
		mygo.NewMenu([]*mygo.MenuItem{item("newFolder", "newFolder")}).PopupAt(win, x, y)
		return chosen
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
	rename := item("rename", "renameEntry")
	rename.Disabled = state.RenameDisabled
	items := []*mygo.MenuItem{item("openFolder", "resourceMenu.openFolder"), rename}
	if !state.Directory {
		items = []*mygo.MenuItem{item("preview", "resourceMenu.preview"), item("favorite", favorite), rename}
	}
	if state.Image && !state.Directory {
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
	)
	if !state.Directory {
		items = append(items, trash)
	}
	tags := &mygo.MenuItem{Label: m.message("tags")}
	for index, swatch := range nativeTagPalette {
		command := "tag:" + swatch.name
		tags.Submenu = append(tags.Submenu, &mygo.MenuItem{
			Label: m.message("tagColor_" + swatch.name),
			Icon:  nativeTagIcons()[index][slices.Contains(state.TagColors, swatch.name)],
			Click: func(*mygo.MenuItem, *mygo.Window) { chosen = command },
		})
	}
	items = append(items, mygo.Separator(), tags)
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

var nativeTagPalette = [...]struct {
	name string
	fill color.NRGBA
}{
	{"red", color.NRGBA{R: 255, G: 105, B: 100, A: 255}},
	{"orange", color.NRGBA{R: 255, G: 172, B: 88, A: 255}},
	{"yellow", color.NRGBA{R: 255, G: 228, B: 84, A: 255}},
	{"green", color.NRGBA{R: 100, G: 217, B: 119, A: 255}},
	{"blue", color.NRGBA{R: 74, G: 165, B: 250, A: 255}},
	{"purple", color.NRGBA{R: 225, G: 88, B: 241, A: 255}},
	{"gray", color.NRGBA{R: 178, G: 178, B: 182, A: 255}},
}

var nativeTagIcons = sync.OnceValue(func() [len(nativeTagPalette)]map[bool]*mygo.MenuIcon {
	var icons [len(nativeTagPalette)]map[bool]*mygo.MenuIcon
	for i, swatch := range nativeTagPalette {
		icons[i] = map[bool]*mygo.MenuIcon{
			false: makeTagIcon(swatch.fill, false),
			true:  makeTagIcon(swatch.fill, true),
		}
	}
	return icons
})

func makeTagIcon(fill color.NRGBA, selected bool) *mygo.MenuIcon {
	const size = 32
	icon := image.NewNRGBA(image.Rect(0, 0, size, size))
	for y := range size {
		for x := range size {
			distance := math.Hypot(float64(x)+0.5-size/2, float64(y)+0.5-size/2)
			coverage := max(0, min(1, 10.5-distance))
			if selected {
				ring := max(0, min(1, min(distance-12.5, 15.5-distance)))
				coverage = max(coverage, 0.62*ring)
			}
			pixel := fill
			pixel.A = uint8(255 * coverage)
			icon.SetNRGBA(x, y, pixel)
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, icon); err != nil {
		return nil
	}
	result, _ := mygo.NewMenuIcon(encoded.Bytes(), false)
	return result
}
