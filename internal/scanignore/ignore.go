// Package scanignore matches Git-style patterns relative to a resource root.
package scanignore

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
)

const (
	Inherit = "inherit"
	Append  = "append"
	Replace = "replace"
)

type Project struct {
	Mode  string   `json:"mode"`
	Rules []string `json:"rules"`
}

type rule struct {
	include  bool
	dirOnly  bool
	anchored bool
	parts    []*regexp.Regexp // nil is a whole-component **
}

type Matcher []rule

func Compile(global []string, project Project) (Matcher, error) {
	if project.Mode == "" {
		project.Mode = Inherit
	}
	switch project.Mode {
	case Inherit:
		return compileRules(nil, global)
	case Append, Replace:
		var m Matcher
		if project.Mode == Append {
			var err error
			m, err = compileRules(nil, global)
			if err != nil {
				return nil, err
			}
		}
		return compileRules(m, project.Rules)
	default:
		return nil, fmt.Errorf("无效的忽略规则模式")
	}
}

func ValidateProject(project Project) error {
	if _, err := Compile(nil, project); err != nil {
		return err
	}
	if project.Mode == Inherit {
		_, err := compileRules(nil, project.Rules)
		return err
	}
	return nil
}

func compileRules(m Matcher, lines []string) (Matcher, error) {
	if len(lines) > 500 {
		return nil, fmt.Errorf("每套忽略规则最多 500 行")
	}
	for i, line := range lines {
		r, err := compileLine(line)
		if err != nil {
			return nil, fmt.Errorf("无效的忽略规则（行）: %d", i+1)
		}
		if len(r.parts) != 0 {
			m = append(m, r)
		}
	}
	return m, nil
}

func compileLine(line string) (rule, error) {
	var r rule
	if len(line) > 1024 || strings.ContainsAny(line, "\x00\r\n") {
		return r, fmt.Errorf("invalid rule line")
	}
	// Git drops unescaped trailing spaces, but keeps leading whitespace.
	for strings.HasSuffix(line, " ") {
		slashes := 0
		for i := len(line) - 2; i >= 0 && line[i] == '\\'; i-- {
			slashes++
		}
		if slashes%2 != 0 {
			break
		}
		line = line[:len(line)-1]
	}
	if line == "" || line[0] == '#' {
		return r, nil
	}
	line, r.include = strings.CutPrefix(line, "!")
	line, r.dirOnly = strings.CutSuffix(line, "/")
	r.anchored = strings.Contains(line, "/")
	line = strings.TrimPrefix(line, "/")
	if line == "" {
		return r, nil
	}
	for part, rest, more := strings.Cut(line, "/"); ; part, rest, more = strings.Cut(rest, "/") {
		// A backslash may quote a path separator without changing its meaning.
		if more {
			end := strings.TrimRight(part, "\\")
			if (len(part)-len(end))%2 != 0 {
				part = part[:len(part)-1]
			}
		}
		if r.anchored && part == "**" {
			r.parts = append(r.parts, nil)
		} else {
			glob, err := compilePart(part)
			if err != nil {
				return rule{}, err
			}
			r.parts = append(r.parts, glob)
		}
		if !more {
			break
		}
	}
	return r, nil
}

func compilePart(part string) (*regexp.Regexp, error) {
	var b strings.Builder
	b.WriteString("(?s)^")
	chars := []rune(part)
	for i := 0; i < len(chars); i++ {
		switch c := chars[i]; c {
		case '\\':
			i++
			if i == len(chars) {
				return nil, fmt.Errorf("unfinished escape")
			}
			b.WriteString(regexp.QuoteMeta(string(chars[i])))
		case '*':
			for i+1 < len(chars) && chars[i+1] == '*' {
				i++
			}
			b.WriteString(".*")
		case '?':
			b.WriteByte('.')
		case '[':
			end, err := writeClass(&b, chars, i+1)
			if err != nil {
				return nil, err
			}
			i = end
		default:
			b.WriteString(regexp.QuoteMeta(string(c)))
		}
	}
	b.WriteByte('$')
	return regexp.Compile(b.String())
}

func writeClass(b *strings.Builder, chars []rune, i int) (int, error) {
	b.WriteByte('[')
	if i < len(chars) && (chars[i] == '!' || chars[i] == '^') {
		b.WriteByte('^')
		i++
	}
	start := i
	for ; i < len(chars); i++ {
		switch {
		case chars[i] == ']' && i > start:
			b.WriteByte(']')
			return i, nil
		case chars[i] == '\\' && i+1 < len(chars):
			i++
			fmt.Fprintf(b, "\\x{%x}", chars[i])
		case chars[i] == '[' && i+1 < len(chars) && chars[i+1] == ':':
			end := i + 2
			for end+1 < len(chars) && !(chars[end] == ':' && chars[end+1] == ']') {
				end++
			}
			if end+1 >= len(chars) {
				return 0, fmt.Errorf("unfinished character class")
			}
			b.WriteString(string(chars[i : end+2]))
			i = end + 1
		case chars[i] == ']':
			b.WriteString(`\]`)
		case chars[i] == '[' || chars[i] == '^':
			b.WriteByte('\\')
			b.WriteRune(chars[i])
		default:
			b.WriteRune(chars[i])
		}
	}
	return 0, fmt.Errorf("unfinished character class")
}

func (r rule) matches(path []string) bool {
	if !r.anchored {
		return r.parts[0].MatchString(path[len(path)-1])
	}
	// A trailing /** matches contents, not the directory itself.
	pattern, index, star, consumed := 0, 0, -1, 0
	for index < len(path) {
		switch {
		case pattern < len(r.parts) && r.parts[pattern] == nil:
			if pattern == len(r.parts)-1 {
				return true
			}
			star, consumed = pattern, index
			pattern++
		case pattern < len(r.parts) && r.parts[pattern].MatchString(path[index]):
			index++
			pattern++
		case star >= 0:
			consumed++
			index, pattern = consumed, star+1
		default:
			return false
		}
	}
	return pattern == len(r.parts)
}

// Ignored checks an entry whose parents were not ignored. The last match wins.
func (m Matcher) Ignored(path []string, dir bool) bool {
	for _, r := range slices.Backward(m) {
		if (!r.dirOnly || dir) && r.matches(path) {
			return !r.include
		}
	}
	return false
}
