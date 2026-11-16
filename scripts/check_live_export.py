#!/usr/bin/env python3
"""Compare the live public export with an exact reviewed website commit."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from time import monotonic
from typing import NamedTuple
from urllib.parse import quote

from check_export_manifest import ENTRY_KEYS, MANIFEST_PATH, ROOT_KEYS, TARGETS, manifest_output_path
from sync_instituteos_public_data import PRODUCER2_PUBLIC_JSON_FILES

SITE = "https://activeinference.institute"
VERSION = "version.json"
BOARD = "structure/board-of-directors/"
MAX_FILE_BYTES = 32 * 1024 * 1024
COMMIT_RE = re.compile(r"[0-9a-f]{40}")
SHA256_RE = re.compile(r"[0-9a-f]{64}")


class FileIdentity(NamedTuple):
    size: int
    sha256: str


def identify(data: bytes) -> FileIdentity:
    return FileIdentity(len(data), hashlib.sha256(data).hexdigest())


def expected_files(root: Path, commit: str) -> dict[str, FileIdentity]:
    """Read only regular blobs from the exact local Git commit."""
    if not COMMIT_RE.fullmatch(commit):
        raise ValueError("Supply the full reviewed Git commit SHA")
    environment = {
        **os.environ, "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0",
        "GIT_NO_LAZY_FETCH": "1", "GIT_NO_REPLACE_OBJECTS": "1",
    }

    def git(*args: str) -> bytes:
        return subprocess.check_output(
            ("git", "-C", str(root), *args), stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=environment, timeout=10,
        )

    if git("rev-parse", "--verify", f"{commit}^{{commit}}").decode().strip() != commit:
        raise ValueError("The supplied SHA must identify a commit")
    board_file = BOARD + "index.html"
    inventory = git("ls-tree", "--full-tree", "-rlz", commit, "--", VERSION, MANIFEST_PATH,
                    board_file, "data/projects.json", TARGETS["content"],
                    TARGETS["pages_domains"], TARGETS["newsletter_assets"])
    blobs = {}
    for row in inventory.split(b"\0"):
        if row:
            metadata, path = row.split(b"\t", 1)
            mode, kind, blob, size = metadata.decode().split()
            blobs[path.decode()] = (mode, kind, blob, size)

    def read(path: str) -> bytes:
        mode, kind, blob, size = blobs.get(path, ("", "", "", "0"))
        if mode not in {"100644", "100755"} or kind != "blob" or not 0 < int(size) <= MAX_FILE_BYTES:
            raise ValueError(f"Missing, unsupported, or oversized committed file: {path}")
        data = git("cat-file", "blob", blob)
        if len(data) != int(size):
            raise ValueError(f"Committed file length differs: {path}")
        return data

    version_bytes = read(VERSION)
    version = json.loads(version_bytes)
    manifest_bytes = read(MANIFEST_PATH)
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    if not isinstance(manifest, dict) or set(manifest) != ROOT_KEYS or manifest["gate_version"] != "1.0.0":
        raise ValueError("Unsupported committed export manifest")
    entries = manifest["files"]
    if not isinstance(entries, list) or not 1 <= len(entries) <= 256:
        raise ValueError("Unexpected committed export inventory size")
    required = {f'{TARGETS["content"]}/{name}' for name in PRODUCER2_PUBLIC_JSON_FILES}
    required.add("data/projects.json")
    required.update(path for path in blobs if path.startswith(
        (TARGETS["pages_domains"] + "/", TARGETS["newsletter_assets"] + "/")
    ))
    files: dict[str, FileIdentity] = {}
    for entry in entries:
        if (not isinstance(entry, dict) or set(entry) != ENTRY_KEYS
                or any(not isinstance(entry[key], str) for key in ("name", "output_path", "sha256", "target"))
                or not SHA256_RE.fullmatch(entry["sha256"])):
            raise ValueError("Malformed committed export entry")
        path = manifest_output_path(entry, PRODUCER2_PUBLIC_JSON_FILES)
        if path is None or path.as_posix() in files:
            raise ValueError("Unapproved or duplicate committed export path")
        name = path.as_posix()
        identity = identify(read(name))
        if identity.sha256 != entry["sha256"]:
            raise ValueError(f"Committed bytes differ from the manifest: {name}")
        files[name] = identity
    if required - files.keys():
        raise ValueError("The committed manifest omits required exports")
    fingerprint = hashlib.sha256("\n".join(sorted(file.sha256 for file in files.values())).encode()).hexdigest()[:12]
    if (manifest["source_fingerprint"] != fingerprint or not isinstance(version, dict)
            or version.get("source_fingerprint") != fingerprint):
        raise ValueError("Committed version and manifest export fingerprints disagree")
    return {VERSION: identify(version_bytes), MANIFEST_PATH: identify(manifest_bytes),
            **files, BOARD: identify(read(board_file))}


def fetch(site: str, path: str, commit: str, size: int, timeout: float) -> FileIdentity:
    """Read one unauthenticated file with bounded transfer time and size."""
    url = f"{site}/{quote(path, safe='/')}?release={commit}"
    completed = subprocess.run(
        ("curl", "--disable", "--silent", "--globoff", "--noproxy", "*", "--proto", "=http,https",
         "--fail", "--max-time", str(timeout), "--connect-timeout", str(min(timeout, 10)),
         "--max-filesize", str(size), "--header", "Cache-Control: no-cache",
         "--write-out", "\n%{http_code}", "--url", url),
        capture_output=True, stdin=subprocess.DEVNULL, check=False, timeout=timeout,
    )
    body, marker, status = completed.stdout.rpartition(b"\n")
    if status == b"404":
        raise ValueError("HTTP 404")
    if completed.returncode == 63:
        raise ValueError("response exceeds committed size")
    if completed.returncode or not marker or status != b"200":
        raise ValueError("incomplete HTTP 200 read")
    return identify(body)


def verify(root: Path, commit: str, timeout: int, *, site: str = SITE) -> dict:
    """Return a JSON-ready receipt. A pass requires an exact match for every file."""
    files = expected_files(root, commit)
    deadline = monotonic() + timeout

    def check(path: str) -> tuple[str, str] | None:
        remaining = deadline - monotonic()
        if remaining <= 0:
            return path, "network deadline exceeded"
        expected = files[path]
        try:
            observed = fetch(site, path, commit, expected.size, min(remaining, 15))
        except subprocess.TimeoutExpired:
            return path, "network deadline exceeded"
        except (OSError, ValueError) as error:
            return path, str(error)
        return None if observed == expected else (path, "bytes differ from the reviewed commit")

    anchors = (VERSION, MANIFEST_PATH)
    failures = [result for path in anchors if (result := check(path))]
    if not failures:
        with ThreadPoolExecutor(max_workers=5) as pool:
            failures = [result for result in pool.map(check, files.keys() - set(anchors)) if result]
        if not failures:
            failures = [result for path in anchors if (result := check(path))]
    return {
        "schema": 1,
        "site": site,
        "commit": commit,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "status": "unverified" if failures else "verified",
        "expected": {path: identity._asdict() for path, identity in files.items()},
        "failures": [{"path": path, "reason": reason} for path, reason in sorted(failures)],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", required=True, help="Full Git SHA of the reviewed website build")
    parser.add_argument("--timeout", type=int, default=90, help="Shared network deadline in seconds")
    args = parser.parse_args()
    if not 1 <= args.timeout <= 180:
        parser.error("--timeout must be between 1 and 180 seconds")
    try:
        receipt = verify(Path(__file__).resolve().parents[1], args.commit, args.timeout)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f"Cannot bind the reviewed release: {error}\n")
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return int(receipt["status"] != "verified")


if __name__ == "__main__":
    raise SystemExit(main())
