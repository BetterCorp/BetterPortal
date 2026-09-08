"""Embed the shared canonical corpus in native wheels/sdists without Node."""
from pathlib import Path
from shutil import copytree
from setuptools import setup
from setuptools.command.build_py import build_py
from setuptools.command.sdist import sdist

ROOT = Path(__file__).resolve().parent


def corpus():
    shared = ROOT.parent / "conformance" / "contracts"
    return shared if shared.is_dir() else ROOT / "betterportal" / "_contracts"


class BuildPy(build_py):
    def run(self):
        super().run()
        copytree(corpus(), Path(self.build_lib) / "betterportal" / "_contracts", dirs_exist_ok=True)


class Sdist(sdist):
    def make_release_tree(self, base_dir, file_list):
        super().make_release_tree(base_dir, file_list)
        copytree(corpus(), Path(base_dir) / "betterportal" / "_contracts", dirs_exist_ok=True)


setup(cmdclass={"build_py": BuildPy, "sdist": Sdist})
