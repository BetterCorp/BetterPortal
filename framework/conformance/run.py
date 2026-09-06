"""Run identical language-neutral HTTP cases against one or more loopback adapters."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from security_cases import run_security
from key_cases import run_keys
from encryption_cases import run_encryption
from authorization_cases import run_authorization
from media_cases import run_media
from stream_cases import run_streams
from sse_cases import run_sse
from context_cases import run_context


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--labels", nargs="+")
    parser.add_argument("--all-contracts", action="store_true")
    parser.add_argument("--roundtrip-all", action="store_true")
    parser.add_argument("--suite", choices=["schema", "security", "keys", "encryption", "authorization", "media", "streams", "sse", "context", "all"], default="all")
    args = parser.parse_args()
    cases = json.loads(Path(__file__).with_name("schema-cases.json").read_text())
    if args.labels and len(args.labels) != len(args.urls):
        parser.error("--labels must match the URL count")
    if args.all_contracts:
        cases += [{"id": "import-" + path.stem, "contract": path.stem, "action": "import", "output": True}
                  for path in sorted(Path(__file__).with_name("contracts").glob("*.json"))]
    if args.roundtrip_all:
        cases += [{**case, "id": case["id"] + "-roundtrip", "roundtrip": True} for case in cases]
    if args.suite not in ("schema", "all"):
        cases = []
    failures = []
    results = []
    for index, url in enumerate(args.urls):
        label = args.labels[index] if args.labels else url
        for case in cases:
            result = {"runtime": label, "id": case["id"], "passed": False}
            try:
                request = Request(url, json.dumps(case).encode(), {"Content-Type": "application/json"})
                with urlopen(request, timeout=10) as response:
                    actual = json.load(response)
                assert actual["valid"] == case.get("valid", True), actual
                if actual["valid"]:
                    assert actual["output"] == case["output"], actual
                result["passed"] = True
            except HTTPError as error:
                result["error"] = f'HTTP {error.code}: {error.read().decode()[:300]}'
            except Exception as error:
                result["error"] = str(error)
            if not result["passed"]:
                failures.append(f'{label} {case["id"]}: {result["error"]}')
            results.append(result)
    if args.suite in ("security", "all"):
        security = run_security(args.urls, args.labels or args.urls)
        results += security
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in security if not result["passed"]]
    if args.suite in ("keys", "all"):
        keys = run_keys(args.urls, args.labels or args.urls)
        results += keys
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in keys if not result["passed"]]
    if args.suite in ("encryption", "all"):
        encryption = run_encryption(args.urls, args.labels or args.urls)
        results += encryption
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in encryption if not result["passed"]]
    if args.suite in ("authorization", "all"):
        authorization = run_authorization(args.urls, args.labels or args.urls)
        results += authorization
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in authorization if not result["passed"]]
    if args.suite in ("media", "all"):
        media = run_media(args.urls, args.labels or args.urls)
        results += media
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in media if not result["passed"]]
    if args.suite in ("streams", "all"):
        streams = run_streams(args.urls, args.labels or args.urls)
        results += streams
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in streams if not result["passed"]]
    if args.suite in ("sse", "all"):
        sse = run_sse(args.urls, args.labels or args.urls)
        results += sse
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in sse if not result["passed"]]
    if args.suite in ("context", "all"):
        context = run_context(args.urls, args.labels or args.urls)
        results += context
        failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in context if not result["passed"]]
    print(f"{len(results) - len(failures)}/{len(results)} {args.suite} scenarios passed")
    for failure in failures:
        print(failure)
    if args.report:
        args.report.write_text(json.dumps({"scenarios": len(results), "passed": len(results) - len(failures), "results": results}, indent=2) + "\n", encoding="utf-8")
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
