"""Verify the complete public export inventory before sync reads or writes it."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Final

ROOT_KEYS: Final = {"files", "gate_version", "generated_at", "source_fingerprint"}
ENTRY_KEYS: Final = {"name", "output_path", "record_count", "sha256", "target"}
RASTER_HEADERS: Final = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".webp": (b"RIFF",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
}
RASTER_SUFFIXES: Final = set(RASTER_HEADERS)
TARGETS: Final = {
    "content": "src/content/instituteos",
    "data": "data",
    "pages_domains": "src/content/pages/domains",
    "newsletter_assets": "assets/img/newsletters",
}


def check_export_manifest(root: Path, content_names: tuple[str, ...]) -> list[str]:
    """Return errors for incomplete, unsafe, or byte-inconsistent public exports."""
    root = root.resolve()
    errors: list[str] = []
    manifest_path = root / "data/export-manifest.json"
    if manifest_path.is_symlink():
        return ["export manifest must not be a symlink"]
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"export manifest could not be read: {exc}"]
    if not isinstance(manifest, dict) or set(manifest) != ROOT_KEYS:
        return ["export manifest must contain exactly files, gate_version, generated_at, source_fingerprint"]
    if manifest["gate_version"] != "1.0.0":
        errors.append("export manifest gate_version must be 1.0.0")
    if not isinstance(manifest["source_fingerprint"], str) or not re.fullmatch(r"[a-f0-9]{12}", manifest["source_fingerprint"]):
        errors.append("export manifest source_fingerprint must be 12 lowercase hexadecimal characters")
    try:
        stamp = datetime.fromisoformat(manifest["generated_at"])
        if stamp.utcoffset() is None:
            errors.append("export manifest generated_at must include a timezone")
    except (TypeError, ValueError):
        errors.append("export manifest generated_at must be an ISO timestamp")
    entries = manifest["files"]
    if not isinstance(entries, list) or not entries:
        return errors + ["export manifest files must be a nonempty list"]
    required = {f"src/content/instituteos/{name}" for name in content_names}
    required.add("data/projects.json")
    for target in ("content", "pages_domains", "newsletter_assets"):
        directory = root / TARGETS[target]
        if not directory.exists():
            continue
        if directory.is_symlink():
            errors.append(f"export manifest namespace uses a symlink: {TARGETS[target]}")
            continue
        for path in directory.iterdir():
            if path.is_symlink() or not path.is_file():
                errors.append(f"export manifest namespace must be flat regular files: {path.relative_to(root)}")
                continue
            if target == "content" and path.name == "README.md":
                continue
            suffixes = RASTER_SUFFIXES if target == "newsletter_assets" else {".json"}
            if path.suffix not in suffixes:
                errors.append(f"export manifest namespace has an unsupported file: {path.relative_to(root)}")
            if target != "content":
                required.add(str(path.relative_to(root)))
    seen: set[str] = set()
    digests: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != ENTRY_KEYS:
            errors.append("export manifest entry must contain exactly name, output_path, record_count, sha256, target")
            continue
        if any(not isinstance(entry[key], str) for key in ("name", "output_path", "sha256", "target")):
            errors.append("export manifest entry string fields have invalid types")
            continue
        output = entry["output_path"]
        target = entry["target"]
        path = PurePosixPath(output)
        directory = TARGETS.get(target)
        expected_name = f"newsletter-media/{path.name}" if target == "newsletter_assets" else path.name
        valid_path = directory is not None and str(path.parent) == directory and str(path) == output
        valid_path = valid_path and "\\" not in output and entry["name"] == expected_name
        valid_path = valid_path and path.suffix in (RASTER_SUFFIXES if target == "newsletter_assets" else {".json"})
        valid_path = valid_path and (target != "content" or path.name in content_names)
        valid_path = valid_path and (target != "data" or path.name == "projects.json")
        if not valid_path:
            errors.append("export manifest contains an unapproved output path or name")
            continue
        if output in seen:
            errors.append(f"export manifest duplicate output: {output}")
        seen.add(output)
        destination = root / output
        if any(part.is_symlink() for part in (destination, *destination.parents)):
            errors.append(f"export manifest output uses a symlink: {output}")
            continue
        if type(entry["record_count"]) is not int or entry["record_count"] < 0:
            errors.append(f"export manifest invalid record_count: {output}")
            continue
        if not re.fullmatch(r"[a-f0-9]{64}", entry["sha256"]):
            errors.append(f"export manifest invalid sha256: {output}")
            continue
        digests.append(entry["sha256"])
        try:
            content = destination.read_bytes()
            if hashlib.sha256(content).hexdigest() != entry["sha256"]:
                errors.append(f"export manifest sha256 mismatch: {output}")
            if target != "newsletter_assets":
                payload = json.loads(content)
                if not isinstance(payload, dict):
                    errors.append(f"export payload must be an object: {output}")
                    continue
                count = 1
                for key in ("records", "nodes", "domains", "narratives", "videos", "projects"):
                    if key in payload:
                        if not isinstance(payload[key], list):
                            errors.append(f"export payload {key} must be a list: {output}")
                        else:
                            count = len(payload[key])
                        break
                if entry["record_count"] != count:
                    errors.append(f"export manifest record_count mismatch: {output}")
            else:
                raster = content.startswith(RASTER_HEADERS[path.suffix])
                raster = raster and (path.suffix != ".webp" or content[8:12] == b"WEBP")
                if not raster:
                    errors.append(f"export manifest asset has an invalid raster signature: {output}")
                if entry["record_count"] != 1:
                    errors.append(f"export asset record_count must be 1: {output}")
        except (OSError, ValueError) as exc:
            errors.append(f"export manifest output cannot be read: {output}: {exc}")
    fingerprint = hashlib.sha256("\n".join(sorted(digests)).encode()).hexdigest()[:12]
    if manifest["source_fingerprint"] != fingerprint:
        errors.append("export manifest source_fingerprint does not match artifact inventory")
    errors.extend(f"export manifest missing required output: {path}" for path in sorted(required - seen))
    return errors
