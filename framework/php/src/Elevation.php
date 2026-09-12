<?php
declare(strict_types=1);
namespace BetterPortal\Protocol;

/** Protocol helper only: the host MUST verify the JWT, scope and permissions first. */
final class Elevation
{
    /** Returns null when satisfied, otherwise a 401 challenge. Invalid requirements fail closed. */
    public static function challenge(?array $verifiedUser, array $requirement, ?int $now = null): ?array
    {
        $minimum = $requirement['minimum'] ?? null;
        $age = $requirement['maxAgeSeconds'] ?? null;
        if (!in_array($minimum, ['confirm', 'mfa'], true) || ($age !== null && (!is_int($age) || $age < 1))) throw new \InvalidArgumentException('Invalid elevation requirement');
        $now ??= time();
        if ($verifiedUser === null || ($verifiedUser['tokenType'] ?? null) !== 'access' || !isset($verifiedUser['tenantId'], $verifiedUser['appId'], $verifiedUser['exp']) || $verifiedUser['exp'] <= $now) throw new \RuntimeException('Verified human authentication required');
        $e = $verifiedUser['elevation'] ?? null;
        if (is_array($e) && in_array($e['assurance'] ?? null, ['confirmed', 'mfa'], true)
            && is_int($e['verifiedAt'] ?? null) && is_int($e['expiresAt'] ?? null)
            && 0 <= $e['verifiedAt'] && $e['verifiedAt'] <= $now && $now < $e['expiresAt'] && $e['expiresAt'] <= $verifiedUser['exp']
            && ($minimum !== 'mfa' || $e['assurance'] === 'mfa') && ($age === null || $now - $e['verifiedAt'] <= $age)) return null;
        $challenge = ['version' => 1, 'tenantId' => $verifiedUser['tenantId'], 'appId' => $verifiedUser['appId'], 'minimum' => $minimum];
        $authenticate = 'Bearer error="insufficient_user_authentication", acr_values="urn:betterportal:' . ($minimum === 'mfa' ? 'mfa' : 'confirmed') . '"';
        if ($age !== null) { $challenge['maxAgeSeconds'] = $age; $authenticate .= ', max_age="' . $age . '"'; }
        return ['status' => 401, 'headers' => ['WWW-Authenticate' => $authenticate, 'BP-Auth-Challenge' => json_encode($challenge, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), 'Cache-Control' => 'no-store'], 'body' => ['error' => 'insufficient_user_authentication', ...$challenge]];
    }
}
