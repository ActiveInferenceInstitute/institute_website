# Website roadmap & coordination

Forward-looking work for the Active Inference Institute website. Shipped history
lives in [`CHANGELOG.md`](CHANGELOG.md); this file tracks what's planned and in
progress. The site is a static, dependency-free build (`node src/build.mjs`) with a
strict Content Security Policy, gated by `npm run check`.

## Shipped in v2.5

- [x] **Sitemap `changefreq` hints and an HTML sitemap page** — XML `<changefreq>`
      plus a human-readable `/sitemap/` linked from every footer.
- [x] **`CollectionPage` structured data** for the `/projects/` and `/programs/`
      indexes (with an `ItemList` of child pages).
- [x] **Light/dark theme toggle** persisted in `localStorage`
      (`assets/js/theme.js`, CSP-safe external script).
- [x] **Per-domain landing pages under `/ecosystem/`** linking to projects by
      domain of application.
- [x] **Search synonyms / fuzzy matching and result highlighting** across the
      header quick-search and the `/search/` page.

## Shipped in v2.4

- [x] **Dedicated `/search/` page** — full results grouped by type, deep-linkable
      via `?q=`, with a "See all results" link from the header quick-search.
- [x] **Per-project structured data** — `SoftwareSourceCode` (when a public repo
      exists) or `CreativeWork` JSON-LD on each `/projects/<name>/` page.
- [x] **Per-page social cards** — a generated 1200×630 `og:image` per page
      (`scripts/generate-cards.mjs` → `assets/img/cards/<slug>.png`).

## Backlog / ideas

- [ ] Per-page `lastmod` in `sitemap.xml` from content provenance (instead of a
      uniform build date).
- [ ] Media-scoped `theme-color` meta pair (dark/light) to complement the toggle.

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
