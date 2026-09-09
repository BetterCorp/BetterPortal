<?php
declare(strict_types=1);
require dirname(__DIR__) . '/vendor/autoload.php';

use BetterPortal\Protocol\{Media, Sse, HeaderDirectives};

$representation = Media::negotiate('text/html;mode=fragment,application/json;q=0.5');
echo $representation->kind . ':' . $representation->mode . "\n";
echo Sse::encode('<span>Ready</span>', event: 'status');
$directives = new HeaderDirectives();
$directives->remove('Authorization');
foreach ($directives->emit() as [$name, $value]) {
    echo $name . ': ' . $value . "\n";
}
