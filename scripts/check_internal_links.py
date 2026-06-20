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
        # Fragment targets declared in this document (id="" / name="" anchors),
        # used to verify that #fragment links resolve to a real anchor.
        self.fragments: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in LOCAL_ATTRS and value:
                self.links.append((tag, value))
            if name in ("id", "name") and value:
                self.fragments.add(value)


def generated_html_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*.html"):
        relative_parts = path.relative_to(root).parts
        if any(part in SKIP_DIRS for part in relative_parts):
            continue
        files.append(path)
    return sorted(files)


def resolve_local_reference(source: Path, raw_url: str, root: Path) -> tuple[Path | None, str]:
    """Resolve a local reference to (target file, fragment).

    Returns (None, fragment) for external/empty/protocol-relative references and
    for bare same-page "#fragment" links (whose target file is the source
    itself). The fragment is the decoded part after "#" (empty when absent).
    """
    parsed = urlparse(raw_url)
    fragment = unquote(parsed.fragment) if parsed.fragment else ""
    if parsed.scheme in EXTERNAL_SCHEMES:
        return None, ""
    if not parsed.path:
        # Bare "#fragment" (or "#"): the target is the source document itself.
        return (source if fragment else None), fragment
    if parsed.path.startswith("//"):
        return None, ""

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
    return target, fragment


def fragments_for(path: Path, cache: dict[Path, set[str]]) -> set[str]:
    """Parse a generated HTML file once and return its declared fragment anchors."""
    cached = cache.get(path)
    if cached is None:
        parser = LinkParser()
        parser.feed(path.read_text(encoding="utf-8"))
        cached = parser.fragments
        cache[path] = cached
    return cached


def check_links(root: Path) -> int:
    errors: list[str] = []
    html_files = generated_html_files(root)
    fragment_cache: dict[Path, set[str]] = {}
    for html_file in html_files:
        parser = LinkParser()
        parser.feed(html_file.read_text(encoding="utf-8"))
        fragment_cache[html_file] = parser.fragments
        for tag, raw_url in parser.links:
            try:
                target, fragment = resolve_local_reference(html_file, raw_url, root)
            except ValueError as exc:
                errors.append(f"{html_file.relative_to(root)} {tag} {exc}")
                continue
            if target is None:
                continue
            if not target.exists():
                errors.append(
                    f"{html_file.relative_to(root)} {tag} references missing {raw_url} -> {target.relative_to(root)}"
                )
                continue
            # Verify the #fragment resolves to a real anchor in the target file.
            if fragment and fragment not in fragments_for(target, fragment_cache):
                errors.append(
                    f"{html_file.relative_to(root)} {tag} references missing anchor {raw_url} -> "
                    f"{target.relative_to(root)}#{fragment}"
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
