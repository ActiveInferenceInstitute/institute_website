#!/usr/bin/env python3
"""Exercise the CI-only branch of the InstituteOS sync check.

``sync_instituteos_public_data.py --check`` has two branches. When the private
InstituteOS registries are present (every local checkout) it regenerates each
payload and compares bytes. When they are absent — which is exactly the CI
situation, where the website repo is checked out standalone — it falls back to
``check_committed_public_payloads()`` and validates the committed files in place.

That fallback is unreachable from a normal local run, so a defect inside it
survives a completely clean ``npm run check`` and only fails in CI. That is not
hypothetical: removing the calendar slice from the sync left a dangling
``OPTIONAL_PUBLIC_JSON_FILES`` reference in the fallback, local checks passed, and
CI died with a NameError.

This script copies the committed public tree into a temporary directory with no
InstituteOS root above it, runs the checker there, and fails if the fallback does
not complete. No network, no registries, no fixtures.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
# Everything the fallback reads: the checker itself, the public payloads, and the
# brand assets it verifies are present and non-empty.
COPY = ("scripts", "src", "data", "assets")


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="standalone-website-") as tmp:
        sandbox = Path(tmp) / "website"
        sandbox.mkdir()
        for name in COPY:
            source = PROJECT_ROOT / name
            if source.exists():
                shutil.copytree(source, sandbox / name, symlinks=True)

        env = {k: v for k, v in os.environ.items() if k != "INSTITUTEOS_ROOT"}
        result = subprocess.run(
            [sys.executable, "scripts/sync_instituteos_public_data.py", "--check"],
            cwd=sandbox,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

    if result.returncode != 0:
        print("Standalone public-payload check FAILED (this is the branch CI takes):", file=sys.stderr)
        print(result.stdout.strip(), file=sys.stderr)
        print(result.stderr.strip(), file=sys.stderr)
        return 1

    summary = (result.stdout.strip().splitlines() or ["(no output)"])[-1]
    print(f"Standalone public-payload check passed: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
