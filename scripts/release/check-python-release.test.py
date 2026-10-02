"""Release guards reject mismatched tags and incomplete distribution contents."""
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zipfile


class ReleaseChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        script = self.root / 'scripts/release/check-python-release.py'
        script.parent.mkdir(parents=True)
        shutil.copyfile(Path(__file__).with_name('check-python-release.py'), script)
        self.script = script
        package = self.root / 'framework/python'
        package.mkdir(parents=True)
        corpus = self.root / 'framework/conformance/contracts'
        corpus.mkdir(parents=True)
        (corpus / 'JsonValueSchema.json').write_text('{}')
        (package / 'pyproject.toml').write_text('[project]\nname="betterportal"\nversion="1.2.3"\n')
        (self.root / 'package.json').write_text(json.dumps({'version': '1.2.3'}))
        self.dist = self.root / 'dist'
        self.dist.mkdir()

    def run_check(self, *args, ref='refs/tags/v1.2.3'):
        return subprocess.run([sys.executable, str(self.script), *args], env={**os.environ, 'GITHUB_REF': ref}, capture_output=True, text=True)

    def archives(self, *, typed=True, metadata_version='1.2.3', sdist_metadata=True):
        files = {'betterportal/cli.py': b'', 'betterportal/_contracts/JsonValueSchema.json': b'{}'}
        if typed: files['betterportal/py.typed'] = b''
        metadata = f'Name: betterportal\nVersion: {metadata_version}\n'.encode()
        with zipfile.ZipFile(self.dist / 'betterportal-1.2.3-py3-none-any.whl', 'w') as package:
            for path, content in files.items(): package.writestr(path, content)
            package.writestr('betterportal-1.2.3.dist-info/METADATA', metadata)
        with tarfile.open(self.dist / 'betterportal-1.2.3.tar.gz', 'w:gz') as package:
            source_files = {**files, **({'PKG-INFO': metadata} if sdist_metadata else {})}
            for path, content in source_files.items():
                info = tarfile.TarInfo('betterportal-1.2.3/' + path)
                info.size = len(content)
                package.addfile(info, BytesIO(content))

    def test_tag_and_workspace_drift(self):
        self.assertEqual(self.run_check().returncode, 0)
        self.assertNotEqual(self.run_check(ref='refs/tags/v9.9.9').returncode, 0)
        (self.root / 'package.json').write_text('{"version":"1.2.4"}')
        self.assertNotEqual(self.run_check().returncode, 0)

    def test_distribution_integrity(self):
        self.archives()
        self.assertEqual(self.run_check('--dist', str(self.dist)).returncode, 0)
        self.archives(typed=False)
        self.assertNotEqual(self.run_check('--dist', str(self.dist)).returncode, 0)
        self.archives(metadata_version='9.9.9')
        self.assertNotEqual(self.run_check('--dist', str(self.dist)).returncode, 0)
        self.archives(sdist_metadata=False)
        result = self.run_check('--dist', str(self.dist))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing PKG-INFO', result.stderr)
        self.assertNotIn('Traceback', result.stderr)
        self.archives()
        (self.dist / 'unrelated.whl').write_bytes(b'')
        self.assertNotEqual(self.run_check('--dist', str(self.dist)).returncode, 0)


if __name__ == '__main__': unittest.main()
