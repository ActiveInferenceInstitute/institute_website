---
name: institute-website
description: >-
  Work on the Active Inference Institute public website (repos/institute_website):
  a static, zero-dependency Node build that renders JSON content into clean-URL
  HTML for GitHub Pages, with a strict CSP + link + public-safety contract. USE
  WHEN adding or editing a page, adding a project, registering an external link,
  changing navigation, adding a language/locale, editing the design system,
  changing legacy-URL redirects, doing the domain cutover, or running the build
  and check gates. Covers the page schema, the slug→URL taxonomy, the
  live-sources external-anchor gate, and the verification workflow.
---

# Institute Website skill

The single entry point for agents working in `repos/institute_website`. Read this,
then the relevant `Workflows/*.md` for the task and the `AGENTS.md` in the folder
you are editing.

## What this repo is

A **static** website for the Active Inference Institute, served by GitHub Pages
from the repository root of `main`. The build is plain Node (no framework, no
runtime deps): `node src/build.mjs` reads JSON content under `src/content/` and
writes HTML into the repo root (`about/index.html`, `projects/<slug>/index.html`,
…) plus one flat `index.html` and `404.html`. **Built output is committed** because
Pages serves it directly.

Canonical domain after cutover: **`https://activeinference.institute/`** (set in
`src/content/site.json` `baseUrl`; a `CNAME` file claims it). Before cutover the
base was `https://activeinferenceinstitute.github.io/institute_website/`.

## Golden rules (violating these fails `npm run check`)

1. **Edit source, never built output.** Change `src/content/*.json`,
   `src/render/*.mjs`, `assets/`, then rebuild. Never hand-edit `*/index.html`.
2. **External links must be registered.** Every external `<a href>` on a content
   page must exist in `src/content/live-sources.json` and be referenced by
   `sourceId` — NOT a raw `href`. Even vetted hosts (youtube.com,
   `*.activeinference.institute`) fail as raw content hrefs. See
   `Workflows/RegisterLiveSource.md`.
3. **Each content page needs**: `primaryActions` (non-empty), `externalSourceIds`,
   and at least one primaryAction backed by a registered `sourceId` (a "verified
   external action").
4. **Strict CSP.** No inline `<script>`/`<style>`, no `iframe`/`object`/`embed`/
   `form`, no client-side `fetch` (`connect-src 'none'`). Page-specific JS is an
   external `assets/js/*.js` file conditionally referenced from `layout.mjs`.
5. **Public-safety.** No private emails, rosters, `coda.io` data payloads, or
   internal material. Structured InstituteOS data enters ONLY via
   `scripts/sync_instituteos_public_data.py`.
6. **Run the gates before declaring done**: `npm run check` (see
   `Workflows/RunGates.md`).

## Slug → URL taxonomy (`src/url-taxonomy.mjs`)

Pages auto-register: drop a `<name>.json` anywhere under `src/content/pages/`
(folder nesting is for humans; it does NOT affect the URL). The `slug` field is
the identity:

- `slug: "x"` → `/x/` (top-level, e.g. `structure` → `/structure/`)
- `slug: "project-x"` → `/projects/x/`
- program slugs in the taxonomy's programs set → `/programs/x/`

## Workflows

| Task | Workflow |
| --- | --- |
| Add or edit a content page | [`Workflows/AddOrEditPage.md`](Workflows/AddOrEditPage.md) |
| Add a project page | [`Workflows/AddProject.md`](Workflows/AddProject.md) |
| Register an external link / shortlink | [`Workflows/RegisterLiveSource.md`](Workflows/RegisterLiveSource.md) |
| Add or update a language/locale | [`Workflows/AddLocale.md`](Workflows/AddLocale.md) |
| Run the build + check gates | [`Workflows/RunGates.md`](Workflows/RunGates.md) |
| Edit legacy-URL redirects | [`Workflows/EditRedirects.md`](Workflows/EditRedirects.md) |
| Do the Squarespace → Pages domain cutover | [`Workflows/DomainCutover.md`](Workflows/DomainCutover.md) |

## Folder map (each has its own `AGENTS.md`)

| Folder | What lives there |
| --- | --- |
| [`src/`](../../../src/AGENTS.md) | Build entry (`build.mjs`), data load (`data.mjs`), URL taxonomy |
| [`src/render/`](../../../src/render/AGENTS.md) | HTML rendering modules (layout, pages, links, seo, …) |
| [`src/lib/`](../../../src/lib/AGENTS.md) | Pure helpers (output, paths, text, instituteos) |
| [`src/content/`](../../../src/content/AGENTS.md) | JSON registries (site, navigation, resources, live-sources, …) |
| [`src/content/pages/`](../../../src/content/pages/AGENTS.md) | Page content + the page schema and type templates |
| [`scripts/`](../../../scripts/AGENTS.md) | Check gates, InstituteOS sync, i18n translate |
| [`assets/`](../../../assets/AGENTS.md) | CSS design system, JS, images, `redirects.js` |

## Cross-references

- Root agent guide: [`AGENTS.md`](../../../AGENTS.md)
- Human-facing readme: [`README.md`](../../../README.md)
- Design system: [`DESIGN_SYSTEM.md`](../../../DESIGN_SYSTEM.md)
- Internationalization: [`INTERNATIONALIZATION.md`](../../../INTERNATIONALIZATION.md)
- Domain migration runbook: [`MIGRATION.md`](../../../MIGRATION.md) and [`SWITCHOVER.md`](../../../SWITCHOVER.md)
