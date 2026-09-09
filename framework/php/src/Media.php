<?php
declare(strict_types=1);

namespace BetterPortal\Protocol;

/** Bounded BP Accept parsing; application data validation still belongs to AnyVali. */
final class Media
{
    private const MIME = [
        'json' => 'application/json', 'html' => 'text/html',
        'metadata' => 'application/vnd.betterportal.metadata+json',
        'ndjson' => 'application/x-ndjson',
    ];

    /**
     * Select by specificity, quality and request order, preserving q=0 exclusions.
     * Hosts must supply only available representations and independently enforce
     * scope, authorization, query selectors and the exact app shell renderer.
     * @param list<string> $available Explicit operation capabilities; streams are opt-in.
     * @throws NotAcceptable for malformed headers or no acceptable representation.
     */
    public static function negotiate(?string $accept, array $available = ['json', 'html']): Representation
    {
        foreach ($available as $kind) {
            if (!is_string($kind) || !isset(self::MIME[$kind])) {
                throw new \InvalidArgumentException('Unknown representation');
            }
        }
        $raw = $accept ?? '';
        if (strlen($raw) > 8192 || preg_match('/[\x00-\x08\x0a-\x1f\x7f]/', $raw)) {
            throw new NotAcceptable('Invalid Accept header');
        }
        if (trim($raw, " \t") === '') {
            $raw = '*/*';
        }
        $entries = self::ranges($raw);
        $winner = null;
        $best = null;
        foreach (self::MIME as $kind => $mime) {
            if (!in_array($kind, $available, true)) {
                continue;
            }
            foreach ($kind === 'html' ? ['page', 'fragment', 'embed'] : [null] as $mode) {
                $match = null;
                $selected = null;
                foreach ($entries as $index => [$media, $quality, $params]) {
                    if ($kind === 'html' && ($params['mode'] ?? 'page') !== $mode) {
                        continue;
                    }
                    $specificity = $media === $mime ? 2 : ($media === explode('/', $mime)[0] . '/*' ? 1 : ($media === '*/*' ? 0 : -1));
                    if ($specificity < 0) {
                        continue;
                    }
                    $rank = [$specificity + (int)($kind === 'html' && isset($params['mode'])), $quality, -$index];
                    if ($match === null || $rank > $match) {
                        $match = $rank;
                        $selected = $params;
                    }
                }
                if ($match !== null && $match[1] > 0) {
                    $rank = [$match[1], $match[2]];
                    if ($best === null || $rank > $best) {
                        $best = $rank;
                        $winner = new Representation($kind, $mode, $kind === 'html' ? ($selected['fragment'] ?? null) : null);
                    }
                }
            }
        }
        return $winner ?? throw new NotAcceptable('No acceptable representation');
    }

    private static function ranges(string $raw): array
    {
        $token = "[!#$%&'*+.^_`|~A-Za-z0-9-]+";
        $range = '{\G(' . $token . '/' . $token . ')[ \t]*}';
        $parameter = '{\G;[ \t]*(' . $token . ')[ \t]*=[ \t]*(' . $token . '|"(?:[\t !#-\[\]-~\x80-\xff]|\\\\[\t !-~\x80-\xff])*")[ \t]*}';
        $entries = [];
        $position = 0;
        while ($position < strlen($raw)) {
            if (str_contains(" \t,", $raw[$position])) {
                $position++;
                continue;
            }
            if (!preg_match($range, $raw, $match, 0, $position)) {
                throw new NotAcceptable('Invalid media range');
            }
            $media = strtolower($match[1]);
            $position += strlen($match[0]);
            if (str_starts_with($media, '*/') && $media !== '*/*') {
                throw new NotAcceptable('Invalid media wildcard');
            }
            $params = [];
            while ($position < strlen($raw) && $raw[$position] === ';') {
                if (!preg_match($parameter, $raw, $match, 0, $position) || array_key_exists(strtolower($match[1]), $params)) {
                    throw new NotAcceptable('Invalid media parameters');
                }
                $params[strtolower($match[1])] = $match[2];
                $position += strlen($match[0]);
            }
            if ($position < strlen($raw) && $raw[$position] !== ',') {
                throw new NotAcceptable('Invalid media range');
            }
            $quality = $params['q'] ?? '1';
            if (!preg_match('/\A(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)\z/', $quality)) {
                throw new NotAcceptable('Invalid media quality');
            }
            foreach ($params as &$value) {
                if (str_starts_with($value, '"')) {
                    $value = preg_replace('/\\\\(.)/s', '$1', substr($value, 1, -1));
                }
            }
            unset($value);
            $entries[] = [$media, (float)$quality, $params];
        }
        return $entries;
    }
}
