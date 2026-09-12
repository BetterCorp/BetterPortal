<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/Elevation.php';
$cases = json_decode(file_get_contents(__DIR__ . '/../../conformance/elevation-cases.json'), true, flags: JSON_THROW_ON_ERROR);
foreach ($cases as $case) {
    try { $allowed = \BetterPortal\Protocol\Elevation::challenge($case['user'], $case['requirement'], $case['now']) === null; }
    catch (\Throwable) { $allowed = false; }
    if ($allowed !== $case['allowed']) throw new \RuntimeException($case['name']);
}
echo 'PHP: ' . count($cases) . " shared elevation cases passed\n";
