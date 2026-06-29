# Website roadmap & coordination

Forward-looking work for the Active Inference Institute website. Shipped history
lives in [`CHANGELOG.md`](CHANGELOG.md); this file tracks what's planned and in
progress. The site is a static, dependency-free build (`node src/build.mjs`) with a
strict Content Security Policy, gated by `npm run check`.

## Backlog / ideas

### From the 2026-06 deep review (see [`INDEX.md`](INDEX.md), [`GATING.md`](GATING.md))

- [ ] **Gating coverage (P0):** wire the 7 producer-2 slices
      (`governance_graph`, `ontology_graph`, `tech_tree_graph`, `domain_projects`,
      `narratives_public`, `communications_public`, `strategies_public`) into an
      **enforced** public-safety check. Use a *prose-tuned* validator (block real
      emails, `coda.io`, `/users/`, phone numbers) — do **not** reuse
      `validate_public_payload` as-is: its `PRIVATE_KEYS` (discord/slack/linkedin)
      and `FORBIDDEN_SUBSTRINGS` (`workspace`) legitimately appear in public
      narrative prose and graph node labels and would turn `check:instituteos` red
      on shippable content. See [`GATING.md`](GATING.md) "Known coverage gaps".
- [ ] **Release hygiene (P1):** git tags stop at `v2.4.0` but `CHANGELOG.md` has
      `v2.5.0`/`v2.6.0`; the domain migration + 11-locale launch sits under
      `## Unreleased`. Cut a release per [`RELEASING.md`](RELEASING.md) and backfill
      annotated tags `v2.5.0`, `v2.6.0`. (Version number — minor `v2.7.0` vs major
      `v3.0.0` — is a judgement call: the baseUrl/domain cutover is a hard URL
      change, but the public URLs were preserved via redirects.)
- [ ] `strategies_public.json` has **no consumer** in the repo — either wire it
      into a page/feed or remove it from `src/content/instituteos/`.
- [ ] `src/content/live-sources.json` commits resolved `coda.io` `finalUrl`
      values (verification metadata, not rendered). Either drop `finalUrl` from the
      committed file (resolve at check time) or add a gate forbidding `coda.io`
      substrings there; `check:sources` is not in the default `npm run check` chain.
- [ ] Add a **markdown link gate** (resolve relative links in `*.md`/`AGENTS.md`,
      fail on missing targets) wired into `npm run check` — markdown cross-links are
      currently ungated (`check:links` only scans built HTML).
- [ ] `repositories.json` carries inline `url`/`docsUrl` that duplicate
      `live-sources.json`; resolve by `sourceId`/`docsSourceId` (matching
      social/official-pages/resources). Confirm no external consumer reads those
      inline fields before removing them.
- [ ] Mobile enhancement: add a CSP-safe hamburger/disclosure toggle (`site.js`,
      under ~720px) so the sticky header collapses instead of stacking ~11 rows;
      add `@media(pointer:coarse)` 44px touch-target overrides. (The 601–960px
      detached-dropdown bug is already fixed in `assets/css/styles.css`.)

### Earlier backlog

- [ ] Per-page `lastmod` in `sitemap.xml` from content provenance — **deferred**:
      there is no per-page timestamp source today (`data/export-manifest.json`
      records per-file hashes, not page mtimes), and deriving it from git history
      would break the build's determinism. The uniform export-date `lastmod` is
      correct for a site regenerated as a unit; revisit if per-page provenance
      lands in the export manifest.
- [ ] Taxonomy-driven redirect generator (`scripts/generate-redirects.mjs` +
      a `check:redirects` gate) — **deferred (YAGNI)**: no output-URL migration is
      planned and the ~30-entry `assets/js/redirects.js` map is gate-checked and
      maintainable. Build this only when an Axis-B URL change is approved, as part
      of that change. See [`docs/REFACTOR_ASSESSMENT.md`](docs/REFACTOR_ASSESSMENT.md).
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
