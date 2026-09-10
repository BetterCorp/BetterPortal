<?php
declare(strict_types=1);
require dirname(__DIR__) . '/vendor/autoload.php';

use BetterPortal\Protocol\{Media, NotAcceptable, Sse, HeaderDirectives};

$count = 0;
function same(mixed $actual, mixed $expected): void {
    global $count;
    $count++;
    if ($actual !== $expected) {
        throw new RuntimeException('Mismatch: ' . var_export([$actual, $expected], true));
    }
}
function rejects(callable $fn): void {
    try { $fn(); } catch (InvalidArgumentException) { same(true, true); return; }
    throw new RuntimeException('Expected invalid argument');
}
foreach (json_decode(file_get_contents(__DIR__ . '/media-cases.json'), true, 512, JSON_THROW_ON_ERROR) as $case) {
    try {
        $r = Media::negotiate($case['accept'], $case['available'] ?? ['json', 'html', 'metadata', 'ndjson']);
        $actual = ['status' => 200, 'output' => ['kind' => $r->kind, 'mode' => $r->mode]];
    } catch (NotAcceptable) { $actual = ['status' => 406]; }
    same($actual, $case['expected']);
}
same(Media::negotiate('text/html;fragment="nav.clock";theme=evil')->fragment, 'nav.clock');
rejects(fn() => Media::negotiate(null, ['unknown']));
rejects(fn() => Media::negotiate("\n"));
rejects(fn() => Media::negotiate('application/x-ndjson'));
same(Sse::encode(''), "data: \n\n");
same(Sse::encode("one\r\ntwo\rthree\n", 'tick', '', 0), "event: tick\ndata: one\ndata: two\ndata: three\ndata: \nid: \nretry: 0\n\n");
same(Sse::encode("é\u{2028}x"), "data: é\u{2028}x\n\n");
same(Sse::encode('é', maxDataBytes: 2), "data: é\n\n");
rejects(fn() => Sse::encode('é', maxDataBytes: 1));
rejects(fn() => Sse::encode('', maxDataBytes: 0));
rejects(fn() => Sse::encode("\xff"));
rejects(fn() => Sse::encode('x', event: "tick\ndata: injected"));
rejects(fn() => Sse::encode('x', id: "a\0b"));
rejects(fn() => Sse::encode('x', event: str_repeat('é', 513)));
rejects(fn() => Sse::encode('x', retry: -1));
$headers = new HeaderDirectives();
$headers->set('Authorization', 'Bearer token', true, true, 1700000000, '/refresh', 60);
same($headers->emit(), [['BP-SetHeader', 'Authorization=Bearer token; locked=true; scope=true; expires=1700000000; refresh=/refresh; refreshBefore=60']]);
$headers->remove('authorization');
same($headers->emit(), [['BP-RemoveHeader', 'authorization']]);
$headers->set('AUTHORIZATION', 'next');
same($headers->emit(), [['BP-SetHeader', 'AUTHORIZATION=next']]);
$headers->set('X-Next', 'a=b', expires: 1, refreshBeforeSeconds: 0);
same($headers->emit()[1], ['BP-SetHeader', 'X-Next=a=b; expires=1; refreshBefore=0']);
$before = $headers->emit();
foreach (["x\r\ny", 'x; locked=true', 'x,y', "\x7f", "\xff", str_repeat('x', 8193)] as $value) {
    rejects(fn() => $headers->set('Authorization', $value));
}
foreach (['https://evil.test', '//evil.test', '/a;b', '/a,b', '/a b', '/a#b', '/a\\b'] as $path) {
    rejects(fn() => $headers->set('Authorization', 'x', refreshPath: $path));
}
rejects(fn() => $headers->set('Bad:Name', 'x'));
rejects(fn() => $headers->remove(''));
rejects(fn() => $headers->set('X', 'x', expires: -1));
rejects(fn() => $headers->set('AUTHORIZATION', 'invalid', expires: 0));
same($headers->emit(), $before);
echo "$count checks passed\n";
