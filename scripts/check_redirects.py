#!/usr/bin/env python3
"""Check that assets/js/redirects.js never points at a dead destination.

Two mechanisms live in redirects.js:

- MAP: one-off, English-only legacy Squarespace aliases (path -> path).
- PREFIX_REDIRECTS: locale-aware structural renames (old prefix -> new dir),
  applied whenever a routing family's output directory changes (see
  src/url-taxonomy.json). Each PREFIX_REDIRECTS entry must have a matching
  "prefix" rule in url-taxonomy.json's routing rules, and the union of every
  domain slug in that family must resolve to a real built directory under the
  new prefix.

This is deliberately a static consistency check, not a live crawl: it runs
against the current source + build output, with no network access.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REDIRECTS_JS = PROJECT_ROOT / "assets" / "js" / "redirects.js"
TAXONOMY_JSON = PROJECT_ROOT / "src" / "url-taxonomy.json"
PAGES_DIR = PROJECT_ROOT / "src" / "content" / "pages"


def _extract_object_literal(text: str, var_name: str, open_char: str, close_char: str) -> str:
    marker = f"var {var_name} = {open_char}"
    start = text.index(marker) + len(marker) - 1
    depth = 0
    for index in range(start, len(text)):
        if text[index] == open_char:
            depth += 1
        elif text[index] == close_char:
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    raise ValueError(f"unterminated {var_name} literal in {REDIRECTS_JS}")


def _strip_line_comments(literal: str) -> str:
    # MAP contains "// section" comment lines; strip them so the remaining
    # literal is plain JSON. No string value in either literal contains "//".
    return re.sub(r"//[^\n]*", "", literal)


def load_redirects_js() -> tuple[dict[str, str], list[dict[str, str]]]:
    text = REDIRECTS_JS.read_text(encoding="utf-8")
    map_literal = _strip_line_comments(_extract_object_literal(text, "MAP", "{", "}"))
    prefix_literal = _strip_line_comments(_extract_object_literal(text, "PREFIX_REDIRECTS", "[", "]"))
    # Both literals are valid JSON once comments are stripped (double-quoted
    # keys/values, no trailing commas) -- redirects.js is hand-written to stay
    # JSON-loadable so this checker never needs a real JS parser.
    return json.loads(map_literal), json.loads(prefix_literal)


def load_routing_rules() -> list[dict[str, str]]:
    taxonomy = json.loads(TAXONOMY_JSON.read_text(encoding="utf-8"))
    return [rule for rule in taxonomy["routing"]["rules"] if rule["type"] == "prefix"]


def all_page_slugs() -> set[str]:
    slugs = set()
    for path in PAGES_DIR.rglob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        slug = data.get("slug")
        if isinstance(slug, str):
            slugs.add(slug)
    return slugs


def check_map(map_entries: dict[str, str]) -> list[str]:
    errors = []
    for key, dest in map_entries.items():
        if dest == "" or re.match(r"^https?://", dest):
            continue  # home redirect ("") or external URL -- not locally checkable
        candidate = PROJECT_ROOT / dest / "index.html"
        if not candidate.is_file():
            errors.append(f"MAP['{key}'] -> '{dest}' has no built file at {candidate.relative_to(PROJECT_ROOT)}")
    return errors


def check_prefix_redirects(prefix_redirects: list[dict[str, str]], routing_rules: list[dict[str, str]]) -> list[str]:
    errors = []
    rule_by_match = {rule["match"]: rule["dir"] for rule in routing_rules}
    slugs = all_page_slugs()

    for entry in prefix_redirects:
        old_prefix, new_dir = entry["from"], entry["to"]

        # 1. The rename must be registered in url-taxonomy.json, or the JS
        #    build and the redirect script have silently drifted apart.
        if old_prefix not in rule_by_match:
            errors.append(
                f"PREFIX_REDIRECTS from='{old_prefix}' has no matching "
                f"'prefix' rule in url-taxonomy.json (routing and redirects "
                f"have drifted apart)"
            )
            continue
        if rule_by_match[old_prefix] != new_dir:
            errors.append(
                f"PREFIX_REDIRECTS to='{new_dir}' does not match "
                f"url-taxonomy.json's dir='{rule_by_match[old_prefix]}' for "
                f"prefix '{old_prefix}'"
            )

        # 2. Every slug that used to live flat under old_prefix must resolve
        #    to a real built directory under the new prefix (default locale).
        matching_slugs = [s for s in slugs if s.startswith(old_prefix)]
        if not matching_slugs:
            errors.append(f"PREFIX_REDIRECTS from='{old_prefix}' matches no page slugs -- rule may be dead")
        for slug in matching_slugs:
            rest = slug[len(old_prefix) :]
            built = PROJECT_ROOT / new_dir / rest / "index.html"
            if not built.is_file():
                errors.append(f"redirect target for slug '{slug}' has no built file at {built.relative_to(PROJECT_ROOT)}")

        # 3. The OLD flat directory must no longer exist as a build artifact --
        #    otherwise GitHub Pages serves the stale page directly and the
        #    404-triggered redirect script never runs.
        for slug in matching_slugs:
            stale = PROJECT_ROOT / slug / "index.html"
            if stale.is_file():
                errors.append(
                    f"stale pre-migration directory still present: "
                    f"{stale.relative_to(PROJECT_ROOT)} (must be git rm'd so the "
                    f"old URL 404s and the redirect script fires)"
                )
    return errors


def main() -> int:
    map_entries, prefix_redirects = load_redirects_js()
    routing_rules = load_routing_rules()

    errors = check_map(map_entries) + check_prefix_redirects(prefix_redirects, routing_rules)

    if errors:
        print("Redirect check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Redirect check passed: {len(map_entries)} MAP entries, "
        f"{len(prefix_redirects)} PREFIX_REDIRECTS rule(s) verified against "
        f"url-taxonomy.json and the current build."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
