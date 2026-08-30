# Website roadmap & coordination

Forward-looking work for the Active Inference Institute website. Shipped history
lives in [`CHANGELOG.md`](CHANGELOG.md); this file tracks what's planned and in
progress. The site is a static, dependency-free build (`node src/build.mjs`) with a
strict Content Security Policy, gated by `npm run check`.

## Backlog / ideas

- [x] **i18n catalog backlog (2026-07-20) — DONE 2026-08-02.** The extract now
      collects 3,418 strings (long-form knowledge/course prose entered the
      catalog with the strategy-map wiring and content growth); the offline
      `npm run i18n:translate` pass (local Ollama; incremental/resumable) filled
      **100%** of every locale — all 11 catalogs sit at 3,534 entries
      (es/fr/de/pt/it/ru/hi/ar via gemma3:4b, zh/ja/ko via qwen2.5:3b). See the
      CHANGELOG "Unreleased" translation entry. A TERMINOLOGY QA pass is noted
      in scope for a future sweep (established terms like "Active Inference";
      residual derived entries from earlier base-key fixes).

### From the 2026-06 deep review (see [`INDEX.md`](INDEX.md), [`GATING.md`](GATING.md))

- [x] **Gating coverage (P0) — DONE, and now unconditional (2026-07-05).** The
      producer-2 slices (`*_graph`, `domain_projects`, `narratives_public`,
      `communications_public`, `newsletter`, plus `programs`, `citations`,
      `calendar`, `videos`; `strategies_public` retired 2026-08, unrendered
      since the strategy-map removal) are run through
      `validate_public_prose_payload` in `check_committed_public_payloads`
      (enforced by `check:instituteos`) — a prose-tuned gate (blocks real emails,
      `coda.io`, `/users/`, phones, and unambiguous private keys; tolerates
      `slack`/`discord`/`linkedin`/`workspace` tokens that legitimately appear in
      public prose). A 2026-07-05 audit found this only ran when the private
      `instituteos` checkout could **not** be resolved — dead code in the normal
      monorepo dev layout — fixed to run unconditionally. See [`GATING.md`](GATING.md).
- [x] **Content-safety scan widened (2026-07-05) — DONE.** `check:site` scanned
      only 5 of 17 committed `src/content/instituteos/*.json` files; now scans
      all of them dynamically.
- [x] **RESOLVED (2026-07-05): governance-surface content flagged by the widened
      scan.** Confirmed with the Institute: entity/role *names* ("Board of
      Directors", "Officers", "Scientific Advisory Board") are public; process/
      workflow *mechanics* are not. `processes.json` (the one file with actual
      step-by-step governance-process descriptions) and every renderer that
      consumed it (Open Source Map "Processes" table + search index + counts)
      were removed entirely. "workspace" was a false-positive (common word) and
      is no longer blocked. `npm run check:site` passes. See [`GATING.md`](GATING.md) item 3.
- [x] **PII scan added to `check:security` (2026-07-05) — DONE.** GATING.md
      claimed rendered-HTML PII scanning that didn't exist in code; added a real
      email/phone scan over rendered text + `mailto:` targets, with a
      `VETTED_PUBLIC_EMAILS` allowlist for two confirmed-legitimate public
      contacts found during testing.
- [x] **Release hygiene (P1) — DONE.** Git tags `v2.5.0` … `v4.0.0` all now
      exist and `CHANGELOG.md` lists them as released (tags/version backfilled to
      match). The baseUrl/domain cutover shipped via `v3.0.0` with public URLs
      preserved through redirects.
- [x] `strategies_public.json` has **no consumer** in the repo — either wire it
      into a page/feed or remove it from `src/content/instituteos/`.
      **Done 2026-07-20:** wired as the `#strategy-map` section on `/strategy/`
      (`strategyMapSection()` in `src/render/feature-sections.mjs`) — department
      cards with grouped revenue streams, loaded via `siteData.instituteos.strategies`.
      **Later retired 2026-08:** the strategy-map section was removed
      (e53b9c97f1) and `strategies_public.json` deleted (6b9fb01802) — it is no
      longer part of the export set.
- [x] `src/content/live-sources.json` commits resolved `coda.io` `finalUrl`
      values (verification metadata, not rendered). **Done 2026-07-20:** `finalUrl`
      dropped from the committed file; `check_live_sources.py` resolves redirects at
      check time and errors on any committed `finalUrl` (`--write` strips it).
      `check:sources` remains deliberately outside the offline `npm run check` chain.
- [x] Add a **markdown link gate** (resolve relative links in `*.md`/`AGENTS.md`,
      fail on missing targets) wired into `npm run check` — **done 2026-07-20:**
      `scripts/check_markdown_links.py` (`check:md-links`) is in the default chain
      and the `py_compile` list.
- [x] **`repositories.json` inline `url`/`docsUrl` dedup (2026-07-20) — DONE.**
      Records now resolve through `live-sources.json` by `sourceId`/`docsSourceId`
      (parent-repo consumer check: zero readers of the inline fields); a
      `check:site` arm fails loudly if a future GitHub-API refresh reintroduces
      inline URLs.
- [x] **Mobile enhancement (2026-07-20) — DONE.** CSP-safe hamburger/disclosure
      toggle: `#nav-toggle` button in the header (`src/render/layout.mjs`,
      `tr("Menu")`-labeled, `aria-expanded`/`aria-controls="site-nav"`), click +
      Escape wiring in `site.js` (no inline handlers), collapse styles in
      `styles.css`. Progressive enhancement: `site.js` stamps `data-nav-js` on
      the header — without JS the toggle stays hidden and the nav renders
      expanded, so navigation stays reachable. Under 720px the header now wraps
      into ~3 compact rows (brand+hamburger / search / control buttons) instead
      of stacking ~11; `@media(pointer:coarse)` adds ≥44px touch targets for
      header controls, nav/lang menus, tag chips, and footer links. (The
      601–960px detached-dropdown bug was already fixed in
      `assets/css/styles.css`.)

### Earlier backlog

- [ ] Per-page `lastmod` in `sitemap.xml` from content provenance — **deferred**:
      there is no per-page timestamp source today (`data/export-manifest.json`
      records per-file hashes, not page mtimes), and deriving it from git history
      would break the build's determinism. The uniform export-date `lastmod` is
      correct for a site regenerated as a unit; revisit if per-page provenance
      lands in the export manifest.
- [x] Taxonomy-driven redirect generator + a `check:redirects` gate — **done**:
      shipped as part of the Axis-B migration of the 16 "Active Inference and X"
      domain pages from `/active-inference-and-<x>/` to `/active-inference/<x>/`
      across all 12 locales. Implemented differently than originally envisioned:
      rather than a codegen script emitting static per-locale entries, the
      redirect logic itself is rule-driven — a small locale-aware
      `PREFIX_REDIRECTS` array in `assets/js/redirects.js` covers the whole
      routing-family rename in one entry, with no per-locale generation needed.
      `scripts/check_redirects.py` (wired into `npm run check:redirects`, part of
      `npm run check`) validates the `MAP`/`PREFIX_REDIRECTS` entries against
      `src/url-taxonomy.json` and the build output. See
      [`docs/SLUG_AND_URL_TAXONOMY.md` § Two independent axes](docs/SLUG_AND_URL_TAXONOMY.md#two-independent-axes-source-organization-vs-output-url).
- [ ] Extract the shared external-anchor validation (`VETTED_ANCHOR_HOST_SUFFIXES`,
      `vetted_anchor_host()`) into `scripts/validation_utils.py`, imported by both
      `check_static_security.py` and `check_site_contract.py` — **deferred (low
      value)**: the current duplication is intentional defense-in-depth for the
      security gate; only refactor if both gates keep passing identically.

## Docs review — 2026-08-02 mega-deep documentation pass

> **Last reviewed:** 2026-08-02 (HEAD 563b38d03). Severity: **Minor** = typo /
> formatting / broken table / stale single reference; **Medium** = stale section
> rewrite, doc restructure, added missing guide, public-repo hygiene; **Major** =
> large doc-system overhaul / cross-cutting refactor. Completed items carry a ✓
> and the commit that shipped them; the open list at the bottom is deferred.

### Minor

- [x] **Fix `||`-prefixed table rows in `scripts/AGENTS.md`** (lines 25–29: the
      `sync:instituteos`/`i18n:extract`/`i18n:translate`/`sync:transcripts`/
      `check:transcripts` rows render as literal text, breaking the npm-script
      table) and add the missing `check:projects` / `check:catalog` rows. ✓ (86e23f5d4)
- [x] **Strip trailing whitespace** in `docs/ARCHITECTURE.md:73`,
      `docs/CONTENT_AUTHORING.md` (119, 125, 139, 148, 151, 154, 157), and
      `docs/DESIGN_SYSTEM.md` (84, 123, 140, 144, 305, 316, 331). ✓ (86e23f5d4)
- [x] **INDEX.md stale `Plans/` row** — the directory does not exist; remove the
      row (or mark it absent) so the top-level map only lists real entries. ✓ (86e23f5d4)
- [x] **INDEX.md output-dir list incomplete** — add `bibliography/`,
      `communications/`, `newsletter/`, `open-source/` to the "all other tracked
      root dirs" row. ✓ (86e23f5d4)
- [x] **RELEASING.md stale line reference** — `src/build.mjs:103-113` no longer
      points at the `version.json` writer (it moved to ~140-143); drop the exact
      line numbers so the reference cannot drift again. ✓ (feb0f61a6)
- [x] **docs/ARCHITECTURE.md `_strings.json` path** — `content/i18n/_strings.json`
      reads as root-relative in the "Root Singletons" list; clarify to
      `src/content/i18n/_strings.json`. ✓ (feb0f61a6)
- [x] **docs/INTERNATIONALIZATION.md file-reference row** — `url-taxonomy.json`
      is described as "Program subpage routing rules" only; it now carries the
      full routing table (`programSubpageSlugs`, `orgPageSlugs`, `yearPageSlugs`,
      `routing.rules`). ✓ (feb0f61a6)

### Medium

- [x] **Remove private monorepo path references (public-repo hygiene)** —
      `repos/institute_website` appears in `docs/GETTING_STARTED.md:19`,
      `docs/README.md:4`, `.claude/skills/institute-website/SKILL.md:4,16`; and
      `../../library/design-system` / `../../repos/institute_website` appear in
      `docs/GATES_AND_VALIDATION.md` (149, 162, 170, 172, 183, 185) plus the
      error hint in `scripts/check_design_system_export.mjs:171`. Rewrite to
      neutral, standalone-checkout phrasing (`INSTITUTEOS_DS_ROOT`). ✓ (f5d834dd0)
- [x] **docs/TROUBLESHOOTING.md "Huge diff after a build" is stale** — it claims
      the footer build-stamp changes on every rebuild; the build is
      byte-deterministic (verified: two rebuilds, zero modified files). Rewrite
      the section to explain what a large diff actually signals. ✓ (feb0f61a6)
- [x] **docs/INTERNATIONALIZATION.md stale language-switcher markup** — the
      sample still shows `role="menu"`/`role="menuitem"` (removed in 563b38d03);
      the build now emits `<nav class="lang-menu" aria-label="Language">` with
      plain links. Also fixes a `</a>`→`</details>` typo in the sample. ✓ (feb0f61a6)
- [x] **docs/SLUG_AND_URL_TAXONOMY.md "Adding a New URL/Route Pattern"** — steps
      2–3 still instruct hardcoded `if/else` edits to `baseDirForSlug()`,
      contradicting the v4.0.0 data-driven rule table documented in the same
      file (lines 55–70, 119–127). Rewrite for the JSON-rule workflow. ✓ (feb0f61a6)
- [x] **Add CITATION.cff** — public research-org repo with no citation file;
      ground it in the real LICENSE (CC-BY-4.0), repository URL, and current
      version (4.0.0). ✓ (8fcd8c3b0)
- [x] **Add SECURITY.md** — point at the existing RFC 9116
      `.well-known/security.txt` (vetted public contact
      `blanket@activeinference.institute` from `site.json`). ✓ (8fcd8c3b0)
- [x] **Declare the license in package metadata** — `package.json` (and
      `package-lock.json` root entry) lack `license`; add `"CC-BY-4.0"` to match
      `LICENSE` and `.aii/config.yaml`. ✓ (8fcd8c3b0)
- [x] **README has no License section** — add a short one referencing `LICENSE`
      and the new `CITATION.cff`. ✓ (8fcd8c3b0)

### Major

- [ ] **Unified docs index refresh** — `docs/README.md` is the hub but the root
      `INDEX.md` doc map and `docs/README.md` list root longform docs
      independently; a small cross-check pass keeps them in sync. **Deferred:**
      low marginal value — both are currently accurate and the per-folder
      `AGENTS.md` precedence is well documented; revisit only when a new root
      doc is added.
- [ ] **Line-number references in docs drift** — `SLUG_AND_URL_TAXONOMY.md` and
      `RELEASING.md` cite exact source line numbers (`src/data.mjs:45-58`, …)
      that will rot. **Deferred:** mechanically removing them all is churn with
      no gate impact; the stale one in RELEASING.md was fixed this pass and the
      taxonomy doc's refs were spot-verified accurate.

### Follow-up — completed audit batch findings (deleg_aca05bf9)

Second wave of verified findings from the two completed audit subagents
(implemented 2026-08-02, commits 93d3289ba + b14832dbc):

- [x] **RunGates.md: "52 repositories" → 35** (the gate enforces 35 per
      `check_site_contract.py`); add the missing `check:redirects` /
      `check:projects` / `check:catalog` rows to the gate table. ✓ (93d3289ba;
      count updated again 2026-08-30 when the roster moved to 35)
- [x] **EditRedirects.md: document `PREFIX_REDIRECTS`/`SET_REDIRECTS`** — "all
      redirects live in the MAP object" was outdated. ✓ (93d3289ba)
- [x] **ci.yml: "no lockfile is committed" comment was false** (package-lock.json
      is tracked); reword. ✓ (93d3289ba)
- [x] **Unregistered `official-participation` sourceId in templates** —
      `src/content/pages/AGENTS.md`, `_TEMPLATES.md`, `AddProject.md` used a
      sourceId absent from `live-sources.json`; swap to registered
      `aicacp-project-doc`. ✓ (93d3289ba)
- [x] **`participate/` folder listing wrong** — `learning` lives there,
      `measure` is in `institute/`. ✓ (93d3289ba)
- [x] **src/AGENTS.md**: add `newsletter` to standalone renderers + `pages/`
      map. ✓ (93d3289ba)
- [x] **src/render/AGENTS.md**: add `autolink`/`domains`/`graphs`/
      `video-table` module rows. ✓ (93d3289ba)
- [x] **assets/AGENTS.md**: add `video-table.js` row + `books/`/`newsletters/`/
      `tnb/` img dirs. ✓ (93d3289ba)
- [x] **docs/README.md `src/pages/` renderer list**: drop `knowledge` (it is a
      render module, not a page renderer) and add the real modules. ✓ (93d3289ba)
- [x] **GATES_AND_VALIDATION.md impossible failure example** — the
      "README.md contains visible Coda/workspace wording" message can never
      fire on a `.md` file (wording scan is `.html`-only); show a generated
      HTML file instead. ✓ (93d3289ba)
- [x] **AGENTS.md migration parenthetical in past tense** (cutover is
      complete). ✓ (b14832dbc)
- [x] **README stale client-side sentence + incomplete scripts/ tree**. ✓ (b14832dbc)
- [x] **INDEX.md `version.json` shape** — add `exported_at`; note `built_at`
      mirrors the export timestamp and `commit` is always null. ✓ (b14832dbc)
- [x] **DESIGN_SYSTEM.md regenerate wording** — the gate reports staleness; it
      does not regenerate. ✓ (b14832dbc)
- [x] **RELEASING.md Unreleased rule vs reality** — soften to "accumulates on
      main; emptied when a release is cut". ✓ (b14832dbc)
- [x] **Missing CHANGELOG Unreleased entries** for the video detail pages,
      bibliography/citations, and VideoObject thumbnailUrl commits. ✓ (b14832dbc)
- [x] **Add CODE_OF_CONDUCT.md** (adapted from Contributor Covenant 2.1) and
      link from CONTRIBUTING/README/INDEX. ✓ (b14832dbc)

### Open / deferred (from the audits)

- [ ] **Cut a release** — 17 Unreleased entries sit on `main` at version 4.0.0
      with no tag. Deferred: the RELEASING rule now documents the accumulate-
      on-main practice; cutting a release (version bump → rebuild → tag) is a
      user decision affecting the live site's `version.json`.
- [ ] **Stale i18n catalog keys "52 public repositories"** in all 11 locale
      catalogs (leftover from the older repo count; absent from `_strings.json`
      and unused). Deferred: translation data, not docs — needs an
      `npm run i18n:extract` + re-translate sweep.
- [ ] **README ↔ AGENTS.md contract duplication** (Design Contract /
      Operating Contract lists). Deferred: both are accurate today and the
      split is intentional (human overview vs agent contract).
- [ ] **docs/MIGRATION_AND_REDIRECTS.md:279 literal `https://coda.io` URL** —
      documents a legacy redirect target; safe today because the coda-URL scan
      covers only root README/AGENTS, but fragile if that scan ever widens.

### Open / deferred (original)

- [ ] **docs/ folder audit subagent was interrupted** (provider billing error) —
      its coverage was completed first-hand this pass; the docs/ set is now
      verified against the repo.
- [ ] **Terminology QA on machine-translated catalogs** — noted in the existing
      i18n backlog above; not part of this docs pass.
- [ ] **Per-page `lastmod` in sitemap.xml** — existing deferred item; unchanged.

## Conventions

- Edit `src/content/*` and `src/build.mjs`; never hand-edit generated `*.html`.
- Keep the CSP intact (`script-src 'self'`, `connect-src 'none'`): all JS is
  self-hosted, data is embedded at build time (no runtime fetch).
- Run `npm run check` before every change; it gates URLs, links, structured data,
  version consistency, and static security.
- Bump `package.json` (SemVer), add a `CHANGELOG.md` entry, and tag releases.
- Regenerate brand icons/cards with `scripts/generate-icons.sh`.

## Shipped

See [`CHANGELOG.md`](CHANGELOG.md) — recent: clean section-based URLs (v2.0),
SEO/structured data (v2.1), feeds + installable PWA + `security.txt` (v2.2),
brand icon + social card + global search (v2.3), localized `<head>` + full
11-locale translation coverage + VideoObject thumbnails (v4.0.0 + Unreleased).
