"""Independently verify the build's stable website source identity."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


def website_source_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    excluded = {"assets/js/redirects.js", "assets/js/search-data.js"}

    def visit(relative: str) -> None:
        path = root / relative
        if path.is_symlink():
            raise ValueError("Website source identity cannot follow symlinks")
        if path.is_dir():
            # JavaScript's .sort() compares UTF-16 code units, including astral
            # filenames. Match the producer rather than Python code-point order.
            for child in sorted(path.iterdir(), key=lambda p: p.name.encode("utf-16-be")):
                visit(child.relative_to(root).as_posix())
        elif (relative not in excluded and relative != "simulations/index.html"
              and (not relative.startswith("simulations/") or relative.endswith(".html"))):
            data = path.read_bytes()
            digest.update((json.dumps([relative, len(data)], separators=(",", ":"), ensure_ascii=False) + "\n").encode())
            digest.update(data)

    for entry in ["package.json", "src", "assets", "simulations"]:
        visit(entry)
    return digest.hexdigest()
