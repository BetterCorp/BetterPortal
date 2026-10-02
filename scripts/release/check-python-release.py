"""Validate release identity and wheel/sdist contents before PyPI publication."""
import argparse
from email.parser import BytesParser
import json
import os
from pathlib import Path
import re
import tarfile
import tomllib
import zipfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dist', type=Path)
args = parser.parse_args()
project = tomllib.loads((root / 'framework/python/pyproject.toml').read_text())['project']
version = json.loads((root / 'package.json').read_text())['version']
if project['name'] != 'betterportal' or project['version'] != version:
    raise SystemExit('Python package name/version must match betterportal and the workspace version')
if not re.fullmatch(r'\d+\.\d+\.\d+', version):
    raise SystemExit('PyPI releases currently require a stable X.Y.Z workspace version')
ref = os.environ.get('GITHUB_REF', '')
if ref.startswith('refs/tags/') and ref != 'refs/tags/v' + version:
    raise SystemExit('Release tag must exactly match v' + version)

if args.dist:
    wheel = args.dist / f'betterportal-{version}-py3-none-any.whl'
    sdist = args.dist / f'betterportal-{version}.tar.gz'
    if set(args.dist.iterdir()) != {wheel, sdist}:
        raise SystemExit('Expected exactly one matching universal wheel and one source distribution')
    expected_contracts = {p.name for p in (root / 'framework/conformance/contracts').glob('*.json')}
    for archive in (wheel, sdist):
        if archive == wheel:
            with zipfile.ZipFile(archive) as package:
                names = set(package.namelist())
                metadata = package.read(f'betterportal-{version}.dist-info/METADATA')
                prefix = ''
        else:
            with tarfile.open(archive) as package:
                names = set(package.getnames())
                try:
                    member = package.extractfile(f'betterportal-{version}/PKG-INFO')
                except KeyError:
                    member = None
                if member is None:
                    raise SystemExit(f'Missing PKG-INFO in {archive.name}')
                metadata = member.read()
                prefix = f'betterportal-{version}/'
        headers = BytesParser().parsebytes(metadata)
        if headers['Name'] != 'betterportal' or headers['Version'] != version:
            raise SystemExit(f'Incorrect archive identity: {archive.name}')
        required = {prefix + 'betterportal/py.typed', prefix + 'betterportal/cli.py'}
        required |= {prefix + 'betterportal/_contracts/' + name for name in expected_contracts}
        if not expected_contracts or not required <= names:
            raise SystemExit(f'Missing CLI, typing marker or contracts in {archive.name}')
    print(f'Validated wheel and sdist for betterportal {version}')
else:
    print(f'Validated release metadata for betterportal {version}')
