# Website roadmap & coordination

Forward-looking work for the Active Inference Institute website. Shipped history
lives in [`CHANGELOG.md`](CHANGELOG.md); this file tracks what's planned and in
progress. The site is a static, dependency-free build (`node src/build.mjs`) with a
strict Content Security Policy, gated by `npm run check`.

## Backlog / ideas

### From the 2026-06 deep review (see [`INDEX.md`](INDEX.md), [`GATING.md`](GATING.md))

- [x] **Gating coverage (P0) — DONE.** The 7 producer-2 slices (`*_graph`,
      `domain_projects`, `narratives_public`, `communications_public`,
      `strategies_public`) are now run through `validate_public_prose_payload` in
      `check_committed_public_payloads` (enforced by `check:instituteos`) — a
      prose-tuned gate (blocks real emails, `coda.io`, `/users/`, phones, and
      unambiguous private keys; tolerates `slack`/`discord`/`linkedin`/`workspace`
      tokens that legitimately appear in public prose). See [`GATING.md`](GATING.md).
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
