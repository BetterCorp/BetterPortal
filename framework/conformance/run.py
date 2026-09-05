"""Run identical language-neutral HTTP cases against one or more loopback adapters."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--labels", nargs="+")
    parser.add_argument("--all-contracts", action="store_true")
    args = parser.parse_args()
    cases = json.loads(Path(__file__).with_name("schema-cases.json").read_text())
    if args.labels and len(args.labels) != len(args.urls):
        parser.error("--labels must match the URL count")
    if args.all_contracts:
        cases += [{"id": "import-" + path.stem, "contract": path.stem, "action": "import", "output": True}
                  for path in sorted(Path(__file__).with_name("contracts").glob("*.json"))]
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
    print(f"{len(cases) * len(args.urls) - len(failures)}/{len(cases) * len(args.urls)} schema scenarios passed")
    for failure in failures:
        print(failure)
    if args.report:
        args.report.write_text(json.dumps({"scenarios": len(results), "passed": len(results) - len(failures), "results": results}, indent=2) + "\n", encoding="utf-8")
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
