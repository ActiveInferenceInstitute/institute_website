> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Content Source Layout & Page Schema

## Overview

The Active Inference Institute website uses a **single-source-of-truth JSON architecture** where all content lives under `src/content/` and is built to static HTML at the repository root via `src/build.mjs`. Folder nesting is **purely organizational** — the page `slug` field exclusively determines the output URL path (via `src/url-taxonomy.mjs`).

**Key Principle**: Edit JSON sources only; never edit built `*/index.html`. Run `node src/build.mjs && npm run check` after any change.

---

## Page Schema (All Pages)

Every page JSON object supports these fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `slug` | string | **YES** | Drives the output URL via `url-taxonomy.mjs`. Must be unique. |
| `title` | string | **YES** | Page `<h1>` and navigation label. |
| `subtitle` | string | **YES** | One-line descriptor shown under the title. |
| `audience` | string | **YES** | Who the page is for (e.g., "Researchers and practitioners"). |
| `lede` | string | **YES** | Opening summary paragraph (2-3 sentences). |
| `primaryActions[]` | link[] | **YES** (non-empty) | Hero CTA buttons (max 3 rendered). **At least one** must use `sourceId`. |
| `sections[]` | object[] | **YES** | Page body: each `{ heading, body, links[] }`. `heading` and `body` are strings; `links[]` is optional. |
| `cards[]` | object[] | optional | Card grid: each `{ title, text, links[] }`. All three fields are optional per card. |
| `order` | number | **YES** | Sort position within nav/collection listings. Used in primary nav and project/program listings. |
| `relatedSlugs[]` | string[] | optional | Slugs of related pages (used for cross-links and next-action pager). |
| `externalSourceIds[]` | string[] | **YES** | All `sourceId`s used anywhere on the page must be listed here. Enables link-check validation. |
| `resourceGroups[]` | string[] | optional | Live-source **categories** to filter resources (e.g., `["projects", "community"]`). First entry seeds the page's "Filtered resources" next-action. Valid values are lowercased live-source category names. |

### Link Rules

Every link is **one of two shapes** — never both in the same link object:

- **`{ "sourceId": "..." }`** — References a registered external link in `live-sources.json`. **Required for all external links.** A raw external `href` fails security checks.
- **`{ "label": "...", "href": "..." }`** — For **internal links only** (clean absolute paths like `/structure/`, `/structure/#leadership`).

Every `sourceId` used on a page must be listed in that page's `externalSourceIds[]` array.

---

## Page Type Taxonomy

All pages use the **same schema** but route differently based on slug shape (registered in `url-taxonomy.json → programSubpageSlugs`):

| Page Type | Slug Example | File Location | Output URL | Route Logic |
| --- | --- | --- | --- | --- |
| **Home** | `index` | `pages/index.json` | `/` | Rooted at repo root |
| **Top-level** | `about`, `structure`, `ecosystem` | `pages/institute/`, `pages/participate/` (folder is optional) | `/<slug>/` | Any slug not in other categories |
| **Program subpage** | `fellowship`, `internship`, `mentorship`, `partnership`, `philanthropy` | `pages/programs/<slug>.json` | `/programs/<slug>/` | Must be registered in `url-taxonomy.json → programSubpageSlugs` |
| **Project** | `project-aicacp`, `project-geo-infer` | `pages/projects/project-<name>.json` | `/projects/<name>/` | Slug starts with `project-`; prefix stripped in URL |
| **Collection** | `projects`, `programs`, `resources` | `pages/<slug>.json` or any subfolder | `/<slug>/` | Special meta-pages listing all items in a category |

---

## Slug → URL Mapping (`url-taxonomy.mjs`)

The `baseDirForSlug()` function (single source of truth) applies:

```
index                  → ""                    (/index.html → /)
project-*              → projects/<name>/      (/projects/<name>/index.html)
program subpage slug   → programs/<slug>/      (/programs/<slug>/index.html)
any other slug         → <slug>/               (/<slug>/index.html)
```

**Folder nesting is ignored**: a page at `src/content/pages/institute/about.json` with slug `"about"` routes to `/about/`, not `/institute/about/`.

---

## Source Folder Organization (Maintainer-Facing)

Folder grouping is **organizational only** — the build walks the tree recursively
and ignores folder nesting (see
[SLUG_AND_URL_TAXONOMY.md § Two independent axes](SLUG_AND_URL_TAXONOMY.md#two-independent-axes-source-organization-vs-output-url)).
Current groupings:

| Folder | Contains |
| --- | --- |
| `pages/institute/` | About, structure, governance, ecosystem, and unit/year pages |
| `pages/domains/` | "Active Inference and X" domain-knowledge pages (`active-inference-and-*`), generated by the InstituteOS exporter. Routed to nested `/active-inference/<domain>/` URLs via a "prefix" rule in `src/url-taxonomy.json` that strips the `active-inference-and-` slug prefix and reroots under `active-inference/` — folder placement itself still adds no URL prefix (source organization is independent of output routing, per `SLUG_AND_URL_TAXONOMY.md`). |
| `pages/participate/` | Participation pathways: get-involved, volunteer, grants, learning, prepare |
| `pages/programs/` | Structured participation programs: fellowship, internship, mentorship, partnership, philanthropy, eduactive, reinference |
| `pages/projects/` | Per-project pages (all prefixed `project-`) |
| `pages/communications/` | Reserved for newsletters/reports/announcements pages; empty until publication needs arise |
| `pages/` (root) | `projects.json` (collection meta-page) |

Per-folder counts drift as pages are added — for a live count, run
`find src/content/pages -name '*.json' | wc -l` (whole tree) or
`find src/content/pages/<folder> -name '*.json' | wc -l` (one folder).

---

## Top-Level Registries & InstituteOS Sync Data

The shared registries under `src/content/*.json` (site identity, navigation,
live-sources allowlist, resources, repositories, audience pathways, ontology
terms, ...) and the sync-generated `src/content/instituteos/*.json` public data
are documented separately in [REGISTRIES.md](REGISTRIES.md) -- they are loaded
once per build and referenced from many pages, unlike the per-page JSON
described above.

---

## Concrete Annotated Example Page JSON

**File**: `src/content/pages/projects/project-aicacp.json`

```json
{
  "slug": "project-aicacp",
  "title": "AICACP",
  "subtitle": "The AI Capabilities & Alignment Consensus Project — reshaping the conversation around AI capabilities, alignment, and regulation.",
  "audience": "Researchers, practitioners, and policy-oriented contributors interested in AI capabilities, alignment, world models, and agency.",
  "lede": "AICACP — the AI Capabilities & Alignment Consensus Project — is a multi-year initiative designed to reshape the conversation around AI capabilities, alignment, and regulation.",
  
  // Non-empty primary actions; at least one uses sourceId
  "primaryActions": [
    { "label": "Project document", "sourceId": "aicacp-project-doc" },
    { "label": "ReInference Unit", "href": "/reinference/" }
  ],
  
  // Body sections: heading + prose + optional links
  "sections": [
    {
      "heading": "Survival and Flourishing Fund grant",
      "body": "In June 2025, the Survival and Flourishing Fund awarded a $270,000 grant…",
      "links": [{ "sourceId": "aicacp-project-doc" }]
    },
    {
      "heading": "About the project",
      "body": "AICACP is a multi-year initiative…",
      "links": [{ "label": "ReInference Unit", "href": "/reinference/" }]
    }
  ],
  
  // Optional card grid
  "cards": [
    {
      "title": "Defined scope",
      "text": "A clear project focus agreed at the start.",
      "links": [{ "sourceId": "aicacp-project-doc" }]
    }
  ],
  
  // Sort order in listings
  "order": 21,
  
  // Cross-links and pager
  "relatedSlugs": ["reinference", "projects", "active-inference"],
  
  // EVERY sourceId used on the page MUST be listed here
  "externalSourceIds": ["aicacp-project-doc", "discord"],
  
  // Resource categories to filter/display resources
  "resourceGroups": ["projects", "research"]
}
```

---

## Page Inventory

Every `.json` file under `src/content/pages/` (any subfolder) is a routable page.
For the live inventory (slug, title, route) rather than a hand-maintained snapshot
that inevitably drifts, generate it on demand:

```bash
# Count all pages
find src/content/pages -name '*.json' | wc -l

# List every slug + title (requires the site to have run `npm run build` at least
# once so src/data.mjs's module resolution works, or use a one-off node -e)
node -e "
import('./src/data.mjs').then(({ siteData }) => {
  for (const p of siteData.pages) console.log(p.slug.padEnd(45), p.title);
});
"

# Or via the generated HTML sitemap, which lists every routed page with its title:
open sitemap/index.html   # after npm run build
```

See [SLUG_AND_URL_TAXONOMY.md](SLUG_AND_URL_TAXONOMY.md) for how each slug shape
(`project-*`, program-subpage slugs, everything else) maps to its output directory.

---

## Build Process & URL Generation

**Source of Truth**: `src/url-taxonomy.mjs` (`baseDirForSlug()` function)

**Folder nesting is ignored entirely**:
1. `src/data.mjs` recursively walks `src/content/pages/` and all subdirectories
2. Every `.json` file found is loaded; folder structure doesn't affect output
3. Each page's `slug` is looked up in `url-taxonomy.mjs`
4. Output path is determined **solely by slug shape**

**Verification**: The Python contract checker (`scripts/check_site_contract.py`) uses the same `url-taxonomy.json` for validation, ensuring JS build and Python checks align.

---

## Security & Validation Gates

Run before committing:

```bash
node src/build.mjs     # Build HTML
npm run check          # Run all validation gates:
                       #   check:links     — all sourceIds exist, URLs reachable
                       #   check:security  — no raw external hrefs (must use sourceId)
                       #   check:design-system  — design compliance
                       #   check:site      — page schema validation
                       #   check:instituteos   — instituteos/ data contract
```

**Link Rules**:
- Every `sourceId` used on a page must be listed in `externalSourceIds[]`
- External links must use `sourceId` (must exist in `live-sources.json`)
- Internal links can use `{ "label", "href" }` with clean absolute paths only
- `resourceGroups[]` values must be valid live-source category IDs

**Constraints**:
- Strict Content Security Policy: no inline script/style, no `iframe`/`object`/`embed`/`form`
- Page-specific JS belongs in `assets/js/*.js` and is conditionally referenced from `src/render/layout.mjs`
- No client-side fetch; all dynamic behavior pre-rendered or scripted at build time

---

## Page Authoring Workflow

**To Add or Edit a Page**:

1. Create or edit a JSON file under `src/content/pages/<folder>/` (folder is optional for organization)
2. Include all **required fields** (slug, title, subtitle, audience, lede, primaryActions, sections, order, externalSourceIds)
3. For external links: use `{ "sourceId": "..." }` only; ensure the sourceId exists in `live-sources.json`
4. For internal links: use `{ "label": "...", "href": "/clean/path/" }` (no domain, absolute paths)
5. Add every used `sourceId` to `externalSourceIds[]`
6. Run:
   ```bash
   node src/build.mjs
   npm run check
   ```
7. Verify the built page at its output URL (e.g., `/about/index.html` for slug `about`)
8. Commit only the JSON source; built HTML is auto-generated

**Folder Organization Guidance**:
- Use `pages/institute/` for institutional, governance, and unit/year pages
- Use `pages/domains/` for "Active Inference and X" domain-knowledge pages
- Use `pages/participate/` for entry points and participation pathways
- Use `pages/programs/` for structured program pages
- Use `pages/projects/` for per-project pages (prefix all slugs with `project-`)

---

## i18n (Internationalization)

Translated content lives in `src/content/i18n/`:
- `_strings.json` — master keys and English values
- Per-locale files (`es.json`, `ja.json`, `zh.json`, etc.) — translated strings

The build renders each page once per locale under a locale-specific prefix (default locale at root; others under `/<code>/`).

---

## Constraints & Non-Negotiables

1. **Slug uniqueness**: Every page slug must be unique across the entire site.
2. **URL immutability**: Once a page's URL is public, never change its slug (breaks links; use redirect middleware instead).
3. **Source-folder irrelevance**: Reorganizing source folders does not change URLs; only slug changes do.
4. **Link security**: Raw `href` to external sites fails the security check; must use `sourceId`.
5. **Build is the source**: Built HTML is committed but is derivative; always edit JSON sources.
