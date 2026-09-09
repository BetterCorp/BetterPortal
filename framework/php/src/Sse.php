<?php
declare(strict_types=1);

namespace BetterPortal\Protocol;

/** UTF-8 SSE framing only; hosts own validation, subscriptions, flushing and cancellation. */
final class Sse
{
    /**
     * Encode one message, preserving empty data and Unicode line separators.
     * Data is already serialized text, not an unvalidated application value.
     * @throws \InvalidArgumentException for invalid UTF-8, unsafe fields or exceeded limits.
     */
    public static function encode(string $data, ?string $event = null, ?string $id = null, ?int $retry = null, int $maxDataBytes = 1048576): string
    {
        if ($maxDataBytes < 1 || strlen($data) > $maxDataBytes || preg_match('//u', $data) !== 1) {
            throw new \InvalidArgumentException('Invalid SSE data or byte limit exceeded');
        }
        foreach ([$event, $id] as $value) {
            if ($value !== null && (strlen($value) > 1024 || strpbrk($value, "\r\n\0") !== false || preg_match('//u', $value) !== 1)) {
                throw new \InvalidArgumentException('Invalid SSE event name or ID');
            }
        }
        if ($retry !== null && $retry < 0) {
            throw new \InvalidArgumentException('SSE retry must be nonnegative');
        }
        $fields = $event === null ? [] : ['event: ' . $event];
        foreach (explode("\n", str_replace(["\r\n", "\r"], "\n", $data)) as $line) {
            $fields[] = 'data: ' . $line;
        }
        if ($id !== null) {
            $fields[] = 'id: ' . $id;
        }
        if ($retry !== null) {
            $fields[] = 'retry: ' . $retry;
        }
        return implode("\n", $fields) . "\n\n";
    }
}
