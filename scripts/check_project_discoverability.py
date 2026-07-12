#!/usr/bin/env python3
"""Check that InstituteOS backend projects and website project pages stay linked.

data/projects.json (the InstituteOS export) and src/content/pages/projects/*.json
(the hand-authored website pages) are two independently-edited surfaces joined by
one field: a backend project's `website_slug`. Nothing enforced that link stays
correct, so it silently drifted: 6 backend projects with real, working website
pages had no `website_slug` at all, making them invisible to
src/pages/projects.mjs's related-projects cross-linking (which filters strictly
on a truthy `website_slug`) even though their pages worked fine standalone.

This gate is deliberately advisory-only for "project has no website page" (many
backend projects — internal working groups, generic program descriptions — are
legitimately data-only and never need a dedicated page) but HARD-fails on the
two mistakes that are never correct:
  1. website_slug set but the page doesn't exist on disk (a typo or deleted page).
  2. website_slug set to a slug that doesn't match any page's own `slug` field
     (the field the build actually keys pages by, not the filename).

Run via `npm run check:projects`, and wired into the main `check` gate so this
class of drift fails CI instead of silently degrading cross-linking again.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "data" / "projects.json"
PAGES_DIR = PROJECT_ROOT / "src" / "content" / "pages" / "projects"

# Backend projects intentionally left without a dedicated website page: broad
# institutional program descriptions already covered by an existing hub page
# (courses -> programs/eduactive.json + participate/learning.json;
# educational-standards-qualifications -> programs/eduactive.json), or genuinely
# ambiguous overlap with an existing page pending a real decision
# (active-inference-textbook -> possible duplicate of project-textbook-group /
# project-fundamentals-active-inference; needs a human call, not a guessed page).
# Review this list periodically -- it should shrink, not grow.
NO_PAGE_EXPECTED = {
    "courses",
    "educational-standards-qualifications",
    "active-inference-textbook",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def website_page_slugs() -> set[str]:
    slugs = set()
    for path in PAGES_DIR.glob("*.json"):
        data = load_json(path)
        slug = data.get("slug")
        if slug:
            slugs.add(slug)
    return slugs


def main() -> int:
    projects = load_json(DATA_PATH).get("projects", [])
    page_slugs = website_page_slugs()

    errors: list[str] = []
    missing_page_notes: list[str] = []

    for project in projects:
        project_id = project["id"]
        slug = project.get("website_slug")
        if not slug:
            if project_id not in NO_PAGE_EXPECTED:
                missing_page_notes.append(
                    f"{project_id}: no website_slug set, and not on the NO_PAGE_EXPECTED allowlist "
                    f"-- either give it a website_slug pointing at a real page, or add it to the "
                    f"allowlist in this script with a one-line reason"
                )
            continue
        if slug not in page_slugs:
            errors.append(
                f"{project_id}: website_slug '{slug}' does not match any page's slug field "
                f"under src/content/pages/projects/ -- typo, or the page was renamed/deleted"
            )

    stale_allowlist = [pid for pid in NO_PAGE_EXPECTED if pid not in {p["id"] for p in projects}]
    for pid in stale_allowlist:
        errors.append(f"NO_PAGE_EXPECTED lists '{pid}', which no longer exists in data/projects.json -- remove it")

    if missing_page_notes:
        print("Projects with no website page (review NO_PAGE_EXPECTED allowlist):", file=sys.stderr)
        for note in missing_page_notes:
            print(f"- {note}", file=sys.stderr)

    if errors:
        print("Project discoverability check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Project discoverability check passed: {len(projects)} backend projects, "
        f"{len(page_slugs)} website pages, {len(NO_PAGE_EXPECTED)} intentionally page-less."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
