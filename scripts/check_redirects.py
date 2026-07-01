#!/usr/bin/env python3
"""Check that assets/js/redirects.js never points at a dead destination.

Three mechanisms live in redirects.js:

- MAP: one-off, English-only legacy Squarespace aliases (path -> path).
- PREFIX_REDIRECTS: locale-aware structural renames for "prefix" routing
  families (old slug-prefix -> new dir), e.g. active-inference-and-* ->
  active-inference/. Each entry must have a matching "prefix" rule in
  url-taxonomy.json, and the union of every matching page slug must resolve
  to a real built directory under the new prefix.
- SET_REDIRECTS: locale-aware structural renames for "set" routing families
  (old exact slug -> new dir + slug/), i.e. slugs with no shared string
  prefix that route via a named array in url-taxonomy.json (e.g.
  orgPageSlugs, yearPageSlugs). Each entry must reference a real array
  member and point at its rule's current dir -- but NOT every array member
  needs an entry: a "set" family only needs one when a slug's OWN live URL
  actually moved (e.g. programSubpageSlugs has always routed to
  programs/<slug>/ and never had a flat URL to redirect away from).

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


def load_redirects_js() -> tuple[dict[str, str], list[dict[str, str]], list[dict[str, str]]]:
    text = REDIRECTS_JS.read_text(encoding="utf-8")
    map_literal = _strip_line_comments(_extract_object_literal(text, "MAP", "{", "}"))
    prefix_literal = _strip_line_comments(_extract_object_literal(text, "PREFIX_REDIRECTS", "[", "]"))
    set_literal = _strip_line_comments(_extract_object_literal(text, "SET_REDIRECTS", "[", "]"))
    # All three literals are valid JSON once comments are stripped (double-quoted
    # keys/values, no trailing commas) -- redirects.js is hand-written to stay
    # JSON-loadable so this checker never needs a real JS parser.
    return json.loads(map_literal), json.loads(prefix_literal), json.loads(set_literal)


def load_taxonomy() -> dict:
    return json.loads(TAXONOMY_JSON.read_text(encoding="utf-8"))


def load_routing_rules(taxonomy: dict, rule_type: str) -> list[dict[str, str]]:
    return [rule for rule in taxonomy["routing"]["rules"] if rule["type"] == rule_type]


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


def check_set_redirects(set_redirects: list[dict[str, str]], set_rules: list[dict[str, str]], taxonomy: dict) -> list[str]:
    # Unlike PREFIX_REDIRECTS, SET_REDIRECTS is deliberately NOT required to
    # cover every member of every "set" rule's array -- programSubpageSlugs,
    # for example, has routed to programs/<slug>/ since before locales existed
    # and never had a flat, locale-covered live URL to migrate away from (its
    # old Squarespace-era aliases are English-only entries in MAP). A
    # SET_REDIRECTS entry is only needed when a specific slug's OWN output
    # directory actually changed underneath a live URL -- so this only
    # validates entries that exist, it never demands new ones.
    errors = []
    dir_by_array = {rule["match"]: rule["dir"] for rule in set_rules}
    members_by_array = {name: set(taxonomy.get(name, [])) for name in dir_by_array}
    all_members = {slug for members in members_by_array.values() for slug in members}

    for entry in set_redirects:
        slug, dest = entry["from"], entry["to"]

        # 1. The renamed slug must still be a real member of some "set" rule's
        #    array, or the taxonomy and the redirects have drifted apart.
        if slug not in all_members:
            errors.append(f"SET_REDIRECTS['{slug}'] has no matching 'set' rule member in url-taxonomy.json")
            continue

        # 2. The destination must match what that rule currently computes.
        owning_dir = next(d for name, d in dir_by_array.items() if slug in members_by_array[name])
        expected_to = f"{owning_dir}{slug}/"
        if dest != expected_to:
            errors.append(f"SET_REDIRECTS['{slug}'] = '{dest}' does not match expected '{expected_to}'")

        # 3. The new destination must resolve to a real built file.
        built = PROJECT_ROOT / dest.rstrip("/") / "index.html"
        if not built.is_file():
            errors.append(f"redirect target for '{slug}' has no built file at {built.relative_to(PROJECT_ROOT)}")

        # 4. The OLD flat directory must no longer exist (see check_prefix_redirects).
        stale = PROJECT_ROOT / slug / "index.html"
        if stale.is_file():
            errors.append(
                f"stale pre-migration directory still present: "
                f"{stale.relative_to(PROJECT_ROOT)} (must be git rm'd so the "
                f"old URL 404s and the redirect script fires)"
            )

    return errors


def main() -> int:
    map_entries, prefix_redirects, set_redirects = load_redirects_js()
    taxonomy = load_taxonomy()
    prefix_rules = load_routing_rules(taxonomy, "prefix")
    set_rules = load_routing_rules(taxonomy, "set")

    errors = (
        check_map(map_entries)
        + check_prefix_redirects(prefix_redirects, prefix_rules)
        + check_set_redirects(set_redirects, set_rules, taxonomy)
    )

    if errors:
        print("Redirect check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Redirect check passed: {len(map_entries)} MAP entries, "
        f"{len(prefix_redirects)} PREFIX_REDIRECTS rule(s), "
        f"{len(set_redirects)} SET_REDIRECTS rule(s) verified against "
        f"url-taxonomy.json and the current build."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
