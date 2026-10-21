#!/usr/bin/env python3
"""Verify registered public URLs without publishing resolved redirect destinations."""

from __future__ import annotations

import argparse
import ipaddress
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import UTC, datetime
from email.parser import Parser
from html.parser import HTMLParser
from pathlib import Path
from typing import TypeAlias
from urllib.parse import unquote, urldefrag, urljoin, urlsplit

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = PROJECT_ROOT / "src" / "content" / "live-sources.json"
USER_AGENT = "ActiveInferenceInstituteWebsiteCheck/1.0 (+https://github.com/ActiveInferenceInstitute/institute_website)"
BODY_LIMIT = 2 * 1024 * 1024
REDIRECT_LIMIT = 10
BOT_STATUSES = {403, 429, 999}
JSONValue: TypeAlias = str | bool | int | float | None | list["JSONValue"] | dict[str, "JSONValue"]


@dataclass(frozen=True, slots=True)
class Source:
    id: str
    url: str
    ok: bool
    status: int
    bot_blocked: bool


@dataclass(frozen=True, slots=True)
class Probe:
    status: int = 0
    error: str = ""


class ManifestError(ValueError):
    pass


def validate_url(url: str, *, registered: bool = True) -> None:
    try:
        if any(c.isspace() or ord(c) < 32 or 127 <= ord(c) <= 159 for c in url) or "\\" in url:
            raise ValueError
        if re.search(r"%(?![0-9a-fA-F]{2})", url):
            raise ValueError
        decoded = unquote(url, errors="strict")
        if any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in decoded):
            raise ValueError
        parts = urlsplit(url)
        host = (parts.hostname or "").encode("idna").decode("ascii").lower().rstrip(".")
        if (
            parts.scheme not in {"http", "https"}
            or not host
            or parts.username is not None
            or parts.password is not None
        ):
            raise ValueError
        if parts.port is not None and not 1 <= parts.port <= 65535:
            raise ValueError
        if ":" in host:
            ipaddress.IPv6Address(host)
        elif not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in host.split(".")):
            raise ValueError
        if registered and (host == "coda.io" or host.endswith(".coda.io")):
            raise ValueError
    except (ValueError, UnicodeError):
        raise ManifestError(
            "URL must be absolute HTTP(S), without credentials, controls, or direct Coda destinations"
        ) from None


def load_manifest(path: Path) -> tuple[dict[str, JSONValue], list[Source]]:
    data: JSONValue = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("sources"), list):
        raise ManifestError("root must be an object containing a sources list")
    if not data["sources"]:
        raise ManifestError("sources list must not be empty")
    sources: list[Source] = []
    ids: set[str] = set()
    for index, entry in enumerate(data["sources"]):
        prefix = f"source record {index}"
        if not isinstance(entry, dict):
            raise ManifestError(f"{prefix} must be an object")
        source_id, url = entry.get("id"), entry.get("url")
        if (
            not isinstance(source_id, str)
            or not source_id
            or any(c.isspace() or ord(c) < 32 or 127 <= ord(c) <= 159 for c in source_id)
        ):
            raise ManifestError(f"{prefix} must have a nonempty id without whitespace or controls")
        if source_id in ids:
            raise ManifestError(f"{prefix} has a duplicate id")
        ids.add(source_id)
        if not isinstance(url, str):
            raise ManifestError(f"{prefix} must have a URL string")
        validate_url(url)
        if "finalUrl" in entry:
            raise ManifestError(f"{prefix} contains forbidden resolved finalUrl evidence; reconcile explicitly")
        if type(entry.get("ok")) is not bool or type(entry.get("knownBotBlocked", False)) is not bool:
            raise ManifestError(f"{prefix} ok/knownBotBlocked must be booleans")
        status = entry.get("statusCode")
        if type(status) is not int or not (status == 0 or 100 <= status <= 599 or status == 999):
            raise ManifestError(f"{prefix} statusCode must be an HTTP status integer or zero")
        sources.append(Source(source_id, url, entry["ok"], status, entry.get("knownBotBlocked", False)))
    return data, sources


class Anchors(HTMLParser):
    def __init__(self, fragment: str):
        super().__init__(convert_charrefs=True)
        self.fragment = fragment
        self.found = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.found |= any(
            value == self.fragment and (key == "id" or (tag == "a" and key == "name")) for key, value in attrs
        )


def check_url(url: str, deadline: float) -> Probe:
    try:
        with tempfile.TemporaryDirectory(prefix="live-source-") as directory:
            headers_path, body_path = Path(directory) / "headers", Path(directory) / "body"
            for _ in range(REDIRECT_LIMIT + 1):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return Probe(error="network deadline exceeded")
                request_url, fragment = urldefrag(url)
                command = [
                    "curl",
                    "--disable",
                    "--silent",
                    "--show-error",
                    "--globoff",
                    "--proto",
                    "=http,https",
                    "--max-redirs",
                    "0",
                    "--max-time",
                    str(remaining),
                    "--connect-timeout",
                    str(min(remaining, 10)),
                    "--dump-header",
                    str(headers_path),
                    "--output",
                    str(body_path) if fragment else os.devnull,
                    "--write-out",
                    "%{http_code}",
                    "--user-agent",
                    USER_AGENT,
                ]
                if fragment:
                    command.extend(["--max-filesize", str(BODY_LIMIT)])
                command.extend(["--url", request_url])
                try:
                    completed = subprocess.run(command, capture_output=True, text=True, check=False, timeout=remaining)
                except subprocess.TimeoutExpired:
                    return Probe(error="network deadline exceeded")
                status = int(completed.stdout) if re.fullmatch(r"\d{3}", completed.stdout) else 0
                if completed.returncode != 0:
                    return Probe(status, f"incomplete curl transfer (exit {completed.returncode})")
                if status == 0:
                    return Probe(error="missing HTTP status")
                with headers_path.open("rb") as stream:
                    header_bytes = stream.read(256 * 1024 + 1)
                if len(header_bytes) > 256 * 1024:
                    return Probe(status, "response headers exceed limit")
                header_block = header_bytes.decode("iso-8859-1").replace("\r\n", "\n").strip().split("\n\n")[-1]
                headers = Parser().parsestr(header_block.partition("\n")[2])
                if status in {301, 302, 303, 307, 308}:
                    location = headers.get("Location")
                    if not location:
                        return Probe(status, "redirect has no Location")
                    if any(c.isspace() or ord(c) < 32 or 127 <= ord(c) <= 159 for c in location) or "\\" in location:
                        return Probe(status, "unsafe or malformed redirect URL")
                    target = urljoin(url, location)
                    if "#" not in location and "#" in url:
                        target = urldefrag(target)[0] + "#" + fragment
                    validate_url(target, registered=False)
                    url = target
                    continue
                if 300 <= status < 400:
                    return Probe(status, "unresolved HTTP redirect")
                if not 200 <= status < 300 or not fragment:
                    return Probe(status)
                if headers.get_content_type() not in {"text/html", "application/xhtml+xml"}:
                    return Probe(status, "fragment unverified: response is not HTML (including PDF)")
                with body_path.open("rb") as stream:
                    body = stream.read(BODY_LIMIT + 1)
                if len(body) > BODY_LIMIT:
                    return Probe(status, "fragment unverified: response body exceeds limit")
                parser = Anchors(unquote(fragment, errors="strict"))
                document = body.decode(headers.get_content_charset() or "utf-8", errors="replace")
                for start in range(0, len(document), 1024):
                    if time.monotonic() >= deadline:
                        return Probe(status, "fragment parsing deadline exceeded")
                    parser.feed(document[start : start + 1024])
                    if parser.found:
                        break
                if time.monotonic() >= deadline:
                    return Probe(status, "fragment parsing deadline exceeded")
                parser.close()
                return Probe(status, "" if parser.found else "fragment not found in HTML id/name anchors")
            return Probe(status, "redirect limit exceeded")
    except ManifestError:
        return Probe(error="unsafe or malformed redirect URL")
    except (OSError, UnicodeError, LookupError):
        return Probe(error="probe I/O or decoding failure")


def probe_sources(sources: list[Source], timeout: float, workers: int, total_timeout: float) -> list[Probe]:
    deadline = time.monotonic() + total_timeout
    results = [Probe(error="batch deadline exceeded before verification") for _ in sources]
    pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="live-source")
    pending = {}
    next_index = 0
    try:
        while next_index < len(sources) or pending:
            while next_index < len(sources) and len(pending) < workers and time.monotonic() < deadline:
                index = next_index
                next_index += 1
                per_source_deadline = min(deadline, time.monotonic() + timeout)
                pending[pool.submit(check_url, sources[index].url, per_source_deadline)] = index
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not pending:
                break
            done, _ = wait(pending, timeout=remaining, return_when=FIRST_COMPLETED)
            for future in done:
                results[pending.pop(future)] = future.result()
    finally:
        for future in pending:
            future.cancel()
        # Only running, deadline-bounded subprocesses can remain; no queued batch waits.
        pool.shutdown(wait=True, cancel_futures=True)
    return results


def verify(
    manifest_path: Path,
    *,
    timeout: float,
    write: bool,
    workers: int = 16,
    total_timeout: float = 90,
    offline: bool = False,
    report: Path | None = None,
) -> int:
    try:
        if not all(math.isfinite(value) and value > 0 for value in (timeout, total_timeout)) or not 1 <= workers <= 32:
            raise ManifestError("timeouts must be finite and positive; workers must be between 1 and 32")
        if report is not None and (
            report.resolve() == manifest_path.resolve() or (report.exists() and report.samefile(manifest_path))
        ):
            raise ManifestError("report path must differ from manifest path")
        manifest, sources = load_manifest(manifest_path)
    except (OSError, UnicodeError, ValueError) as exc:
        reason = str(exc) if isinstance(exc, ManifestError) else "cannot read or decode JSON manifest"
        print(f"Live-source manifest is invalid: {reason}", file=sys.stderr)
        return 1

    probes = [Probe() for _ in sources] if offline else probe_sources(sources, timeout, workers, total_timeout)
    rows = []
    errors = 0
    for source, probe in zip(sources, probes, strict=True):
        outcome, error = "verified", probe.error
        live_ok = 200 <= probe.status < 300
        if offline:
            outcome = "offline"
        elif not error and source.bot_blocked and probe.status in BOT_STATUSES:
            outcome, error = "unverified", "plausible bot response; human verification required"
        else:
            if not error and not live_ok and probe.status >= 500:
                error = "HTTP server error"
            if not error and source.ok != live_ok:
                error = "HTTP reachability differs from registered ok"
            if not error and not source.ok and probe.status != source.status:
                error = "HTTP status differs from registered statusCode"
            if not error and probe.status == 0:
                error = "incomplete HTTP verification"
            if error:
                outcome = "error"
                errors += 1
        rows.append({"id": source.id, "url": source.url, "statusCode": probe.status, "result": outcome, "error": error})
        if error:
            print(
                f"{outcome}: {source.id} {source.url} HTTP {probe.status}: {error}",
                file=sys.stderr if outcome == "error" else sys.stdout,
            )

    counts = {
        kind: sum(row["result"] == kind for row in rows) for kind in ("verified", "unverified", "error", "offline")
    }
    try:
        if report is not None:
            report.write_text(json.dumps({"counts": counts, "sources": rows}, indent=2) + "\n", encoding="utf-8")
        if write and not errors and not offline:
            checked_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            for entry, row in zip(manifest["sources"], rows, strict=True):
                if row["result"] == "verified" and not entry.get("knownBotBlocked", False):
                    entry.update(statusCode=row["statusCode"], ok=200 <= row["statusCode"] < 300, checkedAt=checked_at)
            if not counts["unverified"]:
                manifest["lastCheckedAt"] = checked_at
            manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except OSError:
        print("Live-source evidence could not be written", file=sys.stderr)
        return 1
    print(
        f"Live sources: {counts['verified']} verified, {counts['unverified']} unverified, {counts['error']} errors, {counts['offline']} offline."
        + (" Network skipped." if offline else "")
    )
    return int(bool(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--timeout", type=float, default=10)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--total-timeout", type=float, default=90)
    parser.add_argument(
        "--write", action="store_true", help="Refresh verified evidence only after successful verification"
    )
    parser.add_argument("--offline", action="store_true", help="Validate records without network or manifest mutation")
    parser.add_argument("--report", type=Path, help="Write safe per-source JSON results (registered URLs only)")
    args = parser.parse_args()
    return verify(
        Path(args.manifest).resolve(),
        timeout=args.timeout,
        write=args.write,
        workers=args.workers,
        total_timeout=args.total_timeout,
        offline=args.offline,
        report=args.report,
    )


if __name__ == "__main__":
    raise SystemExit(main())
