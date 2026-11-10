package library

import "time"

type Activity struct {
	Root    string         `json:"root"`
	Updated int64          `json:"updated"`
	Start   string         `json:"start"`
	End     string         `json:"end"`
	Days    map[string]int `json:"days"`
}

// Activity counts indexed public files by their local modification date.
func (l *Library) Activity(now time.Time, thumbs bool) Activity {
	l.mu.RLock()
	defer l.mu.RUnlock()

	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	start := today.AddDate(0, 0, -364)
	end := today.AddDate(0, 0, 1)
	activity := Activity{
		Root: l.state.Root, Updated: l.state.Updated,
		Start: start.Format(time.DateOnly), End: today.Format(time.DateOnly),
		Days: make(map[string]int),
	}
	from, before := start.UnixMilli(), end.UnixMilli()
	for _, item := range l.items {
		if item.Modified < from || item.Modified >= before || (!thumbs && item.Thumbnail) || l.vault.items[item.ID] != "" {
			continue
		}
		day := time.UnixMilli(item.Modified).In(now.Location()).Format(time.DateOnly)
		activity.Days[day]++
	}
	return activity
}
