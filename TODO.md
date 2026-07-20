# Website roadmap & coordination

Forward-looking work for the Active Inference Institute website. Shipped history
lives in [`CHANGELOG.md`](CHANGELOG.md); this file tracks what's planned and in
progress. The site is a static, dependency-free build (`node src/build.mjs`) with a
strict Content Security Policy, gated by `npm run check`.

## Backlog / ideas

- [ ] **i18n catalog backlog (2026-07-20):** the extract now collects ~2,264
      strings (long-form knowledge/course prose entered the catalog with the
      strategy-map wiring and content growth); ~1,050+ keys per locale await the
      offline `npm run i18n:translate --all` pass (local Ollama; incremental/
      resumable). Visible UI chrome (nav "Menu", the domains band set) was
      translated 2026-07-20 for all 11 locales; untranslated content prose
      falls back to English with the machine-translation notice, by design.
      The translate pass must also include a TERMINOLOGY QA sweep: cross-vendor
      review (2026-07-20) found established-term defects in the existing
      catalogs (ru rendered "Active Inference" ungrammatically before this
      session's base-key fix — residual derived entries remain; hi rendered it
      as "active extraction" in at least one pre-existing entry, now fixed) —
      re-translate against a per-locale glossary of established terms.

### From the 2026-06 deep review (see [`INDEX.md`](INDEX.md), [`GATING.md`](GATING.md))

- [x] **Gating coverage (P0) — DONE, and now unconditional (2026-07-05).** The 7
      producer-2 slices (`*_graph`, `domain_projects`, `narratives_public`,
      `communications_public`, `strategies_public`) are run through
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
- [ ] **Release hygiene (P1):** git tags stop at `v2.4.0` but `CHANGELOG.md` has
      `v2.5.0`/`v2.6.0`; the domain migration + 11-locale launch sits under
      `## Unreleased`. Cut a release per [`RELEASING.md`](RELEASING.md) and backfill
      annotated tags `v2.5.0`, `v2.6.0`. (Version number — minor `v2.7.0` vs major
      `v3.0.0` — is a judgement call: the baseUrl/domain cutover is a hard URL
      change, but the public URLs were preserved via redirects.)
- [x] `strategies_public.json` has **no consumer** in the repo — either wire it
      into a page/feed or remove it from `src/content/instituteos/`.
      **Done 2026-07-20:** wired as the `#strategy-map` section on `/strategy/`
      (`strategyMapSection()` in `src/render/feature-sections.mjs`) — department
      cards with grouped revenue streams, loaded via `siteData.instituteos.strategies`.
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
brand icon + social card + global search (v2.3).
