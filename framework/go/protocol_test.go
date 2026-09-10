package protocol

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"
)

func ptr[T any](value T) *T { return &value }
func TestNegotiationCorpus(t *testing.T) {
	data, err := os.ReadFile("testdata/media-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		ID        string   `json:"id"`
		Accept    string   `json:"accept"`
		Available []string `json:"available"`
		Expected  struct {
			Status int            `json:"status"`
			Output Representation `json:"output"`
		} `json:"expected"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.ID, func(t *testing.T) {
			available := c.Available
			if available == nil {
				available = []string{"json", "html", "metadata", "ndjson"}
			}
			got, err := Negotiate(c.Accept, available)
			if c.Expected.Status == 406 {
				if !errors.Is(err, ErrNotAcceptable) {
					t.Fatalf("wanted 406, got %+v / %v", got, err)
				}
				return
			}
			if err != nil || !reflect.DeepEqual(got, c.Expected.Output) {
				t.Fatalf("got %+v / %v, expected %+v", got, err, c.Expected.Output)
			}
		})
	}
}
func TestNegotiationBoundaries(t *testing.T) {
	for _, raw := range []string{"application/x-ndjson", "application/vnd.betterportal.metadata+json", "\n", strings.Repeat(" ", 8193)} {
		if _, err := Negotiate(raw, nil); !errors.Is(err, ErrNotAcceptable) {
			t.Fatalf("accepted %q", raw)
		}
	}
	if _, err := Negotiate("", []string{"bad"}); err == nil {
		t.Fatal("unknown offer accepted")
	}
	result, err := Negotiate(`text/html;fragment="nav.clock";theme=evil`, nil)
	if err != nil || result.Fragment == nil || *result.Fragment != "nav.clock" {
		t.Fatalf("%+v %v", result, err)
	}
}
func TestSse(t *testing.T) {
	cases := []struct {
		data    string
		options EventOptions
		want    string
	}{
		{"", EventOptions{}, "data: \n\n"},
		{"one\r\ntwo\rthree\n", EventOptions{Event: ptr("tick"), ID: ptr(""), Retry: ptr(int64(0))}, "event: tick\ndata: one\ndata: two\ndata: three\ndata: \nid: \nretry: 0\n\n"},
		{"é\u2028x", EventOptions{}, "data: é\u2028x\n\n"},
		{"é", EventOptions{MaxDataBytes: 2}, "data: é\n\n"},
	}
	for _, c := range cases {
		got, err := EncodeEvent(c.data, c.options)
		if err != nil || string(got) != c.want {
			t.Fatalf("%q / %v != %q", got, err, c.want)
		}
	}
	for _, c := range []struct {
		data    string
		options EventOptions
	}{
		{"é", EventOptions{MaxDataBytes: 1}}, {"", EventOptions{MaxDataBytes: -1}},
		{"\xff", EventOptions{}}, {"x", EventOptions{Event: ptr("x\ndata: injected")}},
		{"x", EventOptions{ID: ptr("a\x00b")}}, {"x", EventOptions{Event: ptr(strings.Repeat("é", 513))}},
		{"x", EventOptions{Retry: ptr(int64(-1))}}, {"x", EventOptions{ID: ptr("\xff")}},
		{strings.Repeat("x", 1048577), EventOptions{}},
	} {
		if _, err := EncodeEvent(c.data, c.options); err == nil {
			t.Fatal("accepted invalid event")
		}
	}
}
func TestHeaderDirectives(t *testing.T) {
	var h HeaderDirectives
	if err := h.Set("Authorization", "Bearer token", HeaderOptions{Locked: true, ScopeToOwner: true, Expires: ptr(int64(1700000000)), RefreshPath: ptr("/refresh"), RefreshBeforeSeconds: ptr(int64(60))}); err != nil {
		t.Fatal(err)
	}
	want := []HeaderPair{{"BP-SetHeader", "Authorization=Bearer token; locked=true; scope=true; expires=1700000000; refresh=/refresh; refreshBefore=60"}}
	if !reflect.DeepEqual(h.Emit(), want) {
		t.Fatal(h.Emit())
	}
	if err := h.Remove("authorization"); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(h.Emit(), []HeaderPair{{"BP-RemoveHeader", "authorization"}}) {
		t.Fatal(h.Emit())
	}
	if err := h.Set("AUTHORIZATION", "next", HeaderOptions{}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(h.Emit(), []HeaderPair{{"BP-SetHeader", "AUTHORIZATION=next"}}) {
		t.Fatal(h.Emit())
	}
	if err := h.Set("X-Next", "a=b", HeaderOptions{Expires: ptr(int64(1)), RefreshBeforeSeconds: ptr(int64(0))}); err != nil {
		t.Fatal(err)
	}
	if got := h.Emit(); len(got) != 2 || got[1].Value != "X-Next=a=b; expires=1; refreshBefore=0" {
		t.Fatal(got)
	}
	before := h.Emit()
	for _, value := range []string{"x\r\ny", "x; locked=true", "x,y", "\x7f", "\xff", strings.Repeat("x", 8193)} {
		if err := h.Set("Authorization", value, HeaderOptions{}); err == nil {
			t.Fatal("invalid value accepted")
		}
	}
	for _, path := range []string{"https://evil.test", "//evil.test", "/a;b", "/a,b", "/a b", "/a#b", "/a\\b"} {
		if err := h.Set("Authorization", "x", HeaderOptions{RefreshPath: &path}); err == nil {
			t.Fatal("invalid path accepted")
		}
	}
	if err := h.Set("Bad:Name", "x", HeaderOptions{}); err == nil {
		t.Fatal("invalid name accepted")
	}
	if err := h.Remove(""); err == nil {
		t.Fatal("empty name accepted")
	}
	if err := h.Set("AUTHORIZATION", "invalid", HeaderOptions{Expires: ptr(int64(0))}); err == nil {
		t.Fatal("expected zero expiry rejection")
	}
	if err := h.Set("X", "x", HeaderOptions{Expires: ptr(int64(-1))}); err == nil {
		t.Fatal("negative time accepted")
	}
	if !reflect.DeepEqual(h.Emit(), before) {
		t.Fatal("failed mutation changed collector")
	}
	snapshot := h.Emit()
	snapshot[0].Value = "modified"
	if !reflect.DeepEqual(h.Emit(), before) {
		t.Fatal("snapshot aliases collector")
	}
}
func FuzzNegotiate(f *testing.F) {
	for _, seed := range []string{"", "application/json", `text/html;mode="fragment"`, "*/*;q=0", "\xff"} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, raw string) {
		got, err := Negotiate(raw, nil)
		if err == nil && got.Kind != "json" && got.Kind != "html" {
			t.Fatalf("unoffered representation: %+v", got)
		}
	})
}
