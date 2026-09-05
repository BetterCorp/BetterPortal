"""Verify shared artifacts in a native wheel/sdist and import directly from the wheel."""
import argparse
from pathlib import Path
import sys
import tarfile
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path)
args = parser.parse_args()
wheel, = args.directory.glob("betterportal-*.whl")
sdist, = args.directory.glob("betterportal-*.tar.gz")
canonical = Path(__file__).with_name("contracts")
with zipfile.ZipFile(wheel) as archive, tarfile.open(sdist) as source:
    for path in canonical.glob("*.json"):
        member = "betterportal/_contracts/" + path.name
        assert archive.read(member) == path.read_bytes(), member
        entry, = [item for item in source.getmembers() if item.name.endswith("/" + member)]
        with source.extractfile(entry) as stream:
            assert stream.read() == path.read_bytes(), member
    assert "betterportal/py.typed" in archive.namelist()

sys.path.insert(0, str(wheel.resolve()))
import betterportal
from betterportal.contracts import parse
from betterportal.security import KeyPair
from betterportal.keys import public_keys, secure_endpoint
assert str(wheel.resolve()) in betterportal.__file__
assert parse("JsonObjectSchema", {"x": [None, {"y": True}]}) == {"x": [None, {"y": True}]}
key = KeyPair.generate()
assert public_keys({"keys": [key.public_jwk()]})[key.kid] == key.public_key_pem
assert secure_endpoint("https://keys.example") == "https://keys.example"
print("Wheel and sdist contain identical canonical contracts; standalone wheel import, recursive parsing and RSA passed")
