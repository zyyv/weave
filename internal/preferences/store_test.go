package preferences

import "testing"

func TestPreferencesAndRootIsolation(t *testing.T) {
	dir := t.TempDir()
	s, e := New(dir)
	if e != nil {
		t.Fatal(e)
	}
	p := s.Get("A").Preferences
	if p.Theme != "dark" || !p.Grouped || p.SetupTourDismissed {
		t.Fatal("default view must be dark and grouped")
	}
	p.SetupTourDismissed = true
	p.Theme = "light"
	p.Palette = "ocean"
	p.Speed = 1.5
	if e = s.Set(p); e != nil {
		t.Fatal(e)
	}
	if e = s.Bind("A", map[string]Contact{"hash": {Name: "设计讨论", Username: "group-id", Type: "group"}}); e != nil {
		t.Fatal(e)
	}
	if len(s.Get("B").Contacts) != 0 {
		t.Fatal("account bindings leaked between source roots")
	}
	s2, e := New(dir)
	if e != nil {
		t.Fatal(e)
	}
	if !s2.Get("A").Preferences.SetupTourDismissed || s2.Get("A").Preferences.Speed != 1.5 || s2.Get("A").Contacts["hash"].Name != "设计讨论" {
		t.Fatal("preferences or bindings lost on restart")
	}
	if e = s.Bind("A", map[string]Contact{"bad": {Name: "bad", Type: "invalid"}}); e == nil {
		t.Fatal("invalid binding accepted")
	}
	if len(s.Get("A").Contacts) != 1 {
		t.Fatal("failed import changed bindings")
	}
	p.Volume = 2
	if e = s.Set(p); e == nil {
		t.Fatal("invalid volume accepted")
	}
	if s.Get("A").Preferences.Volume == 2 {
		t.Fatal("invalid settings changed saved state")
	}
	if e = s.Bind("A", map[string]Contact{"hash": {Type: "custom"}}); e != nil {
		t.Fatal(e)
	}
	if len(s.Get("A").Contacts) != 0 {
		t.Fatal("unbind failed")
	}
}

func TestLocalePersistenceAndValidation(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	p := store.Get("root").Preferences
	if p.Locale != "zh-CN" {
		t.Fatalf("default locale: %q", p.Locale)
	}
	p.Locale = "en"
	if err := store.Set(p); err != nil {
		t.Fatal(err)
	}
	reopened, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	if reopened.Get("root").Preferences.Locale != "en" {
		t.Fatal("locale did not survive restart")
	}
	p.Locale = "unsupported"
	if err := store.Set(p); err == nil {
		t.Fatal("invalid locale accepted")
	}
	if store.Get("root").Preferences.Locale != "en" {
		t.Fatal("invalid locale changed saved state")
	}
	p.Locale = ""
	if err := store.Set(p); err != nil {
		t.Fatal(err)
	}
	if store.Get("root").Preferences.Locale != "zh-CN" {
		t.Fatal("legacy preference did not fall back to Chinese")
	}
}
