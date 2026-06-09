#!/usr/bin/env python3
"""Check the generated static site against the public release contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = PROJECT_ROOT / "src" / "content"
CANONICAL_BASE = "https://activeinferenceinstitute.github.io/institute_website/"
ALLOWED_TEMPLATE_EXTERNAL_URLS = {"http://www.sitemaps.org/schemas/sitemap/0.9"}
EXPECTED_PDF_PAGES = 211
CURATED_SECTION_IDS = {"source-coverage", "verified-links", "related-pages"}
OLD_THEME_PATTERNS = [
    "docxology.github.io",
    "docxology/institute_website",
    "#11383f",
    "#0e7c7b",
    "#bd8b2f",
    "#b94b4b",
    "#2f5f8f",
    "#fbfaf6",
    "#eef3ef",
    "#fff8e8",
    "#0f252a",
    "var(--teal)",
    "var(--gold)",
    "var(--coral)",
    "var(--blue)",
]
SCAN_EXCLUDES = {
    ".git",
    "node_modules",
    "__pycache__",
}
SCAN_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".txt", ".xml"}


class HtmlInfo(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.anchors: list[tuple[str, str]] = []
        self.links: list[tuple[str, dict[str, str]]] = []
        self.metas: list[dict[str, str]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {name: value or "" for name, value in attrs}
        if "id" in attrs_dict:
            self.ids.add(attrs_dict["id"])
        if tag == "a" and attrs_dict.get("href"):
            self.anchors.append((attrs_dict["href"], attrs_dict.get("class", "")))
        if tag == "link":
            self.links.append((attrs_dict.get("rel", ""), attrs_dict))
        if tag == "meta":
            self.metas.append(attrs_dict)


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_html(path: Path) -> HtmlInfo:
    parser = HtmlInfo()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def external_href(href: str) -> bool:
    parsed = urlparse(href)
    return parsed.scheme in {"http", "https"}


def internal_site_href(href: str) -> bool:
    return href.startswith(CANONICAL_BASE)


def live_source_urls(manifest: dict) -> set[str]:
    urls: set[str] = set()
    for source in manifest.get("sources", []):
        if source.get("ok"):
            for key in ("url", "finalUrl"):
                value = source.get(key)
                if value:
                    urls.add(value)
                    urls.add(value.rstrip("/"))
                    urls.add(f"{value.rstrip('/')}/")
    return urls


def generated_public_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
            continue
        relative_parts = path.relative_to(root).parts
        if any(part in SCAN_EXCLUDES for part in relative_parts):
            continue
        if relative_parts[0] in {"scripts"}:
            continue
        files.append(path)
    return sorted(files)


def section_between(text: str, start_marker: str, end_marker: str) -> str:
    start = text.find(start_marker)
    if start == -1:
        return ""
    end = text.find(end_marker, start + len(start_marker))
    return text[start:] if end == -1 else text[start:end]


def check_pdf_pages(root: Path, errors: list[str]) -> None:
    pdf_data = load_json(root / "src" / "content" / "pdf-pages.json")
    pages = pdf_data.get("pages", [])
    reported = pdf_data.get("source", {}).get("reportedPages")
    if len(pages) != EXPECTED_PDF_PAGES:
        errors.append(f"pdf-pages.json has {len(pages)} pages, expected {EXPECTED_PDF_PAGES}")
    if reported != EXPECTED_PDF_PAGES:
        errors.append(f"pdf-pages.json reports {reported} pages, expected {EXPECTED_PDF_PAGES}")


def check_curated_pages(root: Path, errors: list[str]) -> None:
    pages_dir = root / "src" / "content" / "pages"
    pages = sorted(
        (load_json(path) for path in pages_dir.glob("*.json")),
        key=lambda page: (page.get("order", 0), page.get("slug", "")),
    )
    page_hrefs = {f"{page['slug']}.html" for page in pages}
    manifest = load_json(root / "src" / "content" / "live-sources.json")
    allowed_live_urls = live_source_urls(manifest)

    for page in pages:
        slug = page["slug"]
        html_path = root / f"{slug}.html"
        if not html_path.exists():
            errors.append(f"{slug}: generated HTML is missing")
            continue

        html = html_path.read_text(encoding="utf-8")
        info = parse_html(html_path)
        hrefs = [href for href, _class_name in info.anchors]

        if "On this page" not in html:
            errors.append(f"{slug}: missing page-local table of contents label")
        if not {"#source-coverage", "#verified-links", "#related-pages"}.issubset(set(hrefs)):
            errors.append(f"{slug}: page guide does not link to source, verified, and related sections")
        missing_ids = CURATED_SECTION_IDS - info.ids
        if missing_ids:
            errors.append(f"{slug}: missing section ids {sorted(missing_ids)}")
        if not any(href.startswith("atlas/page-") for href in hrefs):
            errors.append(f"{slug}: missing actionable Source Atlas page link")

        related_section = section_between(html, 'id="related-pages"', 'class="pager page-pager"')
        if not any(f'href="{href}"' in related_section for href in page_hrefs - {f"{slug}.html"}):
            errors.append(f"{slug}: related-pages section lacks a related internal page link")

        verified_section = section_between(html, 'id="verified-links"', 'id="related-pages"')
        verified_external_hrefs = [
            match.group(1) for match in re.finditer(r'href="(https?://[^"]+)"', verified_section)
        ]
        if not verified_external_hrefs:
            errors.append(f"{slug}: verified-links section lacks an external link")
        for href in verified_external_hrefs:
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{slug}: verified external link is not in live-sources.json: {href}")

        for href in hrefs:
            if not external_href(href) or internal_site_href(href):
                continue
            if href.startswith("mailto:"):
                continue
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{slug}: external anchor is not represented in live-sources.json: {href}")


def check_canonical_outputs(root: Path, errors: list[str]) -> None:
    site = load_json(root / "src" / "content" / "site.json")
    if site.get("baseUrl") != CANONICAL_BASE:
        errors.append(f"site.json baseUrl is {site.get('baseUrl')!r}, expected {CANONICAL_BASE!r}")

    robots = (root / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {CANONICAL_BASE}sitemap.xml" not in robots:
        errors.append("robots.txt does not point at the canonical sitemap URL")

    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    if f"<loc>{CANONICAL_BASE}</loc>" not in sitemap:
        errors.append("sitemap.xml does not include the canonical root URL")
    if "docxology" in sitemap:
        errors.append("sitemap.xml contains a stale docxology reference")

    html_paths = sorted(
        path
        for path in root.rglob("*.html")
        if not any(part in SCAN_EXCLUDES or part in {"src", "scripts", "node_modules"} for part in path.relative_to(root).parts)
    )
    for html_path in html_paths:
        if not html_path.exists():
            continue
        info = parse_html(html_path)
        canonical = [
            attrs.get("href", "")
            for rel, attrs in info.links
            if rel.lower() == "canonical"
        ]
        if not canonical or not canonical[0].startswith(CANONICAL_BASE):
            errors.append(f"{html_path.relative_to(root)} has invalid canonical URL {canonical[:1]}")
        og_urls = [
            attrs.get("content", "")
            for attrs in info.metas
            if attrs.get("property") == "og:url"
        ]
        if not og_urls or not og_urls[0].startswith(CANONICAL_BASE):
            errors.append(f"{html_path.relative_to(root)} has invalid og:url {og_urls[:1]}")


def check_stale_theme_references(root: Path, errors: list[str]) -> None:
    for path in generated_public_files(root):
        text = path.read_text(encoding="utf-8", errors="ignore")
        lower = text.lower()
        for pattern in OLD_THEME_PATTERNS:
            if pattern.lower() in lower:
                errors.append(f"{path.relative_to(root)} contains stale reference {pattern}")


def check_template_external_urls(root: Path, errors: list[str]) -> None:
    build_text = (root / "src" / "build.mjs").read_text(encoding="utf-8")
    external_urls = [
        match.group(0)
        for match in re.finditer(r"https?://[^\"'`<>\s)]+", build_text)
        if not match.group(0).startswith(CANONICAL_BASE)
        and match.group(0) not in ALLOWED_TEMPLATE_EXTERNAL_URLS
    ]
    if external_urls:
        errors.append(f"src/build.mjs hardcodes external URLs instead of live-sources.json: {external_urls}")


def check_site_contract(root: Path) -> int:
    errors: list[str] = []
    check_pdf_pages(root, errors)
    check_curated_pages(root, errors)
    check_canonical_outputs(root, errors)
    check_stale_theme_references(root, errors)
    check_template_external_urls(root, errors)

    if errors:
        print("Site contract check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Site contract passed: 211 PDF pages, curated signposting, canonical URLs, dark palette, and live-source external links.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=str(PROJECT_ROOT), help="Repository/site root")
    args = parser.parse_args()
    return check_site_contract(Path(args.root).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
