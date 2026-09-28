#!/usr/bin/env python3
"""Check the generated feeds and crawler outputs against the site contract.

Covers the machine-readable outputs that no other gate fully gates:

- ``feed.xml`` (RSS 2.0) and ``feed.json`` (JSON Feed 1.1), which previously had
  zero format gating. Validates XML/JSON parseability, item structure (fields
  the writer in ``src/feeds.mjs`` emits), date formats exactly as emitted
  (RFC-822 ``toUTCString()`` / ISO-8601 ``toISOString()``), guid/id uniqueness,
  and that every link target resolves to an existing generated file — including
  ``#fragment`` anchors (the knowledge ``#publication-<id>`` entries).
- ``sitemap.xml`` target existence: the site-contract gate
  (``check_site_contract.py``) owns the <loc> set-equality vs the routed page
  set; this gate additionally resolves every <loc> and every
  ``<xhtml:link rel="alternate">`` hreflang href to an existing generated file.

Exit code 0 on pass, 1 with ``- ``-prefixed errors on stderr, matching the
other Python gates (``check_internal_links.py``, ``check_site_contract.py``).
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Canonical origin+base, read from site.json (single source of truth), mirroring
# check_site_contract.py's _canonical_base().
_canonical_base = json.loads((PROJECT_ROOT / "src" / "content" / "site.json").read_text(encoding="utf-8"))["baseUrl"]
CANONICAL_BASE = _canonical_base if _canonical_base.endswith("/") else _canonical_base + "/"

# Date shapes exactly as the writer emits them: RSS uses Date.prototype
# toUTCString() ("Mon, 31 Aug 2026 00:00:00 GMT"), JSON Feed uses
# Date.prototype.toISOString() ("2026-08-31T00:00:00.000Z").
RFC_822_RE = re.compile(r"^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$")
ISO_8601_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")

JSON_FEED_VERSION = "https://jsonfeed.org/version/1.1"
# Top-level + per-item fields the writer in src/feeds.mjs emits for feed.json.
JSON_FEED_REQUIRED_FIELDS = ("version", "title", "home_page_url", "feed_url", "description", "language", "items")
JSON_FEED_ITEM_FIELDS = ("id", "title", "content_text", "date_published", "url", "tags")
# Per-<item> fields the writer emits for feed.xml.
RSS_ITEM_FIELDS = ("title", "link", "guid", "pubDate")


class FragmentParser(HTMLParser):
    """Collect declared fragment targets (id=""/name="") from a document."""

    def __init__(self) -> None:
        super().__init__()
        self.fragments: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in ("id", "name") and value:
                self.fragments.add(value)


_fragment_cache: dict[Path, set[str]] = {}


def fragments_for(path: Path) -> set[str]:
    cached = _fragment_cache.get(path)
    if cached is None:
        parser = FragmentParser()
        parser.feed(path.read_text(encoding="utf-8"))
        cached = parser.fragments
        _fragment_cache[path] = cached
    return cached


def canonical_target(root: Path, url: str) -> tuple[Path, str] | None:
    """Map a canonical absolute URL to (generated file, decoded fragment).

    Returns None when the URL is not on the canonical origin — callers decide
    whether that is an error (feed links must be canonical; sitemap locs are
    pre-filtered to the canonical base by the site-contract gate).
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    if not url.startswith(CANONICAL_BASE):
        return None
    path = unquote(parsed.path).lstrip("/")
    if not path or path.endswith("/"):
        path += "index.html"
    return root / path, unquote(parsed.fragment)


def check_target(root: Path, source: str, url: str, errors: list[str]) -> None:
    """One <link>/href target must resolve to a generated file + real anchor."""
    resolved = canonical_target(root, url)
    if resolved is None:
        errors.append(f"{source} link {url!r} is not on the canonical base {CANONICAL_BASE}")
        return
    target, fragment = resolved
    if not target.is_file():
        errors.append(f"{source} link {url!r} references missing output {target.relative_to(root)}")
        return
    if fragment and fragment not in fragments_for(target):
        errors.append(
            f"{source} link {url!r} references missing anchor "
            f"{target.relative_to(root)}#{fragment}"
        )


def _text(element: ET.Element, tag: str) -> str:
    child = element.find(tag)
    return (child.text or "").strip() if child is not None else ""


def check_feed_xml(root: Path, errors: list[str]) -> int:
    """Parse feed.xml, validate RSS structure, dates, guid uniqueness, links."""
    path = root / "feed.xml"
    if not path.is_file():
        errors.append("feed.xml is missing (run the build)")
        return 0
    try:
        channel = ET.parse(path).getroot().find("channel")
    except ET.ParseError as exc:
        errors.append(f"feed.xml is not valid XML: {exc}")
        return 0
    if channel is None:
        errors.append("feed.xml has no <channel> element")
        return 0

    for field in ("title", "link", "description", "language"):
        if not _text(channel, field):
            errors.append(f"feed.xml channel is missing required <{field}>")
    link = _text(channel, "link")
    if link:
        check_target(root, "feed.xml channel", link, errors)

    items = channel.findall("item")
    seen_guids: set[str] = set()
    for index, item in enumerate(items):
        source = f"feed.xml item #{index + 1}"
        for field in RSS_ITEM_FIELDS:
            if not _text(item, field):
                errors.append(f"{source} is missing required <{field}>")
        guid = _text(item, "guid")
        if guid:
            if guid in seen_guids:
                errors.append(f"{source} repeats guid {guid!r}")
            seen_guids.add(guid)
        pub_date = _text(item, "pubDate")
        if pub_date:
            if not RFC_822_RE.match(pub_date):
                errors.append(
                    f"{source} pubDate {pub_date!r} is not the RFC-822 shape the build emits "
                    "(e.g. 'Mon, 31 Aug 2026 00:00:00 GMT')"
                )
            elif parsedate_to_datetime(pub_date) is None:
                errors.append(f"{source} pubDate {pub_date!r} does not parse as RFC-822")
        item_link = _text(item, "link")
        if item_link:
            check_target(root, source, item_link, errors)
    return len(items)


def check_feed_json(root: Path, errors: list[str]) -> int:
    """Parse feed.json, validate JSON Feed structure, dates, id uniqueness, links."""
    path = root / "feed.json"
    if not path.is_file():
        errors.append("feed.json is missing (run the build)")
        return 0
    try:
        feed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"feed.json is not valid JSON: {exc}")
        return 0
    if not isinstance(feed, dict):
        errors.append("feed.json is not a JSON object")
        return 0

    for field in JSON_FEED_REQUIRED_FIELDS:
        if field not in feed:
            errors.append(f"feed.json is missing required field {field!r}")
    if feed.get("version") != JSON_FEED_VERSION:
        errors.append(f"feed.json version {feed.get('version')!r} is not {JSON_FEED_VERSION!r}")
    for field in ("home_page_url", "feed_url"):
        value = feed.get(field)
        if isinstance(value, str) and value:
            check_target(root, f"feed.json {field}", value, errors)

    items = feed.get("items")
    if not isinstance(items, list):
        errors.append("feed.json items is not an array")
        return 0
    seen_ids: set[str] = set()
    for index, item in enumerate(items):
        source = f"feed.json item #{index + 1}"
        if not isinstance(item, dict):
            errors.append(f"{source} is not a JSON object")
            continue
        for field in JSON_FEED_ITEM_FIELDS:
            if field not in item:
                errors.append(f"{source} is missing required field {field!r}")
        item_id = item.get("id")
        if isinstance(item_id, str) and item_id:
            if item_id in seen_ids:
                errors.append(f"{source} repeats id {item_id!r}")
            seen_ids.add(item_id)
        date_published = item.get("date_published")
        if isinstance(date_published, str) and date_published:
            if not ISO_8601_RE.match(date_published):
                errors.append(
                    f"{source} date_published {date_published!r} is not the ISO-8601 shape the build emits "
                    "(e.g. '2026-08-31T00:00:00.000Z')"
                )
            else:
                try:
                    datetime.strptime(date_published, "%Y-%m-%dT%H:%M:%S.%fZ")
                except ValueError:
                    errors.append(f"{source} date_published {date_published!r} does not parse as ISO-8601")
        item_url = item.get("url")
        if isinstance(item_url, str) and item_url:
            check_target(root, source, item_url, errors)
        if "tags" in item and not isinstance(item["tags"], list):
            errors.append(f"{source} tags is not an array")
    return len(items)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]



def check_sitemap_targets(root: Path, errors: list[str]) -> int:
    """Every sitemap <loc> and hreflang alternate href resolves to a real file.

    The <loc> set-equality against the routed page set lives in
    check_site_contract.py (check_canonical_outputs); this arm adds the
    target-existence half, including the hreflang alternates the build emits
    inside each <url> (src/build.mjs localeAlternatesFor).
    """
    path = root / "sitemap.xml"
    if not path.is_file():
        errors.append("sitemap.xml is missing (run the build)")
        return 0
    try:
        urlset = ET.parse(path).getroot()
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml is not valid XML: {exc}")
        return 0

    loc_count = 0
    for element in urlset.iter():
        name = _local_name(element.tag)
        if name == "loc":
            loc_count += 1
            loc = (element.text or "").strip()
            if loc.startswith(CANONICAL_BASE):
                check_target(root, "sitemap.xml <loc>", loc, errors)
        elif name == "link":
            hreflang = element.get("hreflang", "")
            href = (element.get("href") or "").strip()
            if element.get("rel") != "alternate" or not hreflang or not href:
                errors.append(
                    f"sitemap.xml <xhtml:link> missing rel=alternate/hreflang/href: "
                    f"rel={element.get('rel')!r} hreflang={hreflang!r}"
                )
                continue
            if href.startswith(CANONICAL_BASE):
                resolved = canonical_target(root, href)
                if resolved is not None and not resolved[0].is_file():
                    errors.append(
                        f"sitemap.xml hreflang {hreflang!r} href {href!r} references missing output "
                        f"{resolved[0].relative_to(root)}"
                    )
    return loc_count


def check_feeds(root: Path) -> int:
    errors: list[str] = []
    rss_items = check_feed_xml(root, errors)
    json_items = check_feed_json(root, errors)
    loc_count = check_sitemap_targets(root, errors)

    if errors:
        print("Feed/output contract check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Feeds passed: feed.xml ({rss_items} items), feed.json ({json_items} items), "
        f"sitemap.xml ({loc_count} urls) — structure, dates, id uniqueness, and output targets."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(check_feeds(PROJECT_ROOT))
