#!/usr/bin/env python3
"""Check the built public projection, independently of the route generator.

This is disk evidence, never HTTP or Google indexing evidence. Optional CSV
output records the policy for every generated HTML URL, including exclusions.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree as ET

from site_paths import site_paths


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonicals: list[str] = []
        self.alternates: dict[str, str] = {}
        self.duplicate_languages: list[str] = []
        self.robots: list[str] = []
        self.anchors: list[str] = []
        self.refresh: list[str] = []
        self.lang = ""
        self.stub = False
        self.h1 = 0
        self.in_h1 = False
        self.h1_text = ""
        self.missing_alt = 0
        self.title = ""
        self.description = ""
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang") or ""
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.h1 += 1
            self.in_h1 = True
        if tag == "img" and "alt" not in a:
            self.missing_alt += 1
        self.stub |= a.get("data-redirect-stub") == "true"
        if tag == "a" and a.get("href"):
            self.anchors.append(a["href"])
        if tag == "link":
            rel = (a.get("rel") or "").lower().split()
            if "canonical" in rel:
                self.canonicals.append(a.get("href") or "")
            if "alternate" in rel and a.get("hreflang"):
                language = a["hreflang"]
                if language in self.alternates:
                    self.duplicate_languages.append(language)
                self.alternates[language] = a.get("href") or ""
        if tag == "meta":
            name = (a.get("name") or "").lower()
            if name in {"robots", "googlebot"}:
                self.robots.append(a.get("content") or "")
            if name == "description":
                self.description = a.get("content") or ""
            if (a.get("http-equiv") or "").lower() == "refresh":
                self.refresh.append(a.get("content") or "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        if tag == "h1":
            self.in_h1 = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data
        if self.in_h1:
            self.h1_text += data

    @property
    def noindex(self) -> bool:
        tokens = {token for value in self.robots for token in re.split(r"[\s,]+", value.lower())}
        return bool(tokens & {"noindex", "none"})


@dataclass
class Audit:
    pages: dict[str, Page] = field(default_factory=dict)
    files: dict[str, str] = field(default_factory=dict)
    dispositions: dict[str, str] = field(default_factory=dict)
    referring: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))
    sitemap: set[str] = field(default_factory=set)
    robots: RobotFileParser = field(default_factory=RobotFileParser)
    errors: list[str] = field(default_factory=list)
    warnings: Counter = field(default_factory=Counter)


def page_url(relative: str, base: str) -> str:
    route = relative.removesuffix("index.html") if relative.endswith("index.html") else relative
    return urljoin(base, route)


def audit(root: Path) -> Audit:
    result = Audit()
    base = json.loads((root / "src/content/site.json").read_text())["baseUrl"]
    locales = json.loads((root / "src/i18n/locales.json").read_text())
    codes = {entry["code"] for entry in locales["locales"]}
    default = locales["defaultLocale"]
    result.robots.parse((root / "robots.txt").read_text().splitlines())
    # The walk retains original filename case even on case-insensitive APFS.
    paths = [
        p
        for p in site_paths(root, {".git", ".cache", "node_modules", "src", "scripts", "docs", "graft", ".graft"})
        if p.is_file()
    ]
    exact_files = {p.relative_to(root).as_posix() for p in paths}
    for path in paths:
        if path.suffix != ".html":
            continue
        relative = path.relative_to(root).as_posix()
        url = page_url(relative, base)
        page = Page()
        page.feed(path.read_text(encoding="utf-8"))
        result.pages[url] = page
        result.files[url] = relative
    for url, page in result.pages.items():
        relative = result.files[url]
        parts = relative.split("/")
        localized = parts[0] in codes - {default}
        route = "/".join(parts[1:] if localized else parts)
        simulation = relative.startswith("simulations/") and not relative.endswith("/index.html")
        canonical = page.canonicals[0] if len(page.canonicals) == 1 else ""
        if page.stub:
            disposition = "retain-html-redirect; HTTP-permanent-redirect-pending-edge"
            if not page.noindex or len(page.refresh) != 1:
                result.errors.append(f"{relative}: redirect must have noindex and one refresh")
        elif relative == "404.html":
            disposition = "retain-honest-error"
            if not page.noindex:
                result.errors.append("404.html: error page must be noindex")
        elif route in {"search/index.html", "sitemap/index.html"}:
            disposition = "retain-utility-noindex"
            if not page.noindex:
                result.errors.append(f"{relative}: utility exclusion lost noindex")
        elif simulation:
            disposition = "retain-shared-English-simulation"
        elif localized and (route.startswith("newsletter/") or route.startswith("video/")) and canonical != url:
            disposition = "consolidate-untranslated-archive"
            if canonical != page_url(route, base):
                result.errors.append(f"{relative}: untranslated archive has wrong English canonical")
        else:
            disposition = "index-public-canonical"
            if page.noindex or canonical != url:
                result.errors.append(f"{relative}: public page must be indexable and self-canonical")
        result.dispositions[url] = disposition
        if disposition == "index-public-canonical" and page.h1_text.strip().lower() in {
            "404",
            "page not found",
            "not found",
            "page moved",
        }:
            result.errors.append(f"{relative}: indexable route contains an error/redirect shell")
        if not simulation and len(page.canonicals) != 1:
            result.errors.append(f"{relative}: expected exactly one canonical")
        if not simulation and (not page.lang or page.lang not in codes):
            result.errors.append(f"{relative}: missing or unsupported document language")
        if not simulation and page.lang != (parts[0] if localized else default):
            result.errors.append(f"{relative}: language does not match route locale")
        if page.duplicate_languages:
            result.errors.append(f"{relative}: duplicate hreflang declarations")
        if not simulation and page.h1 != 1:
            result.errors.append(f"{relative}: expected one h1, found {page.h1}")
        if not page.title.strip():
            result.warnings["missing-title"] += 1
        if not page.description:
            result.warnings["missing-description"] += 1
        result.warnings["images-without-alt"] += page.missing_alt
        for href in page.anchors:
            target = urljoin(url, href).split("#", 1)[0].split("?", 1)[0]
            if urlsplit(target).netloc != urlsplit(base).netloc:
                continue
            result.referring[target].add(url)
            file = unquote(urlsplit(target).path.removeprefix(urlsplit(base).path))
            if not file or file.endswith("/"):
                file += "index.html"
            if file not in exact_files:
                result.errors.append(f"{relative}: missing or incorrectly cased internal anchor {href}")
    for url, page in result.pages.items():
        relative = result.files[url]
        canonical = page.canonicals[0] if len(page.canonicals) == 1 else ""
        target = result.pages.get(canonical)
        utility_self = result.dispositions[url] == "retain-utility-noindex" and canonical == url
        if (
            canonical
            and relative != "404.html"
            and not utility_self
            and (not target or target.stub or target.noindex or not result.robots.can_fetch("Googlebot", canonical))
        ):
            result.errors.append(
                f"{relative}: canonical target missing, redirected, noindex or robots-blocked: {canonical}"
            )
        if result.dispositions[url] == "index-public-canonical" and not result.robots.can_fetch("Googlebot", url):
            result.errors.append(f"{relative}: public canonical blocked by robots")
        if page.alternates and (page.noindex or page.stub or canonical != url):
            result.errors.append(f"{relative}: excluded/duplicate page advertises hreflang")
        for language, href in page.alternates.items():
            other = result.pages.get(href)
            if (
                not other
                or other.stub
                or other.noindex
                or other.canonicals != [href]
                or not result.robots.can_fetch("Googlebot", href)
            ):
                result.errors.append(f"{relative}: hreflang target not indexable: {language} {href}")
            elif other.alternates != page.alternates:
                result.errors.append(f"{relative}: nonreciprocal hreflang cluster: {href}")
            if language != "x-default" and other and language != other.lang:
                result.errors.append(f"{relative}: hreflang language differs from target lang: {href}")
        if page.alternates and page.alternates.get(page.lang) != url:
            result.errors.append(f"{relative}: hreflang cluster omits self")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
    tree = ET.parse(root / "sitemap.xml").getroot()
    if tree.tag != f"{{{ns['s']}}}urlset":
        result.errors.append("sitemap: invalid namespace or root")
    entries = tree.findall("s:url", ns)
    advertised = set()
    if len(entries) > 50000 or (root / "sitemap.xml").stat().st_size > 52428800:
        result.errors.append("sitemap: protocol size limit exceeded")
    for entry in entries:
        if len(entry.findall("s:loc", ns)) != 1:
            result.errors.append("sitemap: every entry must have exactly one loc")
        loc = entry.findtext("s:loc", namespaces=ns) or ""
        if loc in result.sitemap:
            result.errors.append(f"sitemap: duplicate loc {loc}")
        result.sitemap.add(loc)
        advertised.add(loc)
        page = result.pages.get(loc)
        if (
            not page
            or page.noindex
            or page.stub
            or page.canonicals != [loc]
            or not result.robots.can_fetch("Googlebot", loc)
        ):
            result.errors.append(f"sitemap: loc is not an indexable canonical: {loc}")
        alternates = {e.get("hreflang"): e.get("href") for e in entry.findall("x:link", ns)}
        if len(alternates) != len(entry.findall("x:link", ns)):
            result.errors.append(f"sitemap: duplicate language alternate: {loc}")
        advertised.update(alternates.values())
        if alternates and page and alternates != page.alternates:
            result.errors.append(f"sitemap: alternates disagree with page head: {loc}")
        lastmod = entry.findtext("s:lastmod", namespaces=ns)
        if lastmod:
            try:
                if date.fromisoformat(lastmod) > date.today():
                    result.errors.append(f"sitemap: future lastmod {loc}")
            except ValueError:
                result.errors.append(f"sitemap: invalid lastmod {loc}")
    for url, disposition in result.dispositions.items():
        if disposition == "index-public-canonical" and url not in advertised:
            result.errors.append(f"sitemap: canonical omitted from both loc and alternates: {url}")
    return result


def write_inventory(result: Audit, destination: Path) -> None:
    fields = [
        "URL",
        "source",
        "GSC reason",
        "last crawl",
        "live status",
        "redirect hops/final URL",
        "canonical",
        "Google-selected canonical",
        "robots result",
        "meta robots",
        "X-Robots-Tag",
        "sitemap membership",
        "hreflang",
        "referring internal URLs",
        "locale",
        "template",
        "intended disposition",
        "proposed target",
        "owner",
        "priority",
        "evidence",
        "test",
        "resolution",
    ]
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fields)
        writer.writeheader()
        for url, page in sorted(result.pages.items()):
            canonical = page.canonicals[0] if len(page.canonicals) == 1 else ""
            writer.writerow(
                dict(
                    zip(
                        fields,
                        [
                            url,
                            "generated public output",
                            "not exported",
                            "unavailable",
                            "untested; disk only",
                            "HTML refresh: " + ";".join(page.refresh) if page.refresh else "HTTP untested",
                            canonical,
                            "unavailable",
                            "allow" if result.robots.can_fetch("Googlebot", url) else "block",
                            ";".join(page.robots),
                            "HTTP untested",
                            url in result.sitemap,
                            json.dumps(page.alternates),
                            ";".join(sorted(result.referring[url])),
                            page.lang,
                            result.files[url],
                            result.dispositions[url],
                            canonical,
                            "website",
                            "P1" if page.stub else "P2",
                            "built HTML/robots/sitemap",
                            "check:indexability",
                            "local evidence; release/Google pending",
                        ],
                    )
                )
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--inventory", type=Path)
    parser.add_argument("--summary", type=Path)
    args = parser.parse_args()
    result = audit(args.root)
    if args.inventory:
        write_inventory(result, args.inventory)
    summary = {
        "pages": len(result.pages),
        "sitemap_urls": len(result.sitemap),
        "dispositions": dict(Counter(result.dispositions.values())),
        "warnings": dict(result.warnings),
        "errors": result.errors,
        "evidence_scope": "generated files; no HTTP or Search Console claims",
    }
    if args.summary:
        args.summary.parent.mkdir(parents=True, exist_ok=True)
        args.summary.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({**summary, "errors": result.errors[:30]}, indent=2))
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
