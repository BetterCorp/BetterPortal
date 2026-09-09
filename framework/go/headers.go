package protocol

import (
	"fmt"
	"strconv"
	"strings"
)

// HeaderOptions configures a BP-SetHeader directive. Expires is an absolute Unix
// timestamp in seconds. RefreshPath is a URL-encoded root-relative service path.
type HeaderOptions struct {
	Locked               bool
	ScopeToOwner         bool
	Expires              *int64
	RefreshPath          *string
	RefreshBeforeSeconds *int64
}

// HeaderPair must be appended without replacing other values of the same name.
type HeaderPair struct{ Name, Value string }

// HeaderDirectives collects one response's browser-managed header updates.
// The zero value is ready to use. It is not safe for concurrent mutation; create
// one per request. It neither persists credentials nor authenticates a caller.
type HeaderDirectives struct{ pending, removed []HeaderPair }

// Set validates all fields before changing state. Last action wins regardless
// of header-name case. Delimiters are rejected because BP has no escaping syntax.
func (h *HeaderDirectives) Set(name, value string, options HeaderOptions) error {
	if !validHeaderName(name) {
		return fmt.Errorf("invalid BP header name")
	}
	if len(value) > 8192 || unsafeDirective(value, false) {
		return fmt.Errorf("invalid BP header value")
	}
	if options.Expires != nil && *options.Expires < 0 || options.RefreshBeforeSeconds != nil && *options.RefreshBeforeSeconds < 0 {
		return fmt.Errorf("invalid BP header time")
	}
	if path := options.RefreshPath; path != nil {
		if len(*path) > 2048 || !strings.HasPrefix(*path, "/") || strings.HasPrefix(*path, "//") || unsafeDirective(*path, true) {
			return fmt.Errorf("refresh path must be a root-relative service URL")
		}
	}
	parts := []string{name + "=" + value}
	if options.Locked {
		parts = append(parts, "locked=true")
	}
	if options.ScopeToOwner {
		parts = append(parts, "scope=true")
	}
	if options.Expires != nil {
		parts = append(parts, "expires="+strconv.FormatInt(*options.Expires, 10))
	}
	if options.RefreshPath != nil {
		parts = append(parts, "refresh="+*options.RefreshPath)
	}
	if options.RefreshBeforeSeconds != nil {
		parts = append(parts, "refreshBefore="+strconv.FormatInt(*options.RefreshBeforeSeconds, 10))
	}
	h.removed = without(h.removed, name)
	for i := range h.pending {
		if strings.EqualFold(h.pending[i].Name, name) {
			h.pending[i] = HeaderPair{name, strings.Join(parts, "; ")}
			return nil
		}
	}
	h.pending = append(h.pending, HeaderPair{name, strings.Join(parts, "; ")})
	return nil
}

// Remove replaces any earlier set for this case-insensitive header name.
func (h *HeaderDirectives) Remove(name string) error {
	if !validHeaderName(name) {
		return fmt.Errorf("invalid BP header name")
	}
	h.pending = without(h.pending, name)
	for i := range h.removed {
		if strings.EqualFold(h.removed[i].Name, name) {
			h.removed[i].Name = name
			return nil
		}
	}
	h.removed = append(h.removed, HeaderPair{Name: name})
	return nil
}

// Emit returns an owned snapshot. It does not consume pending directives.
func (h *HeaderDirectives) Emit() []HeaderPair {
	out := make([]HeaderPair, 0, len(h.pending)+len(h.removed))
	for _, pair := range h.pending {
		out = append(out, HeaderPair{"BP-SetHeader", pair.Value})
	}
	for _, pair := range h.removed {
		out = append(out, HeaderPair{"BP-RemoveHeader", pair.Name})
	}
	return out
}
func without(pairs []HeaderPair, name string) []HeaderPair {
	out := pairs[:0]
	for _, pair := range pairs {
		if !strings.EqualFold(pair.Name, name) {
			out = append(out, pair)
		}
	}
	return out
}
func validHeaderName(name string) bool {
	if len(name) == 0 || len(name) > 128 {
		return false
	}
	for i := 0; i < len(name); i++ {
		c := name[i]
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
func unsafeDirective(value string, path bool) bool {
	for i := 0; i < len(value); i++ {
		c := value[i]
		if c < 32 || c >= 127 || c == ';' || c == ',' || path && (c == ' ' || c == '\\' || c == '#') {
			return true
		}
	}
	return false
}
