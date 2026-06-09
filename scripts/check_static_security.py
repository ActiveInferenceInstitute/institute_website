#!/usr/bin/env python3
"""Validate the generated static site security contract."""

from __future__ import annotations

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = PROJECT_ROOT / "src" / "content"
EXCLUDED_PARTS = {".git", ".cache", "node_modules", "__pycache__", "src", "scripts"}
DISALLOWED_TAGS = {"form", "iframe", "object", "embed"}
REQUIRED_CSP_DIRECTIVES = {
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "upgrade-insecure-requests",
}


class StaticHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.anchors: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.metas: list[dict[str, str]] = []
        self.scripts: list[dict[str, str]] = []
        self.tags: list[tuple[str, dict[str, str]]] = []
        self.inline_script_chunks: list[str] = []
        self._inside_script = False
        self._current_script_has_src = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {name.lower(): value or "" for name, value in attrs}
        self.tags.append((tag.lower(), attrs_dict))
        if tag.lower() == "a":
            self.anchors.append(attrs_dict)
        elif tag.lower() == "link":
            self.links.append(attrs_dict)
        elif tag.lower() == "meta":
            self.metas.append(attrs_dict)
        elif tag.lower() == "script":
            self.scripts.append(attrs_dict)
            self._inside_script = True
            self._current_script_has_src = bool(attrs_dict.get("src"))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script":
            self._inside_script = False
            self._current_script_has_src = False

    def handle_data(self, data: str) -> None:
        if self._inside_script and not self._current_script_has_src and data.strip():
            self.inline_script_chunks.append(data.strip())


def parse_html(path: Path) -> StaticHtmlParser:
    parser = StaticHtmlParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def generated_html_files() -> list[Path]:
    return sorted(
        path
        for path in PROJECT_ROOT.rglob("*.html")
        if path.is_file() and not any(part in EXCLUDED_PARTS for part in path.relative_to(PROJECT_ROOT).parts)
    )


def external_url(value: str) -> bool:
    return urlparse(value).scheme in {"http", "https"}


def local_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "" and not value.startswith("//")


def live_urls() -> set[str]:
    manifest = json.loads((CONTENT_DIR / "live-sources.json").read_text(encoding="utf-8"))
    urls: set[str] = set()
    for source in manifest.get("sources", []):
        if not source.get("ok"):
            continue
        value = source.get("url")
        if value:
            clean = value.rstrip("/")
            urls.add(value)
            urls.add(clean)
            urls.add(f"{clean}/")
    return urls


def check_security() -> int:
    errors: list[str] = []
    allowed_live_urls = live_urls()
    html_files = generated_html_files()
    if not html_files:
        errors.append("no generated HTML files found")

    for html_path in html_files:
        relative = html_path.relative_to(PROJECT_ROOT)
        parser = parse_html(html_path)

        csp_values = [
            attrs.get("content", "")
            for attrs in parser.metas
            if attrs.get("http-equiv", "").lower() == "content-security-policy"
        ]
        if not csp_values:
            errors.append(f"{relative}: missing Content-Security-Policy meta tag")
        else:
            csp_parts = {part.strip() for part in csp_values[0].split(";") if part.strip()}
            missing = REQUIRED_CSP_DIRECTIVES - csp_parts
            if missing:
                errors.append(f"{relative}: CSP missing directives {sorted(missing)}")

        referrers = [
            attrs.get("content", "")
            for attrs in parser.metas
            if attrs.get("name", "").lower() == "referrer"
        ]
        if "strict-origin-when-cross-origin" not in referrers:
            errors.append(f"{relative}: missing strict referrer policy")

        for tag, attrs in parser.tags:
            if tag in DISALLOWED_TAGS:
                errors.append(f"{relative}: disallowed <{tag}> tag")
            for name in attrs:
                if name.startswith("on"):
                    errors.append(f"{relative}: inline event handler attribute {name}")

        if parser.inline_script_chunks:
            errors.append(f"{relative}: inline script content is not allowed")
        for script in parser.scripts:
            src = script.get("src", "")
            if src and not local_url(src):
                errors.append(f"{relative}: external script is not allowed: {src}")

        for link in parser.links:
            rel = link.get("rel", "").lower()
            href = link.get("href", "")
            if "stylesheet" in rel and href and not local_url(href):
                errors.append(f"{relative}: external stylesheet is not allowed: {href}")

        for anchor in parser.anchors:
            href = anchor.get("href", "")
            if href.startswith("mailto:") or href.startswith("#") or local_url(href):
                continue
            if not external_url(href):
                continue
            if "coda.io" in href.lower():
                errors.append(f"{relative}: direct Coda anchor is not allowed: {href}")
                continue
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{relative}: external anchor is not backed by live-sources.json: {href}")
            if anchor.get("target") != "_blank":
                errors.append(f"{relative}: external anchor missing target=_blank: {href}")
            rel_tokens = set(anchor.get("rel", "").split())
            if not {"noopener", "noreferrer"}.issubset(rel_tokens):
                errors.append(f"{relative}: external anchor missing noopener noreferrer: {href}")

    if errors:
        print("Static security check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Static security passed: CSP/referrer meta, local assets, safe external anchors, and no disallowed tags.")
    return 0


if __name__ == "__main__":
    raise SystemExit(check_security())
