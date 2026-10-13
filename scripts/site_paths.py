"""Walk site paths without descending into excluded tooling directories."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path


def _raise_walk_error(error: OSError) -> None:
    raise error


def site_paths(root: Path, excluded: set[str]) -> Iterator[Path]:
    for directory, children, files in os.walk(root, topdown=True, followlinks=False, onerror=_raise_walk_error):
        children[:] = [name for name in children if name not in excluded]
        for name in children + files:
            if name not in excluded:
                yield Path(directory) / name
