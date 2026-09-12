"""Run the same elevation cases against every language's shipped protocol helper."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from betterportal.elevation import require_elevation

cases = json.loads(Path(__file__).with_name("elevation-cases.json").read_text())
assert json.loads((Path(__file__).resolve().parents[1] / "go/testdata/elevation-cases.json").read_text()) == cases
for case in cases:
    try:
        require_elevation(case["user"], case["requirement"], now=case["now"])
        allowed = True
    except Exception:
        allowed = False
    assert allowed == case["allowed"], case["name"]
print(f"Python: {len(cases)} shared elevation cases passed")
