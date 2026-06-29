# Agent Guide — `src/pages/`

Standalone **page renderers** for pages that are built from registries/derived
data rather than from a single `src/content/pages/*.json` file. Each module
exports a render function that `src/build.mjs` calls to produce one output page.
These are the dynamic, list-driven pages of the site.

| Module | Renders | Reads |
| --- | --- | --- |
| `calendar.mjs` | `/calendar/` | `siteData` calendar feed |
| `directory.mjs` | `/directory/` | people/entity registries |
| `ecosystem.mjs` | `/ecosystem/` | ecosystem orgs + `sanitizePublicProse` |
| `projects.mjs` | `/projects/` + per-project pages | `loadProjectsData()` (`data/projects.json`) |
| `resources.mjs` | `/resources/` | resources + live-sources registries |
| `search.mjs` | `/search/` | build search index (`render/search.mjs`) |
| `simulations.mjs` | `/simulations/` index | simulation list |
| `sitemap.mjs` | `/sitemap/` + `sitemap.xml` | `ALL_ROUTED_SLUGS` |

## Rules

- A page's output URL derives from its **slug**, never this file's path (see
  [`../../docs/SLUG_AND_URL_TAXONOMY.md`](../../docs/SLUG_AND_URL_TAXONOMY.md)).
- Resolve external links by `sourceId` through `live-sources.json` — never
  hardcode URLs (see the external-anchor gate in
  [`../content/AGENTS.md`](../content/AGENTS.md)).
- All visitor prose from injected data must pass through `sanitizePublicProse`
  / `escapeHtml` from [`../lib/text.mjs`](../lib/text.mjs).
- Locale-aware routing comes from `urlDirForSlug` / `hrefForSlug`
  (`../url-taxonomy.mjs`); every routed page is rendered once per locale.
- Never hand-edit the built HTML these emit; edit the renderer and rebuild.
