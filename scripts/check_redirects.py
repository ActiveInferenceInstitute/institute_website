#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from site_paths import site_paths

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class RedirectParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = []
        self.refresh = []
        self.robots = []
        self.anchors = []
        self.stub = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.stub |= attrs.get("data-redirect-stub") == "true"
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href"))
        if tag == "meta":
            if attrs.get("http-equiv", "").lower() == "refresh":
                self.refresh.append(attrs.get("content"))
            if attrs.get("name") == "robots":
                self.robots.append(attrs.get("content", ""))
        if tag == "a":
            self.anchors.append(attrs.get("href", ""))


def parse(path):
    parser = RedirectParser()
    parser.feed(path.read_text())
    return parser


def expected_redirects(root):
    taxonomy = json.loads((root / "src/url-taxonomy.json").read_text())
    redirects = taxonomy["redirects"]
    locales = json.loads((root / "src/i18n/locales.json").read_text())
    codes = [locale["code"] for locale in locales["locales"]]
    default = locales["defaultLocale"]
    slugs = [json.loads(path.read_text())["slug"] for path in (root / "src/content/pages").rglob("*.json")]
    expected = {}
    routing = taxonomy["routing"]["rules"]
    for code in codes:
        prefix = "" if code == default else f"{code}/"
        for source, target in redirects["map"].items():
            if source != target.rstrip("/"):
                expected[f"{prefix}{source}/index.html"] = prefix + target
        for rule in redirects["prefix"]:
            if not any(r["type"] == "prefix" and r["match"] == rule["from"] and r["dir"] == rule["to"] for r in routing):
                raise ValueError(f"prefix redirect disagrees with routing: {rule}")
            for slug in slugs:
                if slug.startswith(rule["from"]):
                    expected[f"{prefix}{slug}/index.html"] = f'{prefix}{rule["to"]}{slug[len(rule["from"]):]}/'
        for rule in redirects["set"]:
            if not any(r["type"] == "set" and rule["from"] in taxonomy[r["match"]] and rule["to"] == f'{r["dir"]}{rule["from"]}/' for r in routing):
                raise ValueError(f"set redirect disagrees with routing: {rule}")
            expected[f'{prefix}{rule["from"]}/index.html'] = prefix + rule["to"]
        if prefix:
            for file in (root / "simulations").glob("*.html"):
                if file.name != "index.html":
                    expected[f"{prefix}simulations/{file.name}"] = f"simulations/{file.name}"
    return expected, redirects


def check_redirects(root):
    errors = []
    expected, rules = expected_redirects(root)
    manifest = json.loads((root / "data/redirects.json").read_text())
    recorded = {entry["file"]: entry["to"] for entry in manifest}
    if recorded != expected or len(recorded) != len(manifest):
        errors.append("redirect manifest differs from source-derived legacy paths")
    base = json.loads((root / "src/content/site.json").read_text())["baseUrl"]
    for file, target in expected.items():
        path = root / file
        destination = root / (target if target.endswith(".html") else target + "index.html")
        if not destination.is_file() or parse(destination).stub:
            errors.append(f"{file}: destination is missing or another redirect: {target}")
        if not path.is_file():
            errors.append(f"{file}: missing static redirect stub")
            continue
        info = parse(path)
        if not info.stub:
            errors.append(f"{file}: legacy path contains a real page instead of a stub")
        if info.canonical != [base + target]:
            errors.append(f"{file}: incorrect redirect canonical")
        href = urlparse(base).path + target
        if info.refresh != [f"0; url={href}"] or href not in info.anchors:
            errors.append(f"{file}: incorrect refresh or missing fallback link")
        if not any("noindex" in value for value in info.robots):
            errors.append(f"{file}: redirect stub must be noindex")
    text = (root / "assets/js/redirects.js").read_text()
    runtime_map = dict(rules["map"])
    for file, target in expected.items():
        source = file.removesuffix("/index.html")
        runtime_map[re.sub(r"\.html?$", "", source, flags=re.I).lower()] = target
    for name, value in [("MAP", runtime_map), ("PREFIX_REDIRECTS", rules["prefix"]), ("SET_REDIRECTS", rules["set"])]:
        match = re.search(rf"var {name} = (.+);", text)
        if not match or json.loads(match[1]) != value:
            errors.append(f"generated {name} differs from taxonomy")
    forwards = json.loads((root / "src/content/inbound-forwards.json").read_text())["forwards"]
    for host, target in forwards.items():
        page = root / target.lstrip("/") / "index.html"
        if not page.is_file() or parse(page).canonical != [base.rstrip("/") + target] or parse(page).stub:
            errors.append(f"{host}: pinned forwarding target must remain a real self-canonical page: {target}")
    forward_hosts = {f"{host}.activeinference.institute" for host in forwards}
    for path in site_paths(root, {".git", ".cache", "node_modules", "src", "scripts"}):
        if path.name != "index.html":
            continue
        if any(part in {".git", "node_modules", "src", "scripts"} for part in path.relative_to(root).parts):
            continue
        for href in parse(path).anchors:
            url = urlparse(href)
            if url.hostname in forward_hosts:
                errors.append(f"{path.relative_to(root)}: on-site forwarding shortlink must render an internal URL: {href}")
    rows = "\n".join(f"| `{host}` | `{target}` |" for host, target in sorted(forwards.items()))
    doc = (root / "docs/MIGRATION_AND_REDIRECTS.md").read_text()
    block = "<!-- inbound-forwards:start -->\n| Subdomain | On-site destination |\n|---|---|\n" + rows + "\n<!-- inbound-forwards:end -->"
    if block not in doc:
        errors.append("inbound-forward documentation table differs from registry")
    return errors


def main():
    try:
        errors = check_redirects(PROJECT_ROOT)
    except (OSError, ValueError, KeyError) as exc:
        errors = [str(exc)]
    if errors:
        print("Redirect check failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Redirect check passed: source-derived stubs, runtime parity, inbound targets and internal links.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
