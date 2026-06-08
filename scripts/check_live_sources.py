#!/usr/bin/env python3
"""Verify live public sources recorded in src/content/live-sources.json."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = PROJECT_ROOT / "src" / "content" / "live-sources.json"
USER_AGENT = "ActiveInferenceInstituteWebsiteCheck/1.0 (+https://github.com/ActiveInferenceInstitute/institute_website)"


def check_url(url: str, timeout: int) -> tuple[int, str]:
    command = [
        "curl",
        "-L",
        "-sS",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}\t%{url_effective}",
        "--max-time",
        str(timeout),
        "-A",
        USER_AGENT,
        url,
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    output = completed.stdout.strip()
    if "\t" in output:
        status_text, final_url = output.split("\t", 1)
    else:
        status_text, final_url = output or "000", url
    try:
        status_code = int(status_text)
    except ValueError:
        status_code = 0
    return status_code, final_url or url


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_manifest(path: Path, manifest: dict) -> None:
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def verify(manifest_path: Path, *, timeout: int, write: bool) -> int:
    manifest = load_manifest(manifest_path)
    checked_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    errors: list[str] = []
    notes: list[str] = []

    for source in manifest.get("sources", []):
        status_code, final_url = check_url(source["url"], timeout)
        live_ok = 200 <= status_code < 400
        expected_ok = bool(source.get("ok"))
        expected_status = int(source.get("statusCode") or 0)

        if expected_ok and not live_ok:
            errors.append(f"{source['id']}: expected reachable, got HTTP {status_code} at {final_url}")
        elif not expected_ok and live_ok:
            errors.append(f"{source['id']}: expected not promoted, but now reachable at {final_url}")
        elif not expected_ok and expected_status and status_code != expected_status:
            errors.append(f"{source['id']}: expected HTTP {expected_status}, got HTTP {status_code} at {final_url}")
        elif status_code != expected_status or final_url != source.get("finalUrl"):
            notes.append(
                f"{source['id']}: live result is HTTP {status_code} at {final_url}; manifest records HTTP {expected_status} at {source.get('finalUrl')}"
            )

        if write:
            source["statusCode"] = status_code
            source["finalUrl"] = final_url
            source["ok"] = live_ok
            source["checkedAt"] = checked_at

    if write:
        manifest["lastCheckedAt"] = checked_at
        write_manifest(manifest_path, manifest)

    for note in notes:
        print(f"note: {note}")

    if errors:
        print("Live-source verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Checked {len(manifest.get('sources', []))} live sources.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--write", action="store_true", help="Update checkedAt/status/finalUrl fields")
    args = parser.parse_args()
    return verify(Path(args.manifest).resolve(), timeout=args.timeout, write=args.write)


if __name__ == "__main__":
    raise SystemExit(main())
