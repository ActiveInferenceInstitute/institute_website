# Changelog

All notable changes to the Active Inference Institute website are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## v2.4.0 — 2026-06-19

Search depth, richer structured data, and per-page link previews.

### Added
- **Dedicated `/search/` page** — full results grouped by type (pages,
  repositories, concepts, policies, processes, people), deep-linkable via `?q=`,
  with a "See all results" link from the header quick-search.
- **Per-project structured data** — each `/projects/<name>/` page now publishes
  `SoftwareSourceCode` JSON-LD (with `codeRepository` when a public repo exists) or
  `CreativeWork`, alongside its breadcrumb.
- **Per-page social cards** — a unique 1200×630 `og:image` is generated for every
  content page (`scripts/generate-cards.mjs`), so each link preview is distinct.
- **`TODO.md`** roadmap at the repo root to coordinate upcoming work.

## v2.3.0 — 2026-06-19

Brand identity and site-wide search.

### Added
- **Dedicated brand icon + social card.** A square SVG mark (Markov-blanket motif)
  rasterized to favicon, apple-touch, and 192/512 PWA icon sizes, plus a 1200×630
  social-share card now used as `og:image`/`twitter:image` and the schema.org logo —
  replacing the previous non-square brand mark. Regenerate with
  `scripts/generate-icons.sh`.
- **Global site search.** A header search box that searches an embedded index of
  pages, repositories, concepts, policies, processes, and people (324 entries).
  Fully client-side and CSP-safe (no network requests), with keyboard navigation.

## v2.2.0 — 2026-06-19

Subscription, installability, and disclosure.

### Added
- **RSS + JSON feeds** of Institute updates (`/feed.xml`, `/feed.json`) built from
  the public communications, with autodiscovery `<link rel="alternate">` on every page.
- **Installable web app** — a `manifest.webmanifest` (name, theme, icons, standalone
  display) plus favicon and apple-touch-icon links, so the site can be added to a
  home screen.
- **`/.well-known/security.txt`** (RFC 9116) with a responsible-disclosure contact.

### Notes
- The PWA/favicon icons reuse the brand mark (non-square); a dedicated square icon
  can be swapped in later without code changes.

Search-engine optimization and discoverability.

### Added
- **Structured data (schema.org JSON-LD).** The home page publishes Organization
  and WebSite data; every other page publishes a BreadcrumbList reflecting its
  section (e.g. Home › Projects › Active Blockference) — improving search results
  and enabling rich breadcrumb display.
- **Social share previews.** Every page now carries an `og:image` and an upgraded
  `summary_large_image` Twitter card with title, description, and image.
- **Richer sitemap.** Each URL now includes `lastmod` and a depth-based `priority`
  (home highest, section pages above deep collection pages) to guide crawlers.

## v2.0.0 — 2026-06-19

Major information-architecture change: the website now uses clean,
section-based URLs.

### Changed
- **Clean URLs everywhere.** Every page now lives at a readable directory path
  instead of a `.html` file. For example, the About page is now at `/about/`
  (previously `/about.html`), projects live under `/projects/<name>/`, and the
  participation programs live under `/programs/<name>/` (fellowship, internship,
  mentorship, partnership, philanthropy). The home page is `/` and the global
  index is `/directory/`.
- All internal links, navigation, the sitemap, and canonical URLs were updated
  to the new clean paths.

### Notes
- This is a hard URL break with no redirect stubs: old `*.html` addresses are no
  longer emitted. Update any external bookmarks to the new section URLs.
- The custom 404 page remains at the site root so it keeps working on
  GitHub Pages.

## v1.0.0 — 2026-06-19

First versioned release of the public website.

### Added
- **Interactive network graphs** — explore the Active Inference tech tree, the
  concept/ontology relationships, and the Institute's governance network as
  navigable node-link diagrams.
- **Narrative content** surfaced across the About, Activities, Structure, and
  Ecosystem pages (mission, history, strategy, and domains of application).
- **Browse projects by domain** on the Ecosystem page, with related-project
  cross-links throughout the project pages.
- **Open Source Map** tables for public people, repositories, ideas, ontology
  relationships, governance, processes, and policies.
- A machine-readable `version.json` and an on-page build stamp for provenance.

### Notes
- The site is a static, dependency-free build with a strict Content Security
  Policy. All public data is generated from a curated, privacy-reviewed source.
