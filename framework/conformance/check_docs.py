"""Compile/run native README examples. Build the .NET projects before this check."""
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
python_readme = root / "framework/python/README.md"
for snippet in re.findall(r"```python\n(.*?)```", python_readme.read_text(), re.S):
    prelude = f"import sys\nsys.path.insert(0, {str(root / 'framework/python')!r})\n"
    subprocess.run([sys.executable, "-"], input=prelude + snippet, text=True, check=True)

directory = root / ".tmp-run/ports-docs"
directory.mkdir(parents=True, exist_ok=True)
project = ET.Element("Project", Sdk="Microsoft.NET.Sdk.Web")
properties = ET.SubElement(project, "PropertyGroup")
for name, value in {"TargetFramework": "net10.0", "OutputType": "Exe", "Nullable": "enable", "ImplicitUsings": "enable"}.items():
    ET.SubElement(properties, name).text = value
ET.SubElement(ET.SubElement(project, "ItemGroup"), "ProjectReference", Include=str(root / "framework/dotnet/BetterPortal/BetterPortal.csproj"))
ET.SubElement(ET.SubElement(project, "ItemGroup"), "ProjectReference", Include=str(root / "framework/dotnet/BetterPortal.AspNetCore/BetterPortal.AspNetCore.csproj"))
ET.ElementTree(project).write(directory / "Examples.csproj", encoding="unicode")
subprocess.run(["dotnet", "restore", str(directory)], check=True)
for snippet in re.findall(r"```csharp\n(.*?)```", (root / "framework/dotnet/README.md").read_text(), re.S):
    (directory / "Program.cs").write_text(snippet, encoding="utf-8")
    subprocess.run(["dotnet", "run", "--project", str(directory), "--no-restore", "--no-launch-profile", "-p:UseSharedCompilation=false"], check=True)
print("Python and C# README examples compiled and executed")
