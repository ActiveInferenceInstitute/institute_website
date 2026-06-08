#!/usr/bin/env python3
"""Check generated HTML files for broken local links and asset references."""

from __future__ import annotations

import argparse
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", ".cache", "node_modules", "scripts", "src"}
LOCAL_ATTRS = {"href", "src", "poster"}
EXTERNAL_SCHEMES = {"http", "https", "mailto", "tel", "sms", "data", "javascript"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in LOCAL_ATTRS and value:
                self.links.append((tag, value))


def generated_html_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*.html"):
        relative_parts = path.relative_to(root).parts
        if any(part in SKIP_DIRS for part in relative_parts):
            continue
        files.append(path)
    return sorted(files)


def resolve_local_reference(source: Path, raw_url: str, root: Path) -> Path | None:
    parsed = urlparse(raw_url)
    if parsed.scheme in EXTERNAL_SCHEMES:
        return None
    if not parsed.path:
        return None
    if parsed.path.startswith("//"):
        return None

    target_path = unquote(parsed.path)
    if target_path.startswith("/"):
        target = root / target_path.lstrip("/")
    else:
        target = source.parent / target_path

    target = target.resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise ValueError(f"escapes project root: {raw_url}")

    if raw_url.split("#", 1)[0].split("?", 1)[0].endswith("/") or target.is_dir():
        target = target / "index.html"
    return target


def check_links(root: Path) -> int:
    errors: list[str] = []
    html_files = generated_html_files(root)
    for html_file in html_files:
        parser = LinkParser()
        parser.feed(html_file.read_text(encoding="utf-8"))
        for tag, raw_url in parser.links:
            try:
                target = resolve_local_reference(html_file, raw_url, root)
            except ValueError as exc:
                errors.append(f"{html_file.relative_to(root)} {tag} {exc}")
                continue
            if target is None:
                continue
            if not target.exists():
                errors.append(
                    f"{html_file.relative_to(root)} {tag} references missing {raw_url} -> {target.relative_to(root)}"
                )

    if errors:
        print("Broken local references:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Checked {len(html_files)} HTML files; no broken local references.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=str(PROJECT_ROOT), help="Generated site root")
    args = parser.parse_args()
    return check_links(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
