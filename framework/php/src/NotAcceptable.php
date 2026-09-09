<?php
declare(strict_types=1);

namespace BetterPortal\Protocol;

/** The host should translate this negotiation failure to HTTP 406. */
final class NotAcceptable extends \InvalidArgumentException
{
}
