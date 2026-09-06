"""Run identical language-neutral HTTP cases against one or more loopback adapters."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from security_cases import run_security, post
from key_cases import run_keys
from encryption_cases import run_encryption
from authorization_cases import run_authorization
from media_cases import run_media
from stream_cases import run_streams
from sse_cases import run_sse
from context_cases import run_context
from cors_cases import run_cors
from handler_cases import run_handlers
from registry_cases import run_registry
from access_cases import run_access
from hosting_cases import run_hosting
from raw_cases import run_raw
from rendering_cases import run_rendering
from url_cases import run_urls
from snapshot_cases import run_snapshots
from sync_cases import run_sync
from settings_cases import run_settings
from settings_store_cases import run_settings_store
from config_api_cases import run_config_api

RUNNERS = {"security": run_security, "keys": run_keys, "encryption": run_encryption, "authorization": run_authorization,
           "media": run_media, "streams": run_streams, "sse": run_sse, "context": run_context, "cors": run_cors, "handlers": run_handlers, "registry": run_registry, "access": run_access, "hosting": run_hosting, "raw": run_raw, "rendering": run_rendering, "urls": run_urls, "snapshots": run_snapshots, "sync": run_sync, "settings": run_settings}
RUNNERS["settings-store"] = run_settings_store
RUNNERS["config-api"] = run_config_api
SUITES = ["schema", *RUNNERS, "all"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--labels", nargs="+", choices=["node", "python", "dotnet"], help="Runtime identities; discovered from adapters when omitted")
    parser.add_argument("--all-contracts", action="store_true")
    parser.add_argument("--roundtrip-all", action="store_true")
    parser.add_argument("--suite", choices=SUITES, default="all")
    args = parser.parse_args()
    cases = json.loads(Path(__file__).with_name("schema-cases.json").read_text())
    if args.labels and len(args.labels) != len(args.urls):
        parser.error("--labels must match the URL count")
    if not args.labels:
        args.labels = [post(url, {"action": "runtime"})["runtime"] for url in args.urls]
        if any(label not in ("node", "python", "dotnet") for label in args.labels):
            parser.error("Unknown adapter runtime")
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
    for name, runner in RUNNERS.items():
        if args.suite in (name, "all"):
            outcomes = runner(args.urls, args.labels or args.urls)
            results += outcomes
            failures += [f'{result["runtime"]} {result["id"]}: {result["error"]}' for result in outcomes if not result["passed"]]
    print(f"{len(results) - len(failures)}/{len(results)} {args.suite} scenarios passed")
    for failure in failures:
        print(failure)
    if args.report:
        args.report.write_text(json.dumps({"scenarios": len(results), "passed": len(results) - len(failures), "results": results}, indent=2) + "\n", encoding="utf-8")
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
