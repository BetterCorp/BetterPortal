import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import uri from "fast-uri";
import serialize from "serialize-javascript";

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

function expandInChild(patternExpression) {
  const script = `import { expand } from "brace-expansion";
    process.stdout.write(String(expand(${patternExpression}).length));`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    timeout: 5000
  });
}

test("CVE-2026-102277: brace rewrite cannot stall the event loop", () => {
  assert.equal(expandInChild('"{a}" + "}".repeat(128_000) + ",z}"'), "1");
});

test("CVE-2026-102276: comma parsing cannot exhaust the call stack", () => {
  assert.ok(Number(expandInChild('"{" + "{a},".repeat(7_000) + "b}"')) > 0);
});

test("CVE-2026-102278: nested groups cannot exhaust the call stack", () => {
  assert.ok(Number(expandInChild('"{".repeat(3_200) + "a,b" + "}".repeat(3_200)')) > 0);
});

test("CVE-2026-86472: encoded uppercase host cannot evade a case-sensitive host check", () => {
  assert.equal(uri.parse("//%41.com").host, "a.com");
  assert.equal(uri.equal("//%41.com", "//a.com"), true);
});

test("CVE-2026-97711: serialized function cannot terminate its containing script", () => {
  const functionSource = "return function f(x){ return x</script=+/ + '</script><img src=x onerror=alert(1)>' }";
  const functionValue = new Function(functionSource)();
  const output = serialize({ handler: functionValue });
  assert.doesNotMatch(output, /<\/script(?:[\t\n\f\r />])/i);
  assert.match(output, /\\u003C\\u002Fscript/);
});

test("locked dependencies retain patched versions for the advisory groups", () => {
  for (const [name, minimum] of [
    ["brace-expansion", [5, 0, 12]],
    ["fast-uri", [3, 1, 8]],
    ["serialize-javascript", [7, 1, 2]]
  ]) {
    const version = lock.packages[`node_modules/${name}`]?.version;
    assert.ok(version, `${name} must be present in the lockfile`);
    const actual = version.split(".").map(Number);
    assert.ok(actual[0] > minimum[0] || (actual[0] === minimum[0] &&
      (actual[1] > minimum[1] || (actual[1] === minimum[1] && actual[2] >= minimum[2]))),
    `${name}@${version} is below the patched version ${minimum.join(".")}`);
  }
});
