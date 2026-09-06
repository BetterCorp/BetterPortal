"""HTTP negotiation probes; native-only cases retain BP's stricter requirements."""
from security_cases import post


def run_media(urls, labels):
    shared = [
        ("missing", None, "json", None), ("empty", " \t", "json", None),
        ("json", "application/json", "json", None), ("wildcard", "*/*", "json", None),
        ("html", "text/html", "html", "page"), ("page", "text/html;mode=page", "html", "page"),
        ("fragment", 'text/html;mode="fragment"', "html", "fragment"), ("embed", "text/html;mode=embed", "html", "embed"),
        ("metadata", "application/vnd.betterportal.metadata+json", "metadata", None),
        ("ndjson", "application/x-ndjson", "ndjson", None),
        ("quality", "application/json;q=0.5,text/html;q=0.9", "html", "page"),
        ("tie-html", "text/html,application/json", "html", "page"),
        ("tie-json", "application/json,text/html", "json", None),
        ("case", "TEXT/HTML;MODE=fragment;Q=1.000", "html", "fragment"),
        ("theme-ignored", "text/html;theme=untrusted", "html", "page"),
        ("unsupported-alternative", "image/png,application/json;q=0.1", "json", None),
    ]
    native = [
        ("q-zero", "application/json;q=0", None, None, None),
        ("zero-wildcard", "*/*;q=0", None, None, None),
        ("specific-exclusion", "application/json;q=0,*/*;q=1", "html", "page", None),
        ("specific-quality", "application/json;q=0.1,application/*;q=0.8,text/html;q=0.5", "html", "page", ["html", "json"]),
        ("excluded-only-offer", "application/json;q=0,*/*;q=1", None, None, ["json"]),
        ("unavailable-stream", "application/x-ndjson", None, None, ["json", "html"]),
        ("available-fallback", "application/x-ndjson,application/json;q=0.5", "json", None, ["json"]),
        ("html-only-default", None, "html", "page", ["html"]),
        ("no-offers", None, None, None, []),
        ("subtype-wildcard", "text/*", "html", "page", None),
        ("unsupported", "image/png", None, None, None),
        ("invalid-mode", "text/html;mode=other", None, None, None),
        ("mode-case-sensitive", "text/html;mode=Page", None, None, None),
        ("mode-fallback", "text/html;mode=other,application/json;q=0.5", "json", None, None),
        ("fragment-exclusion", "text/html;mode=fragment;q=0,text/html;q=1", "html", "page", None),
        ("fragment-priority", "text/html;q=0,text/html;mode=fragment", "html", "fragment", None),
        ("quoted-comma", 'text/html;theme="one,two";mode=fragment', "html", "fragment", None),
        ("quoted-semicolon", 'text/html;theme="one;two";mode=embed', "html", "embed", None),
        ("quoted-escape", 'text/html;theme="a\\\"b";mode=fragment', "html", "fragment", None),
        ("escaped-mode", 'text/html;mode="frag\\ment"', "html", "fragment", None),
        ("empty-list-members", ", , application/json,,", "json", None, None),
    ]
    malformed = ["application/json;q=2", "application/json;q=-1", "application/json;q=0.1234",
                 "application/json;q=nan", 'application/json;q="0.5"', "application/json;q=1;Q=0",
                 'text/html;mode="fragment', "text/html;mode=page;Mode=embed", "text/html;foo",
                 "text/html;foo=", "*/json", "text/html\r\nX-Test: yes", "text/html\x00",
                 "text/html;theme=" + "a" * 8192, ",,", "text /html", "text/html garbage"]
    native += [(f"malformed-{index}", value, None, None, None) for index, value in enumerate(malformed)]
    results = []
    for url, label in zip(urls, labels):
        cases = [(name, accept, kind, mode, None) for name, accept, kind, mode in shared]
        if label != "node":
            cases += native
        for name, accept, kind, mode, available in cases:
            try:
                request = {"action": "media", "accept": accept}
                if available is not None:
                    request["available"] = available
                actual = post(url, request)
                expected = {"status": 406} if kind is None else {"status": 200, "output": {"kind": kind, "mode": mode}}
                assert actual == expected, (actual, expected)
                results.append({"runtime": label, "id": name, "passed": True})
            except Exception as error:
                results.append({"runtime": label, "id": name, "passed": False, "error": str(error)})
    return results
