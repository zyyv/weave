package library

import (
	"reflect"
	"testing"
	"time"
)

func TestActivityCountsPublicFilesByLocalDay(t *testing.T) {
	zone := time.FixedZone("UTC+8", 8*60*60)
	now := time.Date(2026, time.November, 10, 12, 0, 0, 0, zone)
	start := time.Date(2025, time.November, 11, 0, 0, 0, 0, zone)
	today := time.Date(2026, time.November, 10, 0, 0, 0, 0, zone)
	l := Library{
		items: []Item{
			{Modified: start.Add(-time.Millisecond).UnixMilli()},
			{Modified: start.UnixMilli()},
			{Modified: today.Add(-time.Millisecond).UnixMilli()},
			{Modified: today.UnixMilli()},
			{ID: "private", Modified: today.UnixMilli()},
			{Thumbnail: true, Modified: today.UnixMilli()},
			{Modified: today.AddDate(0, 0, 1).UnixMilli()},
		},
		vault: vaultState{items: map[string]string{"private": "root"}},
	}

	activity := l.Activity(now, false)
	want := map[string]int{"2025-11-11": 1, "2026-11-09": 1, "2026-11-10": 1}
	if activity.Start != "2025-11-11" || activity.End != "2026-11-10" || !reflect.DeepEqual(activity.Days, want) {
		t.Fatalf("unexpected activity: %+v", activity)
	}
	want["2026-11-10"]++
	if got := l.Activity(now, true).Days; !reflect.DeepEqual(got, want) {
		t.Fatalf("activity with thumbnails = %v, want %v", got, want)
	}
}
