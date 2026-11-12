#!/usr/bin/env python3
"""Install or verify the parser bound by .github/gnn-pin.json."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true", help="Networked setup in the selected Python environment")
    parser.add_argument("--exemplar", type=Path, help="Previously downloaded pinned exemplar for offline verification")
    args = parser.parse_args()
    pin = json.loads((ROOT / ".github/gnn-pin.json").read_text(encoding="utf-8"))
    if (pin.get("schema") != "gnn-importer-pin/v1"
            or pin.get("repository") != "ActiveInferenceInstitute/Generalized_Notation_Notation"
            or not re.fullmatch(r"[0-9a-f]{40}", pin.get("revision", ""))
            or not re.fullmatch(r"v\d+\.\d+\.\d+", pin.get("tag", ""))):
        raise SystemExit("Invalid canonical GNN importer pin")
    if args.install:
        subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check",
                        "defusedxml==0.7.1", "psutil==7.2.2", "pyyaml==6.0.3"], check=True, stdin=subprocess.DEVNULL)
        spec = f"generalized-notation-notation @ git+https://github.com/{pin['repository']}.git@{pin['revision']}"
        subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-deps", spec],
                       check=True, stdin=subprocess.DEVNULL)
        return

    from gnn import __version__
    from gnn.parsers.basic import parse_gnn_formal, validate_gnn_syntax
    from gnn.type_checker import GNNTypeChecker

    if __version__ != pin["tag"].removeprefix("v"):
        raise SystemExit(f"installed GNN {__version__!r} does not match {pin['tag']!r}")
    sketches = sorted(ROOT.rglob("*.gnn.md"))
    source = "repository" if sketches else "pinned-exemplar"
    with tempfile.TemporaryDirectory(prefix="repo-gnn-") as output_dir:
        output = Path(output_dir)
        if not sketches:
            exemplar = output / "static_perception.md"
            if args.exemplar:
                shutil.copy2(args.exemplar, exemplar)
            else:
                url = (f"https://raw.githubusercontent.com/{pin['repository']}/{pin['revision']}/"
                       "input/gnn_files/basics/static_perception.md")
                urllib.request.urlretrieve(url, exemplar)
            sketches = [exemplar]
        for sketch in sketches:
            parsed = parse_gnn_formal(sketch)
            if parsed is None or getattr(parsed, "parse_errors", None):
                raise SystemExit(f"{sketch} did not parse cleanly")
            valid, errors = validate_gnn_syntax(sketch.read_text(encoding="utf-8"))
            if not valid:
                raise SystemExit(f"{sketch} syntax errors: {errors!r}")
        model_dir = output / "models"
        model_dir.mkdir()
        for index, sketch in enumerate(sketches):
            shutil.copy2(sketch, model_dir / f"{index:03d}_{sketch.name}")
        if not GNNTypeChecker().validate_gnn_files(model_dir, output):
            raise SystemExit("GNN type checker rejected the models")
    print(json.dumps({"gnn-version": __version__, "pin-revision": pin["revision"],
                      "models": len(sketches), "source": source, "result": "verified"}, sort_keys=True))


if __name__ == "__main__":
    main()
