<?php
declare(strict_types=1);

namespace BetterPortal\Protocol;

/** A requested representation, never an authorization or renderer decision. */
final class Representation
{
    public function __construct(
        public readonly string $kind,
        public readonly ?string $mode = null,
        public readonly ?string $fragment = null,
    ) {
    }
}
