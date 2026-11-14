package scanignore

import (
	"strings"
	"testing"
)

func TestGitStylePatterns(t *testing.T) {
	cases := []struct {
		rule, path string
		directory  bool
		want       bool
	}{
		{"*.tmp", "images/a.tmp", false, true},
		{"*.tmp", "images/a.tmp/raw.jpg", false, false},
		{"/cache/", "cache", true, true},
		{"/cache/", "cache", false, false},
		{"/cache/", "src/cache", true, false},
		{"cache/", "src/cache", true, true},
		{"media/**/draft?.jpg", "media/draft1.jpg", false, true},
		{"media/**/draft?.jpg", "media/raw/day1/draft1.jpg", false, true},
		{"media/**/draft?.jpg", "other/media/draft1.jpg", false, false},
		{"a/**", "a", true, false},
		{"a/**", "a/b/c", false, true},
		{"**/test[!0-9].jpg", "a/testa.jpg", false, true},
		{"**/test[!0-9].jpg", "a/test9.jpg", false, false},
		{"[[:digit:]].jpg", "a/9.jpg", false, true},
		{`\#notes`, "a/#notes", false, true},
		{`\!notes`, "!notes", false, true},
		{`foo\/bar`, "foo/bar", false, true},
		{`name\ `, "name ", false, true},
		{"name ", "name", false, true},
		{" name", "name", false, false},
		{"#notes", "#notes", false, false},
	}
	for _, tc := range cases {
		m, err := Compile([]string{tc.rule}, Project{})
		if err != nil {
			t.Fatal(tc.rule, err)
		}
		if got := m.Ignored(strings.Split(tc.path, "/"), tc.directory); got != tc.want {
			t.Errorf("rule %q on %q (directory=%v): matched %v, want %v", tc.rule, tc.path, tc.directory, got, tc.want)
		}
	}
	if _, err := Compile([]string{"# comment", "["}, Project{}); err == nil || !strings.HasSuffix(err.Error(), ": 2") {
		t.Fatalf("expected invalid rule on line 2, got %v", err)
	}
}
