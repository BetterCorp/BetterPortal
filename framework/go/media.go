// Package protocol supplies experimental BetterPortal wire primitives.
// It does not implement service hosting, schema validation or authorization.
package protocol

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// ErrNotAcceptable maps to HTTP 406 in a host adapter.
var ErrNotAcceptable = errors.New("no acceptable representation or malformed Accept header")

// Representation describes requested presentation, never authority or a renderer.
type Representation struct {
	Kind     string  `json:"kind"`
	Mode     *string `json:"mode"`
	Fragment *string `json:"fragment,omitempty"`
}

var mimeKinds = []struct{ kind, mime string }{
	{"json", "application/json"}, {"html", "text/html"},
	{"metadata", "application/vnd.betterportal.metadata+json"}, {"ndjson", "application/x-ndjson"},
}
var qualityPattern = regexp.MustCompile(`^(0(\.[0-9]{0,3})?|1(\.0{0,3})?)$`)

type mediaRange struct {
	media   string
	quality float64
	params  map[string]string
}

// Negotiate applies specificity, quality and request-order ties, including q=0.
// A nil available slice offers JSON/HTML; an empty slice offers nothing. Metadata
// and NDJSON require explicit availability. Hosts still enforce authorization,
// query selectors and an exact renderer from the trusted app shell.
func Negotiate(accept string, available []string) (Representation, error) {
	if available == nil {
		available = []string{"json", "html"}
	}
	supported := map[string]bool{}
	for _, kind := range available {
		found := false
		for _, item := range mimeKinds {
			if kind == item.kind {
				found = true
			}
		}
		if !found {
			return Representation{}, fmt.Errorf("unknown representation: %s", kind)
		}
		supported[kind] = true
	}
	if len(accept) > 8192 {
		return Representation{}, ErrNotAcceptable
	}
	for i := 0; i < len(accept); i++ {
		if accept[i] < 32 && accept[i] != '\t' || accept[i] == 127 {
			return Representation{}, ErrNotAcceptable
		}
	}
	if strings.Trim(accept, " \t") == "" {
		accept = "*/*"
	}
	entries, err := parseRanges(accept)
	if err != nil {
		return Representation{}, err
	}
	bestQ, bestOrder := -1.0, len(entries)
	var result Representation
	for _, item := range mimeKinds {
		if !supported[item.kind] {
			continue
		}
		modes := []string{""}
		if item.kind == "html" {
			modes = []string{"page", "fragment", "embed"}
		}
		for _, mode := range modes {
			specificity, quality, order := -1, -1.0, len(entries)
			var params map[string]string
			for index, entry := range entries {
				requested, hasMode := entry.params["mode"]
				if !hasMode {
					requested = "page"
				}
				if item.kind == "html" && requested != mode {
					continue
				}
				score := -1
				switch entry.media {
				case item.mime:
					score = 2
				case strings.Split(item.mime, "/")[0] + "/*":
					score = 1
				case "*/*":
					score = 0
				}
				if score < 0 {
					continue
				}
				if item.kind == "html" && hasMode {
					score++
				}
				if score > specificity || score == specificity && (entry.quality > quality || entry.quality == quality && index < order) {
					specificity, quality, order, params = score, entry.quality, index, entry.params
				}
			}
			if quality > 0 && (quality > bestQ || quality == bestQ && order < bestOrder) {
				bestQ, bestOrder = quality, order
				result = Representation{Kind: item.kind}
				if item.kind == "html" {
					value := mode
					result.Mode = &value
					if fragment, ok := params["fragment"]; ok {
						result.Fragment = &fragment
					}
				}
			}
		}
	}
	if bestQ < 0 {
		return Representation{}, ErrNotAcceptable
	}
	return result, nil
}

func isToken(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || strings.ContainsRune("!#$%&'*+-.^_`|~", rune(c))
}
func token(raw string, position *int) string {
	start := *position
	for *position < len(raw) && isToken(raw[*position]) {
		*position++
	}
	return raw[start:*position]
}
func whitespace(raw string, position *int) {
	for *position < len(raw) && (raw[*position] == ' ' || raw[*position] == '\t') {
		*position++
	}
}
func parseRanges(raw string) ([]mediaRange, error) {
	var result []mediaRange
	for p := 0; p < len(raw); {
		if strings.ContainsRune(" \t,", rune(raw[p])) {
			p++
			continue
		}
		major := token(raw, &p)
		if major == "" || p == len(raw) || raw[p] != '/' {
			return nil, ErrNotAcceptable
		}
		p++
		minor := token(raw, &p)
		if minor == "" || major == "*" && minor != "*" {
			return nil, ErrNotAcceptable
		}
		whitespace(raw, &p)
		params := map[string]string{}
		quality := 1.0
		for p < len(raw) && raw[p] == ';' {
			p++
			whitespace(raw, &p)
			name := strings.ToLower(token(raw, &p))
			whitespace(raw, &p)
			if _, exists := params[name]; exists || name == "" || p == len(raw) || raw[p] != '=' {
				return nil, ErrNotAcceptable
			}
			p++
			whitespace(raw, &p)
			quoted := p < len(raw) && raw[p] == '"'
			var value string
			if quoted {
				p++
				var out strings.Builder
				closed := false
				for p < len(raw) {
					c := raw[p]
					p++
					if c == '"' {
						closed = true
						break
					}
					if c == '\\' {
						if p == len(raw) {
							return nil, ErrNotAcceptable
						}
						c = raw[p]
						p++
					}
					if c < 32 && c != '\t' || c == 127 {
						return nil, ErrNotAcceptable
					}
					out.WriteByte(c)
				}
				if !closed {
					return nil, ErrNotAcceptable
				}
				value = out.String()
			} else {
				value = token(raw, &p)
				if value == "" {
					return nil, ErrNotAcceptable
				}
			}
			if name == "q" {
				if quoted || !qualityPattern.MatchString(value) {
					return nil, ErrNotAcceptable
				}
				quality, _ = strconv.ParseFloat(value, 64)
			}
			params[name] = value
			whitespace(raw, &p)
		}
		if p < len(raw) && raw[p] != ',' {
			return nil, ErrNotAcceptable
		}
		result = append(result, mediaRange{strings.ToLower(major + "/" + minor), quality, params})
	}
	return result, nil
}
