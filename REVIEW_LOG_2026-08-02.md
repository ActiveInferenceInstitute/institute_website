# Review log — documentation mega-deep pass

Date: 2026-08-02
Repo: ActiveInferenceInstitute/institute_website
Branch: main (HEAD 563b38d03 — `perf(a11y,seo): lazy-load search index, fix ARIA menu roles, tweet attribution`)
Scope: DOCS-DEEP — review all documentation, scope findings into a top-level TODO, implement every improvement.

## Phase 0 — Preflight

- [x] `git fetch origin` + fast-forward pull onto `main` — already up to date.
- [x] Inventory:
  - Root longform docs (12): AGENTS.md, CHANGELOG.md, CONTRIBUTING.md, DESIGN_SYSTEM.md,
    GATING.md, INDEX.md, INTERNATIONALIZATION.md, MIGRATION.md, README.md, RELEASING.md,
    SWITCHOVER.md, TODO.md.
  - `docs/` conceptual guides (11): README.md, ARCHITECTURE.md, CONTENT_AUTHORING.md,
    DESIGN_SYSTEM.md, GATES_AND_VALIDATION.md, GETTING_STARTED.md, INTERNATIONALIZATION.md,
    MIGRATION_AND_REDIRECTS.md, REGISTRIES.md, SLUG_AND_URL_TAXONOMY.md, TROUBLESHOOTING.md.
  - Per-folder `AGENTS.md` (8) + `data/README.md`, `simulations/README.md`.
  - `.claude/skills/institute-website/` SKILL.md + 7 Workflows (tracked in git).
  - CI: `.github/workflows/ci.yml` (build + full check + build-parity gate).
  - No CITATION.cff, SECURITY.md, CODE_OF_CONDUCT.md, .editorconfig.
  - 11,685 tracked files; 43 tracked `.md` files.
- [x] Baseline gates: `npm run check:md-links` — 43 files, 335 links, no broken links (EXIT 0).
- [x] Baseline full `npm run check` launched in background (result below).

## Phase 1 — Mega-deep docs review

- [x] Dispatched 3 parallel read-only audit subagents (deleg_aca05bf9):
  1. Root longform docs (12 files)
  2. `docs/` folder (11 files)
  3. Code-adjacent docs (per-folder AGENTS.md, skill + Workflows, CI, npm-table docs)

### Audit findings (consolidated, verified)

Method: 3 parallel read-only subagents (root longform / docs/ folder / code-adjacent)
+ first-hand verification of every finding against the repo. The docs/ folder
subagent hit a provider billing error mid-run; its coverage was completed
first-hand. Baseline `npm run check`: **EXIT=0** on committed state (all gates
green). `npm run check:md-links`: 43 files, 335 links, no broken links.
Independent GitHub-slugger anchor scan across all 43 `.md` files: **0 broken
anchors** (REGISTRIES.md's `#live-sources--external-links-the-full-workflow`
double-hyphen anchor is valid GitHub slugger output). Two rebuilds of the site:
**0 modified files** (build is byte-deterministic).

PRIVACY / PUBLIC-REPO HYGIENE (medium):
- `repos/institute_website` private monorepo-relative path in
  docs/GETTING_STARTED.md:19, docs/README.md:4, .claude/.../SKILL.md:4,16.
- `../../library/design-system` + `../../repos/institute_website` in
  docs/GATES_AND_VALIDATION.md:149,162,170,172,183,185 and the error hint in
  scripts/check_design_system_export.mjs:171.

STALE / INACCURATE (medium):
- docs/TROUBLESHOOTING.md "Huge diff after a build" claims a per-build footer
  hash; the build is deterministic (verified by double rebuild) — rewrite.
- docs/INTERNATIONALIZATION.md:354-364 shows the pre-563b38d03 language-switcher
  markup (`role="menu"`/`menuitem`); current build emits `<nav class="lang-menu"
  aria-label="Language">` + plain links; also a `</a>`→`</details>` typo.
- docs/SLUG_AND_URL_TAXONOMY.md "Adding a New URL/Route Pattern" (379-466)
  instructs hardcoded if/else edits to `baseDirForSlug`, contradicting the
  v4.0.0 data-driven rule table (the doc's own lines 55-70, 119-127).
- RELEASING.md:12 stale line ref `src/build.mjs:103-113` (actual: 140-143).
- docs/ARCHITECTURE.md:99 `content/i18n/_strings.json` → `src/content/i18n/...`.
- docs/INTERNATIONALIZATION.md:510 url-taxonomy.json described as "Program
  subpage routing rules" only (now the full routing table).

FORMATTING / INDEX (minor):
- scripts/AGENTS.md:25-29 five table rows with stray `||` prefix (broken
  markdown table); `check:projects`/`check:catalog` rows missing.
- Trailing whitespace: docs/ARCHITECTURE.md:73, docs/CONTENT_AUTHORING.md
  (119,125,139,148,151,154,157), docs/DESIGN_SYSTEM.md (84,123,140,144,305,316,331).
- INDEX.md:19 `Plans/` row — directory does not exist; INDEX.md:20 output-dir
  list missing bibliography/, communications/, newsletter/, open-source/.

COMPLETENESS (medium):
- No CITATION.cff, no SECURITY.md; package.json lacks `license` (LICENSE is
  CC-BY-4.0); README has no License section.

## Phase 2 — Scope into TO-DO.md

See TO-DO.md (updated with this pass's findings; completed items marked with commit refs).

## Phase 3 — Implementation log

| Commit | Scope |
| --- | --- |
| (pending) | … |

## Phase 4 — Verification

- [ ] Full `npm run check` green on final state
- [ ] `git diff --check` clean
- [ ] Pushed to `origin/main`; `git status` up to date

## Notes / skipped

- Heavy gates (`npm run check`, `check:site`) run in background per the institute-website
  skill (they exceed the foreground timeout).
- No code changes intended — docs-only pass. No test suites to run beyond the repo's own
  check gates (the site has no unit-test suite; CI = build + checks + build-parity).
