package protocol

import (
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"
)

// EventOptions controls framing only; nil fields are omitted and empty IDs reset
// the browser's last event ID. Zero MaxDataBytes defaults to 1 MiB.
type EventOptions struct {
	Event        *string
	ID           *string
	Retry        *int64
	MaxDataBytes int
}

// EncodeEvent frames already serialized UTF-8 data. Hosts own AnyVali validation,
// scope, authorization, subscriptions, backpressure, flushing and cancellation.
func EncodeEvent(data string, options EventOptions) ([]byte, error) {
	limit := options.MaxDataBytes
	if limit == 0 {
		limit = 1048576
	}
	if limit < 0 || len(data) > limit || !utf8.ValidString(data) {
		return nil, fmt.Errorf("invalid SSE data or byte limit exceeded")
	}
	for _, value := range []*string{options.Event, options.ID} {
		if value != nil && (len(*value) > 1024 || strings.ContainsAny(*value, "\r\n\x00") || !utf8.ValidString(*value)) {
			return nil, fmt.Errorf("invalid SSE event name or ID")
		}
	}
	if options.Retry != nil && *options.Retry < 0 {
		return nil, fmt.Errorf("SSE retry must be nonnegative")
	}
	var out strings.Builder
	if options.Event != nil {
		out.WriteString("event: " + *options.Event + "\n")
	}
	normalized := strings.ReplaceAll(strings.ReplaceAll(data, "\r\n", "\n"), "\r", "\n")
	for _, line := range strings.Split(normalized, "\n") {
		out.WriteString("data: " + line + "\n")
	}
	if options.ID != nil {
		out.WriteString("id: " + *options.ID + "\n")
	}
	if options.Retry != nil {
		out.WriteString("retry: " + strconv.FormatInt(*options.Retry, 10) + "\n")
	}
	out.WriteByte('\n')
	return []byte(out.String()), nil
}
