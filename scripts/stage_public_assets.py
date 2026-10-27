#!/usr/bin/env python3
"""Stage built public files into a new, explicit deployment-artifact directory.

Never upload the source checkout. Run the full build/check gate before staging.
This command writes an artifact only; it cannot bind a host or deploy anything.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from source_identity import website_source_fingerprint


def stage(root: Path, destination: Path, *, commit: str | None = None, run_url: str | None = None) -> int:
    root, destination = root.resolve(), destination.resolve()
    if destination == root or destination in root.parents or root in destination.parents:
        raise ValueError("Deployment artifact must be outside the source checkout")
    if destination.exists():
        raise FileExistsError("Use a new artifact directory; existing evidence is preserved")
    if (commit is None) != (run_url is None):
        raise ValueError("Deployment commit and run URL must be supplied together")
    if commit is not None and (not re.fullmatch(r"[0-9a-f]{40}", commit) or not re.fullmatch(r"https://github\.com/ActiveInferenceInstitute/institute_website/actions/runs/[1-9][0-9]*", run_url or "")):
        raise ValueError("Deployment identity must name the exact public repository commit and Actions run")
    version = json.loads((root / "version.json").read_text())
    if version.get("website_source_fingerprint") != website_source_fingerprint(root):
        raise ValueError("Stale website build; rebuild and check before staging")
    names = json.loads((root / "data/public-html-files.json").read_text())
    if not isinstance(names, list) or not names or len(set(names)) != len(names):
        raise ValueError("Public HTML inventory must be a nonempty unique list")
    files = set()
    for name in names:
        path = Path(name)
        if path.is_absolute() or ".." in path.parts or path.suffix != ".html" or path.parts[0] in {"src", "scripts", "docs", "edge"}:
            raise ValueError("Public HTML inventory contains an unsafe path")
        if not (root / path).is_file():
            raise FileNotFoundError(name)
        files.add(path)
    allowed_assets = {".css", ".js", ".woff2", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".ico", ".mp3", ".ogg", ".wav"}
    for path in (root / "assets").rglob("*"):
        if path.is_symlink():
            raise ValueError("Public deployment assets cannot contain symlinks")
        if path.is_file() and path.suffix in allowed_assets:
            files.add(path.relative_to(root))
    for name in ["robots.txt", "sitemap.xml", "feed.xml", "feed.json", "manifest.webmanifest", "version.json", ".nojekyll", "CNAME", ".well-known/security.txt", "data/projects.json", "data/export-manifest.json", "data/redirects.json", "data/public-html-files.json"]:
        path = root / name
        if not path.is_file():
            raise FileNotFoundError(f"Missing built public artifact: {name}")
        files.add(Path(name))
    # Validate the entire selection before any writes.
    if any((root / relative).is_symlink() for relative in files):
        raise ValueError("Public deployment files cannot be symlinks")
    destination.mkdir(parents=True)
    for relative in sorted(files):
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / relative, target)
    if commit is not None:
        (destination / "deployment.json").write_text(json.dumps({"commit": commit, "workflow_run": run_url, "website_source_fingerprint": version["website_source_fingerprint"], "source_export_fingerprint": version.get("source_fingerprint")}, indent=2) + "\n")
    return len(files)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit")
    parser.add_argument("--run-url")
    args = parser.parse_args()
    print(f"Staged {stage(Path(__file__).resolve().parents[1], args.output, commit=args.commit, run_url=args.run_url)} public files; no deployment performed")


if __name__ == "__main__":
    main()
