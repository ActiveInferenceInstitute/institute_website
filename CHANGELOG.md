# Changelog

All notable changes to the Active Inference Institute website are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## Unreleased

_Nothing yet._

## v2.8.0 — 2026-07-01

Ten new "Active Inference and X" domain-knowledge pages, refreshed research on
the existing six, and a full `docs/` cleanup pass.

### Added
- **10 new domain pages** — `/active-inference-and-economics/`,
  `-climate/`, `-education/`, `-law/`, `-neuroscience/`, `-linguistics/`,
  `-urban-planning/`, `-music/`, `-agriculture/`, `-cybersecurity/`. Each is
  sourced from a real Perplexity Sonar Deep Research report (saved in the
  InstituteOS backend's `library/research/active_inference_domains/`), curated
  into the `active_inference_domains.json` registry, and exported via
  `ResearchDomainsExporter` — same pipeline as the existing six.
- **Refreshed content** for the existing six domain pages
  (Healthcare, Robotics, Ecology, Medicine, Psychology, Entomology) — new
  "Why the domain fits" / "State of the literature" / "Key projects and tools"
  / "Open problems" sections synthesized from a fresh deep-research pass.

### Changed
- `docs/` — removed the stale, superseded `REFACTOR_ASSESSMENT.md` (folded its
  durable "source organization vs. output URL" model into
  `SLUG_AND_URL_TAXONOMY.md`); split the oversized `CONTENT_AUTHORING.md` into
  page-authoring guidance plus a new `REGISTRIES.md` reference; fixed a stale
  page-count/folder inventory (missing `domains/`/`communications/` folders);
  removed a dead pre-`docs/`-era section from `DESIGN_SYSTEM.md`; corrected a
  wrong redirect claim in `MIGRATION_AND_REDIRECTS.md` (`/history` is a live
  page, not a redirect).

## v2.7.0 — 2026-06-29

Public launch on GitHub Pages: `activeinference.institute` migrated off
Squarespace, plus a full build-time multilingual site (11 locales). Minor bump —
public URLs were preserved via redirects, so visitors see no breaking change.

### Added
- **Squarespace → GitHub Pages migration** — switch of `activeinference.institute`
  off Squarespace. Adds a `CNAME` and flips `site.json` `baseUrl` to the apex
  domain. Legacy Squarespace page URLs are caught by a base-path-aware,
  CSP-safe redirect script (`assets/js/redirects.js`) loaded only on `404.html`
  (GitHub Pages' catch-all), mapping 30+ old paths (`/fellowship`, `/tnb`,
  `/board-of-directors`, `/about-us`, …) to their new clean-URL homes and falling
  through to the informative 404 otherwise. New on-site pages were authored for
  shortlink topics that previously only existed on Coda — `/strategy/`,
  `/measure/`, `/prepare/`, `/video/`, `/weekly/`, `/2025/`, `/2026/`,
  `/projects/affordances/`, `/projects/wave-hypothesis/` — each linking onward to
  its registered shortlink for materials still being migrated; `/structure/`
  gained live Board/SAB roster links and `/projects/aicacp/` was deepened. Five
  shortlink sources were registered in `live-sources.json`. Full runbook and the
  subdomain-forward repoint table live in [`MIGRATION.md`](MIGRATION.md). The
  site-contract and internal-link checks now read the canonical base from
  `site.json` so they track the domain automatically.
- **Multilingual site (build-time i18n)** — English is canonical; every locale in
  `src/i18n/locales.json` (currently Spanish, French, German, Portuguese,
  Italian, Russian, Chinese, Japanese, Korean, Hindi, Arabic) is pre-rendered
  into its own `/<code>/…` subtree with a CSP-safe `<details>` language switcher,
  per-locale `<html lang dir>`, `hreflang` alternates, and a machine-translation
  provenance note. Routing is locale-aware through a single point
  (`urlDirForSlug` in `src/url-taxonomy.mjs`); render code wraps visible strings
  in `tr()` (`src/i18n/index.mjs`) against committed catalogs at
  `src/content/i18n/<code>.json` with graceful English fallback. Translation is
  an offline step (`scripts/i18n_translate.mjs`) using a local Ollama model by
  default or any OpenAI-compatible hosted API (`I18N_PROVIDER=openai`); the build
  never calls a model, so it stays byte-stable, and the strict CSP
  (`connect-src 'none'`) is preserved. New scripts: `npm run i18n:extract`,
  `npm run i18n:translate`. Arabic exercises the RTL path. The static-security,
  internal-link, and site-contract gates all pass over the full multilingual
  output. See [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md).
- **Link-card icons** — the section/navigation link cards (`info-card`) now
  carry an optional inline-SVG glyph in a small red accent badge to the left of
  the title. A curated, theme-aware icon set lives in `src/render/icons.mjs`
  (`cardIcon(name)`); cards opt in via an `icon` field, and the homepage "Core
  areas" grid (Institute, Programs, Projects, Learning, Ecosystem, Open Source
  Map, Directory) is wired up. Icons are plain markup — no external request, no
  new binary asset, nothing for the strict CSP / static-security gate to flag.
  Cards without an `icon` render unchanged.

### Internal
- **Modularized the static generator** — `src/build.mjs` (a 2691-line monolith)
  was decomposed into 35 focused ES modules under `src/` (`data.mjs` foundation,
  `lib/`, `render/`, `pages/`, `feeds.mjs`), leaving `build.mjs` a ~107-line
  orchestrator. A pure refactor: generated output is byte-identical at every
  step (no version bump, no user-facing change).
- **Enforced public-safety gate on producer-2 data slices** — the 7
  graph/narrative JSON files from the separate private InstituteOS export
  (`*_graph.json`, `narratives_public`, `domain_projects`, `communications_public`,
  `strategies_public`) are now validated by a prose-tuned check in
  `check:instituteos`, closing a gap where they shipped into HTML ungated. See
  [`GATING.md`](GATING.md).
- **Documentation pass** — new top-level [`INDEX.md`](INDEX.md) (repository map),
  [`GATING.md`](GATING.md) (gated public-projection contract), and
  [`RELEASING.md`](RELEASING.md) (versioning + release checklist); de-orphaned the
  `docs/` conceptual guides from the entry points; added per-folder docs for
  `src/pages/`, `data/`, and `simulations/`; deduplicated the root
  `INTERNATIONALIZATION.md` / `DESIGN_SYSTEM.md` against their `docs/` supersets.
- **Mobile fix** — the dropdown nav no longer detaches in the 601–960px viewport
  range (nav menu now goes in-flow at the same breakpoint as its group).

## v2.6.0 — 2026-06-21

Design-system alignment, light-mode accessibility, and build modularization.

### Added
- **`DESIGN_SYSTEM.md`** — documents the CSS layering (generated
  `instituteos-ds.css` token export vs. the hand-edited `styles.css` site layer),
  the token fallback contract, how the light/dark theme class works, and what
  `check:design-system` enforces.
- **Design-system fallback enforcement** — `check:design-system` now verifies
  that every `var(--ds-*, <fallback>)` in `styles.css` matches the canonical
  token value from a fresh export, so the fallbacks can never silently drift.
- **Media-scoped `theme-color`** — a `prefers-color-scheme` `theme-color` meta
  pair (dark/light) so the browser chrome matches the OS-preferred theme on load.
- **`src/url-taxonomy.mjs` + `src/lib/text.mjs`** — the clean-URL slug taxonomy
  and the pure text utilities are now focused, reusable modules. The
  program-subpage slug set is shared with `check_site_contract.py` via
  `src/url-taxonomy.json`, removing cross-language drift.

### Changed
- **Documentation reconciled with the clean-URL architecture** — `README.md` and
  `AGENTS.md` no longer describe the pre-v2.0 flat `*.html` layout; deployment
  verification URLs now point at the real clean URLs (`/resources/` etc.) and
  the generated-file inventory covers feeds, the manifest, `version.json`,
  `security.txt`, `/search/`, and `/sitemap/`.
- **Theme-aware accent text** — links and small labels use light-red on dark
  backgrounds and brand red on light backgrounds so they clear WCAG AA in both
  themes; the always-dark home hero keeps light-red.
- **CSS aligned to design-system tokens** — `:root` fallbacks match the canonical
  dark tokens and off-brand hardcoded backgrounds now use tokens.
- **Deterministic `security.txt` `Expires`** — derived from the export date
  (+1 year) instead of a hardcoded date.

### Fixed
- **Light-mode contrast** — the footer, content/index/next-action bands, the
  page hero, the sticky header, the search dropdown, and several hover/focus
  states no longer render text on a same-tone background in light mode.
- **Keyboard focus parity** — nav-menu links show the same filled state on
  keyboard focus as on pointer hover.

## v2.5.0 — 2026-06-20

Discoverability, theming, and smarter search.

### Added
- **HTML sitemap (`/sitemap/`)** — a human-readable index of every public page,
  generated programmatically and linked from the footer of every page. The XML
  sitemap now also emits `<changefreq>` hints (weekly for top-level pages,
  monthly for deeper collection pages) alongside `<lastmod>`/`<priority>`.
- **CollectionPage + ItemList structured data** — the `/projects/` and
  `/programs/` hub pages now publish a `CollectionPage` with an `ItemList` of
  their child pages, derived at build time so the listing tracks content.
- **Per-domain ecosystem landing pages (`/ecosystem/<domain>/`)** — one page per
  domain of application that has mapped projects, listing each project (linking
  to its page when one exists). The ecosystem overview links into each domain.
- **Light/dark theme toggle** — a CSP-safe header control (`assets/js/theme.js`,
  external + `defer`) that toggles the design-system light tokens, persists the
  choice in `localStorage`, and honors `prefers-color-scheme` in system mode.
- **Fuzzy + synonym search** — both the header quick-search and the `/search/`
  page now expand queries through a synonym/alias map, fall back to a
  subsequence fuzzy match, and highlight matched substrings with `<mark>`.

### Changed
- **Richer Organization JSON-LD** — the Organization node now declares
  `additionalType` (NGO) and a structured `contactPoint`.
- **Reliable link previews** — `og:image:width`/`height` (1200×630) and
  `og:image:alt` are now emitted in every page head.
- **Reduced layout shift** — the brand image on `/knowledge/` carries intrinsic
  `width`/`height` plus `loading="lazy"` and `decoding="async"`.
- **Motion-preference fix** — the back-to-top button now uses an instant scroll
  when `prefers-reduced-motion: reduce` is set.

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
