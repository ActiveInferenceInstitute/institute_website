#!/usr/bin/env python3
"""Check the generated static site against the public resource-hub contract."""

from __future__ import annotations

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
CURATED_SECTION_IDS = {"key-surfaces", "resources", "related-pages"}
OBSOLETE_PATHS = [
    "atlas",
    "assets/source/AII.pdf",
    "assets/js/atlas.js",
    "source.html",
    "src/content/pdf-pages.json",
    "scripts/extract_pdf.py",
]
OBSOLETE_TEXT_PATTERNS = [
    r"\bPDF\b",
    r"AII\.pdf",
    r"Source Atlas",
    r"Source Manifest",
    r"source-page",
    r"pdf-pages",
    r"Pages\s+[0-9]",
    r"atlas/",
]
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
    ".cache",
    "node_modules",
    "__pycache__",
    "scripts",
}
SCAN_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".txt", ".xml"}


class HtmlInfo(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.anchors: list[tuple[str, str]] = []
        self.links: list[tuple[str, dict[str, str]]] = []
        self.metas: list[dict[str, str]] = []
        self.ids: set[str] = set()
        self.start_tags: list[tuple[str, dict[str, str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {name: value or "" for name, value in attrs}
        self.start_tags.append((tag, attrs_dict))
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
    for item in manifest.get("sources", []):
        if not item.get("ok"):
            continue
        for key in ("url", "finalUrl"):
            value = item.get(key)
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
        files.append(path)
    return sorted(files)


def generated_html_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*.html")
        if not any(part in SCAN_EXCLUDES or part in {"src"} for part in path.relative_to(root).parts)
    )


def section_between(text: str, start_marker: str, end_marker: str) -> str:
    start = text.find(start_marker)
    if start == -1:
        return ""
    end = text.find(end_marker, start + len(start_marker))
    return text[start:] if end == -1 else text[start:end]


def collect_source_ids(value: object) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        source_id = value.get("sourceId")
        if isinstance(source_id, str):
            found.add(source_id)
        for child in value.values():
            found.update(collect_source_ids(child))
    elif isinstance(value, list):
        for child in value:
            found.update(collect_source_ids(child))
    return found


def check_no_obsolete_public_artifacts(root: Path, errors: list[str]) -> None:
    for relative in OBSOLETE_PATHS:
        if (root / relative).exists():
            errors.append(f"obsolete public artifact remains: {relative}")
    for image in (root / "assets" / "img").glob("source-page-*.png"):
        errors.append(f"obsolete public image remains: {image.relative_to(root)}")


def check_content_model(root: Path, errors: list[str]) -> None:
    site = load_json(root / "src" / "content" / "site.json")
    if "sourcePdf" in site:
        errors.append("site.json still contains the obsolete sourcePdf field")

    navigation = load_json(root / "src" / "content" / "navigation.json")
    if not navigation or any("items" not in group or not group["items"] for group in navigation):
        errors.append("navigation.json must define grouped dropdown navigation")

    manifest = load_json(root / "src" / "content" / "live-sources.json")
    live_ids = {item["id"] for item in manifest.get("sources", [])}
    resources = load_json(root / "src" / "content" / "resources.json")
    resource_categories = {item["id"] for item in resources.get("categories", [])}
    if not resource_categories:
        errors.append("resources.json must define resource categories")
    if not resources.get("resources"):
        errors.append("resources.json must define resource entries")

    for source_id in collect_source_ids(resources):
        if source_id not in live_ids:
            errors.append(f"resources.json references missing live source id: {source_id}")

    for path in sorted((root / "src" / "content" / "pages").glob("*.json")):
        page = load_json(path)
        slug = page.get("slug", path.stem)
        if "sourceRange" in page:
            errors.append(f"{slug}: obsolete sourceRange field remains")
        for required in ("audience", "resourceGroups", "primaryActions", "relatedSlugs", "externalSourceIds"):
            if not page.get(required):
                errors.append(f"{slug}: missing required public content field {required}")
        unknown_groups = set(page.get("resourceGroups", [])) - resource_categories
        if unknown_groups:
            errors.append(f"{slug}: unknown resource groups {sorted(unknown_groups)}")
        for source_id in collect_source_ids(page):
            if source_id not in live_ids:
                errors.append(f"{slug}: references missing live source id: {source_id}")


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
        if not {"#resources", "#related-pages"}.issubset(set(hrefs)):
            errors.append(f"{slug}: page guide does not link to resources and related sections")
        missing_ids = CURATED_SECTION_IDS - info.ids
        if missing_ids:
            errors.append(f"{slug}: missing section ids {sorted(missing_ids)}")

        related_section = section_between(html, 'id="related-pages"', 'class="pager page-pager"')
        if not any(f'href="{href}"' in related_section for href in page_hrefs - {f"{slug}.html"}):
            errors.append(f"{slug}: related-pages section lacks a related internal page link")

        resources_section = section_between(html, 'id="resources"', 'id="related-pages"')
        verified_external_hrefs = [
            match.group(1) for match in re.finditer(r'href="(https?://[^"]+)"', resources_section)
        ]
        if not verified_external_hrefs:
            errors.append(f"{slug}: resources section lacks an external verified link")
        for href in verified_external_hrefs:
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{slug}: external resource link is not in live-sources.json: {href}")

        for href in hrefs:
            if not external_href(href) or internal_site_href(href):
                continue
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{slug}: external anchor is not represented in live-sources.json: {href}")


def check_resource_directory(root: Path, errors: list[str]) -> None:
    resources_html = root / "resources.html"
    if not resources_html.exists():
        errors.append("resources.html is missing")
        return
    html = resources_html.read_text(encoding="utf-8")
    info = parse_html(resources_html)
    for required_id in ("resource-search", "resource-category", "resource-count"):
        if required_id not in info.ids:
            errors.append(f"resources.html missing {required_id}")
    if 'class="resource-card"' not in html and " resource-card" not in html:
        errors.append("resources.html does not render resource cards")

    categories = load_json(root / "src" / "content" / "resources.json").get("categories", [])
    missing = [category["id"] for category in categories if category["id"] not in info.ids]
    if missing:
        errors.append(f"resources.html missing category anchors {missing}")


def check_navigation(root: Path, errors: list[str]) -> None:
    for html_path in generated_html_files(root):
        html = html_path.read_text(encoding="utf-8")
        if 'class="nav-menu-button"' not in html:
            errors.append(f"{html_path.relative_to(root)} lacks dropdown navigation buttons")
        if "aria-expanded" not in html or "data-nav-toggle" not in html:
            errors.append(f"{html_path.relative_to(root)} lacks accessible navigation disclosure attributes")


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
    for obsolete in ("source.html", "assets/source", "atlas"):
        if obsolete in sitemap:
            errors.append(f"sitemap.xml contains obsolete entry {obsolete}")

    for html_path in generated_html_files(root):
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


def check_stale_references(root: Path, errors: list[str]) -> None:
    for path in generated_public_files(root):
        text = path.read_text(encoding="utf-8", errors="ignore")
        lower = text.lower()
        for pattern in OLD_THEME_PATTERNS:
            if pattern.lower() in lower:
                errors.append(f"{path.relative_to(root)} contains stale reference {pattern}")
        for pattern in OBSOLETE_TEXT_PATTERNS:
            if re.search(pattern, text, flags=re.IGNORECASE):
                errors.append(f"{path.relative_to(root)} contains obsolete public reference matching {pattern}")


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
    check_no_obsolete_public_artifacts(root, errors)
    check_content_model(root, errors)
    check_curated_pages(root, errors)
    check_resource_directory(root, errors)
    check_navigation(root, errors)
    check_canonical_outputs(root, errors)
    check_stale_references(root, errors)
    check_template_external_urls(root, errors)

    if errors:
        print("Site contract check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Site contract passed: resource hub, accessible navigation, verified links, canonical URLs, and dark/red public theme.")
    return 0


if __name__ == "__main__":
    raise SystemExit(check_site_contract(PROJECT_ROOT))
