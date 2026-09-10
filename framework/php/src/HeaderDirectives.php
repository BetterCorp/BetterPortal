<?php
declare(strict_types=1);

namespace BetterPortal\Protocol;

/** Per-response BP directives. Never share a collector between requests. */
final class HeaderDirectives
{
    private array $pending = [];
    private array $removed = [];

    /**
     * Queue a browser-managed header; names are case-insensitive and last action wins.
     * Expiry is a positive absolute Unix timestamp in seconds.
     * Refresh lead time, when supplied, must be positive for shell compatibility.
     * Delimiters are rejected because the shell's directive format has no escaping.
     * @throws \InvalidArgumentException before mutating state if an argument is unsafe.
     */
    public function set(string $name, string $value, bool $locked = false, bool $scopeToOwner = false, ?int $expires = null, ?string $refreshPath = null, ?int $refreshBeforeSeconds = null): void
    {
        self::validateName($name);
        if (strlen($value) > 8192 || preg_match('/[\x00-\x1f\x7f-\xff;,]/', $value)) {
            throw new \InvalidArgumentException('Invalid BP header value');
        }
        if (($expires !== null && $expires <= 0) || ($refreshBeforeSeconds !== null && $refreshBeforeSeconds <= 0)) {
            throw new \InvalidArgumentException('Invalid BP header time');
        }
        if ($refreshPath !== null && (strlen($refreshPath) > 2048 || !str_starts_with($refreshPath, '/') || str_starts_with($refreshPath, '//') || preg_match('/[\x00-\x20\x7f-\xff;,\\\\#]/', $refreshPath))) {
            throw new \InvalidArgumentException('Refresh path must be a root-relative service URL');
        }
        $parts = [$name . '=' . $value];
        if ($locked) { $parts[] = 'locked=true'; }
        if ($scopeToOwner) { $parts[] = 'scope=true'; }
        if ($expires !== null) { $parts[] = 'expires=' . $expires; }
        if ($refreshPath !== null) { $parts[] = 'refresh=' . $refreshPath; }
        if ($refreshBeforeSeconds !== null) { $parts[] = 'refreshBefore=' . $refreshBeforeSeconds; }
        $key = strtolower($name);
        $this->pending[$key] = implode('; ', $parts);
        unset($this->removed[$key]);
    }

    /** Queue removal of any earlier set directive for this case-insensitive name. */
    public function remove(string $name): void
    {
        self::validateName($name);
        $key = strtolower($name);
        unset($this->pending[$key]);
        $this->removed[$key] = $name;
    }

    /** @return list<array{string, string}> Header pairs; hosts append each without replacement. */
    public function emit(): array
    {
        $result = [];
        foreach ($this->pending as $value) { $result[] = ['BP-SetHeader', $value]; }
        foreach ($this->removed as $value) { $result[] = ['BP-RemoveHeader', $value]; }
        return $result;
    }

    private static function validateName(string $name): void
    {
        if (!preg_match('/\A[A-Za-z0-9_-]{1,128}\z/', $name)) {
            throw new \InvalidArgumentException('Invalid BP header name');
        }
    }
}
