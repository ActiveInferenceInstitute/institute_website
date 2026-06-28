# Agent Guide — `src/content/` Registries

This directory holds the JSON registries that drive the static site. `src/build.mjs`
reads them, merges sources, and writes HTML to the repo **root** (`index.html`,
`404.html`, `about/index.html`, `projects/<slug>/index.html`, …). Built output is
committed because GitHub Pages serves the repo root of `main`.

**Edit these JSON sources, never the built `*/index.html`.** After any change, run
`npm run build` then `npm run check` (link, instituteos, design-system, site, and
security gates — all local, no network).

The per-page content registry lives in [`pages/`](pages/) and has its own
`AGENTS.md`; this guide covers the flat registries plus the `instituteos/` and
`i18n/` subdirectories.

## Link contract (read first)

A link descriptor on any content page is **either**:

- `{ "sourceId": "..." }` — references an entry in [`live-sources.json`](live-sources.json), **or**
- `{ "label": "...", "href": "..." }` — only for internal clean paths like `/structure/`.

**[`live-sources.json`](live-sources.json) is the allowlist for every external anchor.**
A raw external `href` fails `check:security`, even for vetted hosts — external links must
go through a registered `sourceId`. Each source row carries the `url`, the verified
`finalUrl`, an `ok`/`statusCode` reachability check, and a `checkedAt` timestamp; only
reachable public links should be promoted.

## Registry reference

| File | Drives |
| --- | --- |
| [`site.json`](site.json) | Site identity: `name`, `tagline`, `email`, and the canonical `baseUrl` `https://activeinference.institute/`. Never substitute the old `*.github.io/institute_website` URL. |
| [`navigation.json`](navigation.json) | Header menus: an ordered array of `{label, items[]}`, each item `{label, slug, anchor?}`. Slugs resolve through `src/url-taxonomy.mjs`. |
| [`live-sources.json`](live-sources.json) | The external-anchor allowlist (see above). Every `sourceId` used anywhere must exist here. |
| [`official-pages.json`](official-pages.json) | Official Institute pages and subdomain shortlinks, keyed by `sourceId`, with `group`, `category`, `audience`, `priority`, and `promoted`/`shortlink` flags. |
| [`resources.json`](resources.json) | The resource directory: `types`, `categories`, `audiences`, `popularTags`, and `resources[]` (each a `sourceId` with `type`/`category`/`audience`/`tags`/`featured`). Official pages and repositories are merged in at build time. |
| [`repositories.json`](repositories.json) | Public `ActiveInferenceInstitute` GitHub repos refreshed from the GitHub API — `sourceId`, `name`, `category`, `projectFamily`, `repoType`, `language`, `stars`, `relatedSlugs`. |
| [`social.json`](social.json) | Ordered social channels as `{label, sourceId}` pairs (resolved through `live-sources.json`). |
| [`metrics.json`](metrics.json) | Headline `{value, label}` stat cards (nonprofit status, verified link count, repo count, community size, recordings). |
| [`audience-pathways.json`](audience-pathways.json) | Audience-specific routes (`newcomer`, `learner`, `researcher`, …), each with a `primaryHref` and `links[]` of `{label, sourceId}`. |

Resource-system files compose: `official-pages.json` + `resources.json` +
`repositories.json` all reference `live-sources.json` by `sourceId`, and the build
merges them into the rendered resource directory and shortlink surfaces.

## `instituteos/` — sync-generated public data

[`instituteos/`](instituteos/) holds public-safe JSON produced by
`scripts/sync_instituteos_public_data.py` (`npm run sync:instituteos`). These are
build-time inputs, never served directly. **Do not hand-edit them** — regenerate from
source and verify with `python3 scripts/sync_instituteos_public_data.py --check`.
Most files use a top-level `records` array; `entities.json` uses `people`/`organizations`
and `ontology.json` uses `trees`/`edges`. Private fields (contacts, email, rosters,
operational detail) are never present. See [`instituteos/README.md`](instituteos/README.md)
for per-file schemas.

## `i18n/` — locale catalogs

[`i18n/`](i18n/) holds translation catalogs (`_strings.json` keys plus per-locale
files like `es.json`, `ja.json`, `zh.json`). Edit `_strings.json` for new keys and keep
locale files in sync.

## Constraints

- **Strict CSP:** no inline script or style, no `iframe`/`object`/`embed`/`form`, no
  client-side fetch. Page-specific JS belongs in `assets/js/*.js` and is referenced
  conditionally from `src/render/layout.mjs`.
- Legacy Squarespace URLs are redirected by `assets/js/redirects.js`, loaded only on
  `404.html`.
- Keep all content visitor-facing; never publish internal paths, private tool names, or
  working-material artifacts in any registry.
