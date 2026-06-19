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

# Clean-URL taxonomy mirror of src/build.mjs::urlDirForSlug. Maps a page slug to
# its output directory (no .html). The output file is always <dir>/index.html and
# the canonical/clean URL is /<dir>/ (root "" for the home page). 404 stays flat.
PROGRAM_SUBPAGE_SLUGS = {
    "fellowship",
    "internship",
    "mentorship",
    "partnership",
    "philanthropy",
}


def url_dir_for_slug(slug: str) -> str:
    if slug == "index":
        return ""
    if slug.startswith("project-"):
        return f"projects/{slug[len('project-'):]}"
    if slug in PROGRAM_SUBPAGE_SLUGS:
        return f"programs/{slug}"
    return slug


def output_path_for_slug(slug: str) -> str:
    directory = url_dir_for_slug(slug)
    return f"{directory}/index.html" if directory else "index.html"


def html_path_for_slug(root: Path, slug: str) -> Path:
    return root / output_path_for_slug(slug)


def rel_prefix(current_dir: str) -> str:
    depth = len([part for part in current_dir.split("/") if part])
    return "../" * depth


def dir_for_html_path(root: Path, html_path: Path) -> str:
    """The clean-URL dir of a generated HTML file (parent dir relative to root)."""
    relative = html_path.relative_to(root)
    parent = relative.parent
    return "" if str(parent) == "." else parent.as_posix()


def href_for_slug(target_slug: str, current_dir: str = "", anchor: str = "") -> str:
    """Caller-relative clean href from current_dir to target_slug (mirrors build.mjs)."""
    import posixpath

    target_dir = url_dir_for_slug(target_slug)
    rel = posixpath.relpath(target_dir or ".", current_dir or ".")
    if rel == ".":
        rel = "./"
    if not rel.endswith("/"):
        rel += "/"
    hash_part = ""
    if anchor:
        hash_part = anchor if anchor.startswith("#") else f"#{anchor}"
    return f"{rel}{hash_part}"
ALLOWED_TEMPLATE_EXTERNAL_URLS = {"http://www.sitemaps.org/schemas/sitemap/0.9"}
CURATED_SECTION_IDS = {
    "next-actions",
    "key-surfaces",
    "resources",
    "official-pages",
    "repositories",
    "related-pages",
}
RESOURCE_FILTER_IDS = {
    "resource-search",
    "resource-type",
    "resource-category",
    "resource-audience",
    "resource-tag",
    "resource-count",
    "repo-sort",
}
KNOWLEDGE_TABLE_IDS = {
    "people-table": "people",
    "projects-table": "projects",
    "ideas-table": "ideas",
    "ontology-table": "ontology",
    "research-table": "research",
}
KNOWLEDGE_FILTER_IDS = {
    "knowledge-search",
    "knowledge-kind",
    "knowledge-count",
}
PRIVATE_INSTITUTEOS_KEYS = {
    "contacts",
    "interactions",
    "address",
    "notes",
    "email",
    "phone",
    "slack",
    "primary_contact",
    "policyCount",
    "processCount",
    "activeTaskCount",
    "taskCount",
    "publicRoles",
    "organizationId",
    "organizationName",
    "roleGroup",
}
BLOCKED_GOVERNANCE_SOURCE_IDS = {
    "official-board",
    "official-officers",
    "official-scientific-advisory-board",
    "shortlink-bod",
    "shortlink-sab",
}
ALLOWED_INSTITUTEOS_ASSETS = {"ActInferServe.png", "Dark_ActInfServe.png"}
REQUIRED_SOURCE_IDS = {
    "official-activeinference-org",
    "start-docs",
    "ecosystem",
    "official-activities-shortlink",
    "official-intern",
    "official-measure",
    "official-projects-shortlink",
    "official-symposium-shortlink",
    "official-textbook-group-shortlink",
    "official-volunteer",
    "shortlink-2025",
    "shortlink-fellows",
    "shortlink-mentorship",
    "shortlink-obsidian",
    "shortlink-ontology",
    "shortlink-prepare",
    "shortlink-rxinfer",
    "shortlink-strategy",
    "shortlink-wave-hypothesis",
    "shortlink-welcome",
    "video",
    "weekly",
}
REQUIRED_AUDIENCE_PATHWAYS = {
    "newcomer",
    "learner",
    "researcher",
    "developer",
    "contributor",
    "partner-supporter",
}
RESOURCE_VIEW_IDS = {
    "resource-views",
    "featured",
    "official-pages",
    "official-shortlinks",
    "repositories-view",
    "learning-research",
    "participation-view",
    "full-directory",
}
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
SCAN_EXCLUDES = {".git", ".cache", "node_modules", "__pycache__", "scripts"}
SCAN_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".txt", ".xml"}


class HtmlInfo(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
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
        value = item.get("url")
        if value:
            urls.add(value)
            urls.add(value.rstrip("/"))
            urls.add(f"{value.rstrip('/')}/")
    return urls


def live_source_url_by_id(manifest: dict) -> dict[str, str]:
    return {
        item["id"]: item["url"]
        for item in manifest.get("sources", [])
        if item.get("ok") and item.get("id") and item.get("url")
    }


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


def live_manifest(root: Path) -> dict:
    return load_json(root / "src" / "content" / "live-sources.json")


def instituteos_data(root: Path) -> dict[str, dict]:
    base = root / "src" / "content" / "instituteos"
    return {
        "people": load_json(base / "people.json"),
        "projects": load_json(base / "projects.json"),
        "ideas": load_json(base / "ideas.json"),
        "ontology": load_json(base / "ontology.json"),
        "assets": load_json(base / "assets.json"),
    }


def research_resource_records(root: Path) -> list[dict]:
    resources = load_json(root / "src" / "content" / "resources.json").get("resources", [])
    live = {source["id"]: source for source in live_manifest(root).get("sources", [])}
    return [
        record
        for record in resources
        if record.get("promoted") is not False
        and (record.get("type") == "research" or record.get("category") == "research")
        and live.get(record.get("sourceId"), {}).get("ok")
    ]


def url_variants(url: str) -> set[str]:
    clean = url.rstrip("/")
    return {url, clean, f"{clean}/"}


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
    # Navigation items now reference clean-URL slugs (+ optional anchor), not flat
    # <slug>.html literals. Validate the required destination slugs are present.
    nav_slugs = {item.get("slug") for group in navigation for item in group.get("items", [])}
    for required_slug in {"directory", "resources", "projects", "get-involved"}:
        if required_slug not in nav_slugs:
            errors.append(f"navigation.json missing required destination {required_slug}")

    manifest = live_manifest(root)
    live_ids = [item["id"] for item in manifest.get("sources", [])]
    duplicate_ids = sorted({source_id for source_id in live_ids if live_ids.count(source_id) > 1})
    if duplicate_ids:
        errors.append(f"live-sources.json contains duplicate ids: {duplicate_ids}")
    live_id_set = set(live_ids)
    missing_required_sources = REQUIRED_SOURCE_IDS - live_id_set
    if missing_required_sources:
        errors.append(f"live-sources.json missing required official sources: {sorted(missing_required_sources)}")
    for source_id in REQUIRED_SOURCE_IDS & live_id_set:
        source = next(item for item in manifest.get("sources", []) if item["id"] == source_id)
        if not source.get("ok"):
            errors.append(f"required source {source_id} is not promoted as reachable")
    for source in manifest.get("sources", []):
        if source.get("ok") and "coda.io" in source.get("url", "").lower():
            errors.append(f"live-sources.json public url may not point directly to Coda: {source['id']}")
        if source.get("id") in BLOCKED_GOVERNANCE_SOURCE_IDS:
            errors.append(f"live-sources.json still contains blocked governance source id: {source.get('id')}")
        if source.get("category") == "Governance":
            errors.append(f"live-sources.json still promotes Governance category: {source.get('id')}")

    resources = load_json(root / "src" / "content" / "resources.json")
    official_pages = load_json(root / "src" / "content" / "official-pages.json")
    repositories = load_json(root / "src" / "content" / "repositories.json")
    audience_pathways = load_json(root / "src" / "content" / "audience-pathways.json")
    resource_categories = {item["id"] for item in resources.get("categories", [])}
    type_ids = {item["id"] for item in resources.get("types", [])}
    audience_ids = {item["id"] for item in resources.get("audiences", [])}

    if not resource_categories:
        errors.append("resources.json must define resource categories")
    if "governance" in resource_categories:
        errors.append("resources.json must not expose a governance category")
    if "governance" in audience_ids:
        errors.append("resources.json must not expose a governance audience")
    if not resources.get("resources"):
        errors.append("resources.json must define resource entries")
    if not official_pages.get("pages"):
        errors.append("official-pages.json must define official page entries")
    for path in (root / "src" / "content").glob("*.json"):
        if path.name == "live-sources.json":
            continue
        if "coda.io" in path.read_text(encoding="utf-8").lower():
            errors.append(f"{path.relative_to(root)} may not contain direct Coda URLs; use live-sources.json finalUrl only")
    shortlinks = [item for item in official_pages.get("pages", []) if item.get("shortlink") and item.get("promoted") is not False]
    if len(shortlinks) < 10:
        errors.append(f"official-pages.json expected at least 10 promoted non-governance official shortlinks, found {len(shortlinks)}")
    if len(repositories.get("repositories", [])) != 52:
        errors.append(f"repositories.json expected 52 public repositories, found {len(repositories.get('repositories', []))}")
    popular_tags = resources.get("popularTags", [])
    if len(popular_tags) > 18 or not {"active-inference", "learning", "research", "projects", "repository"}.issubset(popular_tags):
        errors.append("resources.json popularTags must stay short and include high-signal filter tags")
    pathway_ids = {item.get("id") for item in audience_pathways.get("pathways", [])}
    if pathway_ids != REQUIRED_AUDIENCE_PATHWAYS:
        errors.append(f"audience-pathways.json expected {sorted(REQUIRED_AUDIENCE_PATHWAYS)}, found {sorted(pathway_ids)}")
    for pathway in audience_pathways.get("pathways", []):
        if not pathway.get("primaryHref") or not pathway.get("links"):
            errors.append(f"audience pathway {pathway.get('id')} must define a destination and verified links")
        for source_id in collect_source_ids(pathway):
            if source_id not in live_id_set:
                errors.append(f"audience pathway {pathway.get('id')} references missing live source id: {source_id}")

    registry_sets = [
        ("resources.json", resources.get("resources", [])),
        ("official-pages.json", official_pages.get("pages", [])),
        ("repositories.json", repositories.get("repositories", [])),
    ]
    for label, records in registry_sets:
        for record in records:
            source_id = record.get("sourceId")
            if source_id in BLOCKED_GOVERNANCE_SOURCE_IDS:
                errors.append(f"{label} contains blocked governance source id: {source_id}")
            if record.get("category") == "governance" or record.get("audience") == "governance":
                errors.append(f"{label}:{source_id} exposes governance category/audience")
            if source_id not in live_id_set:
                errors.append(f"{label} references missing live source id: {source_id}")
            if record.get("category") not in resource_categories:
                errors.append(f"{label}:{source_id} has unknown category {record.get('category')}")
            if record.get("type") not in type_ids:
                errors.append(f"{label}:{source_id} has unknown type {record.get('type')}")
            if record.get("audience") not in audience_ids:
                errors.append(f"{label}:{source_id} has unknown audience {record.get('audience')}")
            for required in ("sourceId", "type", "category", "audience", "tags", "summary", "relatedSlugs", "priority", "promoted"):
                if required not in record:
                    errors.append(f"{label}:{source_id} missing stable field {required}")
            if label == "repositories.json":
                for required in ("projectFamily", "repoType", "docsUrl", "docsSourceId", "language", "stars", "updatedAt"):
                    if required not in record:
                        errors.append(f"repositories.json:{source_id} missing public project field {required}")

    for path in sorted((root / "src" / "content" / "pages").rglob("*.json")):
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
        if "governance" in page.get("resourceGroups", []):
            errors.append(f"{slug}: exposes governance resource group")
        for source_id in collect_source_ids(page):
            if source_id in BLOCKED_GOVERNANCE_SOURCE_IDS:
                errors.append(f"{slug}: references blocked governance source id {source_id}")
            if source_id not in live_id_set:
                errors.append(f"{slug}: references missing live source id: {source_id}")

    data = instituteos_data(root)
    expected_lengths = {
        "people": 8,
        "projects": 52,
        "ideas": 30,
    }
    for key, expected in expected_lengths.items():
        actual = len(data[key].get("records", []))
        if actual != expected:
            errors.append(f"src/content/instituteos/{key}.json expected {expected} records, found {actual}")
    if len(data["ontology"].get("trees", [])) != 2:
        errors.append("src/content/instituteos/ontology.json expected 2 trees")
    if len(data["ontology"].get("edges", [])) != 33:
        errors.append(f"src/content/instituteos/ontology.json expected 33 edges, found {len(data['ontology'].get('edges', []))}")

    for label, payload in data.items():
        serialized = json.dumps(payload, ensure_ascii=False).lower()
        for blocked in PRIVATE_INSTITUTEOS_KEYS:
            if f'"{blocked}"' in serialized:
                errors.append(f"src/content/instituteos/{label}.json contains private field {blocked}")
        for blocked_text in ("coda.io", "workspace", "source atlas", "source manifest", "aii.pdf", "dashboard screenshot"):
            if blocked_text in serialized:
                errors.append(f"src/content/instituteos/{label}.json contains blocked public term {blocked_text!r}")
        for blocked_text in ("governance links", "board of directors", "officers", "scientific advisory board"):
            if blocked_text in serialized:
                errors.append(f"src/content/instituteos/{label}.json contains internal governance surface {blocked_text!r}")

    asset_records = data["assets"].get("records", [])
    asset_filenames = {item.get("filename") for item in asset_records}
    if asset_filenames != ALLOWED_INSTITUTEOS_ASSETS:
        errors.append(f"assets.json must list only brand assets {sorted(ALLOWED_INSTITUTEOS_ASSETS)}, found {sorted(asset_filenames)}")
    asset_dir = root / "assets" / "img" / "instituteos"
    disk_assets = {path.name for path in asset_dir.glob("*") if path.is_file()}
    if disk_assets != ALLOWED_INSTITUTEOS_ASSETS:
        errors.append(f"assets/img/instituteos must contain only {sorted(ALLOWED_INSTITUTEOS_ASSETS)}, found {sorted(disk_assets)}")


def check_curated_pages(root: Path, errors: list[str]) -> None:
    pages_dir = root / "src" / "content" / "pages"
    pages = sorted(
        (load_json(path) for path in pages_dir.rglob("*.json")),
        key=lambda page: (page.get("order", 0), page.get("slug", "")),
    )
    allowed_live_urls = live_source_urls(live_manifest(root))

    for page in pages:
        slug = page["slug"]
        current_dir = url_dir_for_slug(slug)
        html_path = html_path_for_slug(root, slug)
        if not html_path.exists():
            errors.append(f"{slug}: generated HTML is missing at {output_path_for_slug(slug)}")
            continue

        html = html_path.read_text(encoding="utf-8")
        info = parse_html(html_path)
        hrefs = [href for href, _class_name in info.anchors]

        if "On this page" not in html:
            errors.append(f"{slug}: missing page-local guide label")
        if not {"#next-actions", "#resources", "#official-pages", "#repositories", "#related-pages"}.issubset(set(hrefs)):
            errors.append(f"{slug}: page guide does not link to next actions, resources, official pages, repositories, and related sections")
        missing_ids = CURATED_SECTION_IDS - info.ids
        if missing_ids:
            errors.append(f"{slug}: missing section ids {sorted(missing_ids)}")

        # Clean-URL hrefs for resources/directory are caller-relative from this page.
        resources_href = href_for_slug("resources", current_dir)
        directory_href = href_for_slug("directory", current_dir)
        next_actions = section_between(html, 'id="next-actions"', 'class="content-band"')
        if f'href="{resources_href}' not in next_actions or f'href="{directory_href}"' not in next_actions:
            errors.append(f"{slug}: best next actions must link to resources and directory")
        if not re.search(r'href="https?://', next_actions):
            errors.append(f"{slug}: best next actions lacks a verified external action")

        related_section = section_between(html, 'id="related-pages"', 'class="pager page-pager"')
        related_page_hrefs = {
            href_for_slug(other["slug"], current_dir) for other in pages if other["slug"] != slug
        }
        if not any(f'href="{href}"' in related_section for href in related_page_hrefs):
            errors.append(f"{slug}: related-pages section lacks a related internal page link")

        resources_section = section_between(html, 'id="resources"', 'id="official-pages"')
        if not re.search(r'href="https?://', resources_section):
            errors.append(f"{slug}: resources section lacks an external verified link")

        for section_id in ("official-pages", "repositories"):
            section = section_between(html, f'id="{section_id}"', 'id="related-pages"' if section_id == "repositories" else 'id="repositories"')
            if 'class="resource-card"' not in section and " resource-card" not in section:
                errors.append(f"{slug}: {section_id} section does not render resource cards")

        for href in hrefs:
            if not external_href(href) or internal_site_href(href):
                continue
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{slug}: external anchor is not represented in live-sources.json: {href}")


def check_resource_directory(root: Path, errors: list[str]) -> None:
    resources_html = html_path_for_slug(root, "resources")
    if not resources_html.exists():
        errors.append("resources/index.html is missing")
        return
    html = resources_html.read_text(encoding="utf-8")
    info = parse_html(resources_html)
    hrefs = {href for href, _class_name in info.anchors}
    missing_view_ids = RESOURCE_VIEW_IDS - info.ids
    if missing_view_ids:
        errors.append(f"resources.html missing resource view ids {sorted(missing_view_ids)}")
    missing_filter_ids = RESOURCE_FILTER_IDS - info.ids
    if missing_filter_ids:
        errors.append(f"resources.html missing filter ids {sorted(missing_filter_ids)}")
    count_attrs = [attrs for tag, attrs in info.start_tags if attrs.get("id") == "resource-count" and attrs.get("aria-live") == "polite"]
    if not count_attrs:
        errors.append("resources.html resource-count must announce updates with aria-live=polite")
    for required_attr in ("data-type", "data-category", "data-audience", "data-tags", "data-search"):
        if required_attr not in html:
            errors.append(f"resources.html missing resource filter attribute {required_attr}")
    if 'class="resource-card"' not in html and " resource-card" not in html:
        errors.append("resources.html does not render resource cards")
    for duplicate_badge in ("Community / Community", "Research / Research", "Learning / Learning", "Official page / Official page"):
        if duplicate_badge in html:
            errors.append(f"resources.html contains duplicate low-value badge {duplicate_badge!r}")
    if "data-tag-filter" not in html:
        errors.append("resources.html missing popular tag chip filters")
    if "data-repository-list" not in html or "data-repo-card" not in html:
        errors.append("resources.html missing repository sorting data attributes")

    resources_model = load_json(root / "src" / "content" / "resources.json")
    popular_tags = resources_model.get("popularTags", [])
    tag_select = section_between(html, '<select id="resource-tag">', "</select>")
    option_count = tag_select.count("<option")
    if option_count > len(popular_tags) + 1:
        errors.append("resources.html tag select should expose only popular tags plus the all-tags option")
    for tag in popular_tags:
        if f'data-tag-filter="{tag}"' not in html or f'<option value="{tag}">' not in tag_select:
            errors.append(f"resources.html missing popular tag filter {tag}")

    categories = resources_model.get("categories", [])
    missing = [category["id"] for category in categories if category["id"] not in info.ids]
    if missing:
        errors.append(f"resources.html missing category anchors {missing}")

    official_pages = load_json(root / "src" / "content" / "official-pages.json").get("pages", [])
    repositories = load_json(root / "src" / "content" / "repositories.json").get("repositories", [])
    source_urls = live_source_url_by_id(live_manifest(root))
    for item in official_pages:
        expected_url = source_urls.get(item.get("sourceId", ""))
        if item.get("promoted") is not False and (not expected_url or (expected_url not in hrefs and expected_url.rstrip("/") not in hrefs)):
            errors.append(f"resources.html missing official page {item.get('sourceId')}")
    for repo in repositories:
        if repo.get("promoted") is not False and repo.get("url") not in hrefs:
            errors.append(f"resources.html missing repository {repo.get('fullName', repo.get('name'))}")


def check_knowledge_page(root: Path, errors: list[str]) -> None:
    html_path = html_path_for_slug(root, "knowledge")
    current_dir = url_dir_for_slug("knowledge")
    if not html_path.exists():
        errors.append("knowledge/index.html is missing")
        return
    html = html_path.read_text(encoding="utf-8")
    info = parse_html(html_path)
    hrefs = {href for href, _class_name in info.anchors}
    data = instituteos_data(root)

    missing_table_ids = set(KNOWLEDGE_TABLE_IDS) - info.ids
    if missing_table_ids:
        errors.append(f"knowledge.html missing table section ids {sorted(missing_table_ids)}")
    missing_filter_ids = KNOWLEDGE_FILTER_IDS - info.ids
    if missing_filter_ids:
        errors.append(f"knowledge.html missing filter ids {sorted(missing_filter_ids)}")
    if 'id="knowledge-count"' not in html or 'aria-live="polite"' not in html:
        errors.append("knowledge.html knowledge-count must announce filter updates with aria-live=polite")
    if "Open Source Map" not in html:
        errors.append("knowledge.html must be visitor-labeled as Open Source Map")
    if html.count("<caption>") < 5:
        errors.append("knowledge.html must render captions for people, repositories, ideas, ontology, and research tables")
    if html.count("<thead>") < 5 or html.count('scope="row"') < 5:
        errors.append("knowledge.html tables must include table heads and row headers")
    for required in ("data-knowledge-row", "data-knowledge-kind", "data-knowledge-search"):
        if required not in html:
            errors.append(f"knowledge.html missing {required}")

    row_counts = {"people": 0, "projects": 0, "ideas": 0, "ontology": 0, "research": 0}
    for _tag, attrs in info.start_tags:
        kind = attrs.get("data-knowledge-kind")
        if kind in row_counts:
            row_counts[kind] += 1
    expected_counts = {
        "people": len(data["people"].get("records", [])),
        "projects": len(data["projects"].get("records", [])),
        "ideas": len(data["ideas"].get("records", [])),
        "ontology": len(data["ontology"].get("edges", [])),
        "research": len(research_resource_records(root)),
    }
    if row_counts != expected_counts:
        errors.append(f"knowledge.html row counts {row_counts} do not match sanitized registries {expected_counts}")

    expected_anchor_ids = [
        *(f"person-{re.sub(r'[^a-z0-9]+', '-', item['id'].lower()).strip('-')}" for item in data["people"].get("records", [])),
        *(f"project-{re.sub(r'[^a-z0-9]+', '-', item['id'].lower()).strip('-')}" for item in data["projects"].get("records", [])),
        *(f"idea-{re.sub(r'[^a-z0-9]+', '-', item['id'].lower()).strip('-')}" for item in data["ideas"].get("records", [])),
        *(f"ontology-{re.sub(r'[^a-z0-9]+', '-', item['id'].lower()).strip('-')}" for item in data["ontology"].get("edges", [])),
        *(f"research-{re.sub(r'[^a-z0-9]+', '-', item['sourceId'].lower()).strip('-')}" for item in research_resource_records(root)),
    ]
    for anchor_id in expected_anchor_ids:
        if anchor_id not in info.ids:
            errors.append(f"knowledge.html missing row anchor #{anchor_id}")
    required_signposts = {
        href_for_slug("resources", current_dir),
        href_for_slug("directory", current_dir, "open-source-map"),
        href_for_slug("projects", current_dir, "knowledge-preview"),
        href_for_slug("learning", current_dir, "knowledge-preview"),
    }
    for required_href in required_signposts:
        if required_href not in hrefs:
            errors.append(f"knowledge.html missing internal signpost {required_href}")


def check_directory_page(root: Path, errors: list[str]) -> None:
    directory_dir = url_dir_for_slug("directory")
    directory_html = html_path_for_slug(root, "directory")
    if not directory_html.exists():
        errors.append("directory/index.html is missing")
        return
    html = directory_html.read_text(encoding="utf-8")
    info = parse_html(directory_html)
    directory_hrefs = {href for href, _class_name in info.anchors}
    for required_id in ("site-pages", "resource-groups", "official-pages", "official-shortlinks", "repositories", "verified-links", "open-source-map"):
        if required_id not in info.ids:
            errors.append(f"directory.html missing {required_id}")

    # Every generated page must link to the directory and knowledge pages using a
    # caller-relative clean URL computed from that page's own output directory.
    for html_path in generated_html_files(root):
        page_dir = dir_for_html_path(root, html_path)
        if page_dir == directory_dir:
            continue
        hrefs = {href for href, _class_name in parse_html(html_path).anchors}
        directory_href = href_for_slug("directory", page_dir)
        if directory_href not in hrefs and not any(href.startswith(directory_href + "#") for href in hrefs):
            errors.append(f"{html_path.relative_to(root)} does not link to directory")
        if page_dir != url_dir_for_slug("knowledge"):
            knowledge_href = href_for_slug("knowledge", page_dir)
            if knowledge_href not in hrefs and not any(href.startswith(knowledge_href + "#") for href in hrefs):
                errors.append(f"{html_path.relative_to(root)} does not link to knowledge")

    pages = [load_json(path) for path in sorted((root / "src" / "content" / "pages").rglob("*.json"))]
    for page in pages:
        page_href = href_for_slug(page["slug"], directory_dir)
        if f'href="{page_href}"' not in html:
            errors.append(f"directory.html missing page {page['slug']}")
        for section in page.get("sections", []):
            anchor = re.sub(r"[^a-z0-9]+", "-", section["heading"].lower()).strip("-")
            section_href = href_for_slug(page["slug"], directory_dir, anchor)
            if f'href="{section_href}"' not in html:
                errors.append(f"directory.html missing section link {page['slug']}:{section['heading']}")

    official_pages = load_json(root / "src" / "content" / "official-pages.json").get("pages", [])
    repositories = load_json(root / "src" / "content" / "repositories.json").get("repositories", [])
    source_urls = live_source_url_by_id(live_manifest(root))
    for item in official_pages:
        expected_url = source_urls.get(item.get("sourceId", ""))
        if item.get("promoted") is not False and (not expected_url or (expected_url not in directory_hrefs and expected_url.rstrip("/") not in directory_hrefs)):
            errors.append(f"directory.html missing official page {item.get('sourceId')}")
    for repo in repositories:
        if repo.get("promoted") is not False and repo.get("url") not in directory_hrefs:
            errors.append(f"directory.html missing repository {repo.get('fullName', repo.get('name'))}")

    data = instituteos_data(root)

    def knowledge_row_href(prefix: str, key: str) -> str:
        anchor = f"{prefix}-{re.sub(r'[^a-z0-9]+', '-', key.lower()).strip('-')}"
        return href_for_slug("knowledge", directory_dir, anchor)

    expected_row_links = [
        *(knowledge_row_href("person", item["id"]) for item in data["people"].get("records", [])),
        *(knowledge_row_href("project", item["id"]) for item in data["projects"].get("records", [])),
        *(knowledge_row_href("idea", item["id"]) for item in data["ideas"].get("records", [])),
        *(knowledge_row_href("ontology", item["id"]) for item in data["ontology"].get("edges", [])),
        *(knowledge_row_href("research", item["sourceId"]) for item in research_resource_records(root)),
    ]
    for href in expected_row_links:
        if f'href="{href}"' not in html:
            errors.append(f"directory.html missing Open Source Map row link {href}")


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
    if f"<loc>{CANONICAL_BASE}directory/</loc>" not in sitemap:
        errors.append("sitemap.xml does not include the directory clean URL")
    if f"<loc>{CANONICAL_BASE}knowledge/</loc>" not in sitemap:
        errors.append("sitemap.xml does not include the knowledge clean URL")
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


def check_external_anchors(root: Path, errors: list[str]) -> None:
    allowed_live_urls = live_source_urls(live_manifest(root))
    for html_path in generated_html_files(root):
        for href, _class_name in parse_html(html_path).anchors:
            if href.startswith("mailto:") or not external_href(href) or internal_site_href(href):
                continue
            if href not in allowed_live_urls and href.rstrip("/") not in allowed_live_urls:
                errors.append(f"{html_path.relative_to(root)} external anchor is not in live-sources.json: {href}")


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


def check_no_public_coda_links(root: Path, errors: list[str]) -> None:
    public_paths = [
        *generated_html_files(root),
        root / "assets" / "css" / "styles.css",
        root / "assets" / "js" / "site.js",
        root / "robots.txt",
        root / "sitemap.xml",
        root / "README.md",
        root / "AGENTS.md",
    ]
    for path in public_paths:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        lower = text.lower()
        if "https://coda.io" in lower or "http://coda.io" in lower:
            errors.append(f"{path.relative_to(root)} contains a direct Coda URL")
        if path.suffix == ".html":
            if "coda.io" in lower or "coda " in lower or "workspace" in lower:
                errors.append(f"{path.relative_to(root)} contains visible Coda/workspace wording")


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


def check_version(root: Path, errors: list[str]) -> None:
    version_path = root / "version.json"
    if not version_path.exists():
        errors.append("version.json is missing (run the build)")
        return
    try:
        version = json.loads(version_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"version.json is not valid JSON: {exc}")
        return
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    if version.get("site_version") != package.get("version"):
        errors.append(
            f"version.json site_version {version.get('site_version')!r} does not match "
            f"package.json version {package.get('version')!r}"
        )


def check_site_contract(root: Path) -> int:
    errors: list[str] = []
    check_version(root, errors)
    check_no_obsolete_public_artifacts(root, errors)
    check_content_model(root, errors)
    check_curated_pages(root, errors)
    check_resource_directory(root, errors)
    check_knowledge_page(root, errors)
    check_directory_page(root, errors)
    check_navigation(root, errors)
    check_canonical_outputs(root, errors)
    check_external_anchors(root, errors)
    check_stale_references(root, errors)
    check_no_public_coda_links(root, errors)
    check_template_external_urls(root, errors)

    if errors:
        print("Site contract check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "Site contract passed: Open Source Map, audience pathways, resource views, official shortlinks, repositories, verified links, canonical URLs, and dark/red theme."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(check_site_contract(PROJECT_ROOT))
