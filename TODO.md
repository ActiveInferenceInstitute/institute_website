# Website roadmap & coordination

Forward-looking work for the Active Inference Institute website. Shipped history
lives in [`CHANGELOG.md`](CHANGELOG.md); this file tracks what's planned and in
progress. The site is a static, dependency-free build (`node src/build.mjs`) with a
strict Content Security Policy, gated by `npm run check`.

## Backlog / ideas

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
