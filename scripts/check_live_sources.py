#!/usr/bin/env python3
"""Verify live public sources recorded in src/content/live-sources.json."""

from __future__ import annotations

import argparse
from concurrent.futures import TimeoutError as FuturesTimeoutError
from concurrent.futures import ThreadPoolExecutor, as_completed
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
        "--connect-timeout",
        str(max(1, min(timeout, 10))),
        "-A",
        USER_AGENT,
        url,
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=max(1, timeout + 5),
        )
    except subprocess.TimeoutExpired:
        return 0, url
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


def verify(
    manifest_path: Path,
    *,
    timeout: int,
    write: bool,
    workers: int = 16,
    total_timeout: int = 90,
    offline: bool = False,
) -> int:
    manifest = load_manifest(manifest_path)
    sources = manifest.get("sources", [])
    if not isinstance(sources, list):
        print("Live-source manifest is invalid: 'sources' must be a list.", file=sys.stderr)
        return 1

    # The committed manifest must never carry resolved `finalUrl` values —
    # they are check-time verification metadata (and historically leaked
    # resolved coda.io destinations into source). Redirect targets are
    # resolved live by check_url() on every run instead.
    final_url_offenders = [
        str(source.get("id", index))
        for index, source in enumerate(sources)
        if isinstance(source, dict) and "finalUrl" in source
    ]
    if final_url_offenders:
        if write:
            for source in sources:
                if isinstance(source, dict):
                    source.pop("finalUrl", None)
            print(
                f"note: stripped committed finalUrl from {len(final_url_offenders)} sources (resolved at check time only)"
            )
        else:
            print(
                "Live-source manifest must not commit resolved 'finalUrl' values "
                "(check-time verification metadata; rerun with --write to strip):",
                file=sys.stderr,
            )
            for offender in final_url_offenders:
                print(f"- {offender}", file=sys.stderr)
            return 1

    if offline:
        invalid = [
            str(source.get("id", index))
            for index, source in enumerate(sources)
            if not isinstance(source, dict) or not source.get("id") or not source.get("url")
        ]
        if invalid:
            print(
                "Offline live-source manifest validation failed for: " + ", ".join(invalid),
                file=sys.stderr,
            )
            return 1
        print(f"Offline live-source validation passed: {len(sources)} source records; network probes skipped.")
        return 0

    checked_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    errors: list[str] = []
    notes: list[str] = []

    workers = max(1, min(int(workers), 32))
    total_timeout = max(1, int(total_timeout))
    print(f"Checking {len(sources)} live sources with {workers} workers (per-source timeout={timeout}s).")
    results: list[tuple[int, str]] = [(0, str(source.get("url", ""))) for source in sources]
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="live-source") as pool:
        futures = {pool.submit(check_url, source["url"], timeout): index for index, source in enumerate(sources)}
        try:
            completed_futures = as_completed(futures, timeout=total_timeout)
            for future in completed_futures:
                index = futures[future]
                try:
                    results[index] = future.result()
                except Exception as exc:  # an individual source must not abort the batch
                    notes.append(f"{sources[index]['id']}: checker error {type(exc).__name__}")
        except FuturesTimeoutError:
            remaining = sum(1 for status_code, _ in results if status_code == 0)
            notes.append(f"batch timeout after {total_timeout}s; {remaining} source checks remained bounded")

    for index, source in enumerate(sources):
        status_code, final_url = results[index]
        live_ok = 200 <= status_code < 400
        expected_ok = bool(source.get("ok"))
        expected_status = int(source.get("statusCode") or 0)
        # Some hosts (LinkedIn, Akamai-fronted publisher sites) block automated
        # requests inconsistently — sometimes a normal status, sometimes a bot-block
        # code — regardless of the page's real, human-visible liveness. Pinning any
        # single expected status for these makes the gate flaky rather than useful.
        # `knownBotBlocked` entries are manually verified in a real browser instead
        # (see sourceBasis); the automated check is informational only and never
        # gates or overwrites their recorded state.
        bot_blocked = bool(source.get("knownBotBlocked"))

        if bot_blocked:
            if not live_ok:
                notes.append(f"{source['id']}: bot-blocked host returned HTTP {status_code} (expected, not gated)")
        elif expected_ok and not live_ok:
            errors.append(f"{source['id']}: expected reachable, got HTTP {status_code} at {final_url}")
        elif not expected_ok and live_ok:
            errors.append(f"{source['id']}: expected not promoted, but now reachable at {final_url}")
        elif not expected_ok and expected_status and status_code != expected_status:
            errors.append(f"{source['id']}: expected HTTP {expected_status}, got HTTP {status_code} at {final_url}")
        elif status_code != expected_status:
            notes.append(
                f"{source['id']}: live result is HTTP {status_code} at {final_url}; manifest records HTTP {expected_status}"
            )

        if write and not bot_blocked:
            source["statusCode"] = status_code
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
    parser.add_argument("--timeout", type=int, default=10)
    parser.add_argument("--workers", type=int, default=16, help="Concurrent source checks (default: 16)")
    parser.add_argument("--total-timeout", type=int, default=90, help="Maximum batch wait in seconds (default: 90)")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Update checkedAt/statusCode/ok fields (and strip any committed finalUrl)",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Validate source-record shape without making network requests",
    )
    args = parser.parse_args()
    return verify(
        Path(args.manifest).resolve(),
        timeout=args.timeout,
        write=args.write,
        workers=args.workers,
        total_timeout=args.total_timeout,
        offline=args.offline,
    )


if __name__ == "__main__":
    raise SystemExit(main())
