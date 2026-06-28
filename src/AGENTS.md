# Agent Guide — `src/` Build Pipeline

This directory is the static-site generator. Run it with `node src/build.mjs` from
the repo root. It reads JSON under [`content/`](content/) and writes HTML and
crawler files to the **repository root** (`about/index.html`,
`projects/<slug>/index.html`, plus flat `index.html` and `404.html`). Built output
is committed — GitHub Pages serves the root of `main`. Edit sources here; never
hand-edit a generated `*/index.html`.

## Entry: `build.mjs`

`build()` assembles `slugRenderers`, a list of `[slug, render]` pairs:

- `["index", homePage]` — the home page, the only root `index.html`.
- one entry per `siteData.pages` page → `() => publicPage(page)`.
- standalone renderers: `knowledge`, `resources`, `directory`, `search`,
  `simulations`, `calendar`, `sitemap`.
- one entry per `ecosystemDomainPages()` domain page.

Then it loops:

```js
for (const locale of LOCALES) {
  setActiveLocale(locale.code);
  for (const [slug, render] of slugRenderers) {
    writeFile(outputPathForSlug(slug), render());
  }
}
```

Every renderer derives its current directory from the locale-aware taxonomy, so
the active-locale switch is the **only** thing that moves the whole site: the
default locale writes to root, each non-default locale to its own `/<code>/`
subtree. No per-renderer changes are needed.

**Root singletons** emit once (default-locale pass only), after the loop:
`404.html` (flat root file, GitHub Pages requirement; `robots: noindex`,
`redirects: true`), `robots.txt`, `sitemap.xml` (priority/changefreq keyed on URL
depth), `version.json`, `feed.xml`, `feed.json`, `manifest.webmanifest`,
`.well-known/security.txt`, and `assets/js/search-data.js`. With `I18N_EXTRACT=1`
it also dumps translatable strings to `content/i18n/_strings.json`.

## Load-time data: `data.mjs`

The single load-time-stateful module — it performs the big site-data load and
builds the derived maps as top-level side effects, importing only node builtins so
it is a pure leaf in the import graph (no value cycles). Everything that needs
site data imports from here.

- `siteData` — all `content/*.json` (`site`, `navigation`, `liveSources`,
  `resources`, `repositories`, …), the nested `instituteos` public slices, and
  `pages` (every `.json` under `content/pages/`, walked recursively via
  `walkPageJson` and sorted by `order` then `slug`). Folder nesting under
  `pages/` never affects output URLs — the page `slug` is the identity.
- Provenance: `SITE_VERSION` (from `package.json`), `SOURCE_FINGERPRINT` and
  `EXPORTED_AT` (from `data/export-manifest.json`) — byte-stable per export, not
  per build run.
- Derived maps: `liveSourceById`, `liveSourceUrlSet` (gates raw external anchors),
  `pageBySlug`, `typeById`, `categoryById`, `audienceById`, and the
  `ALL_ROUTED_SLUGS` list.

## URL taxonomy: `url-taxonomy.mjs`

Single source of truth for slug → directory. The output file is always
`<dir>/index.html`; the canonical URL is `/<dir>/` (root `""` for home).

- `baseDirForSlug(slug)` — locale-agnostic mapping: `"index"` → `""`,
  `"project-x"` → `projects/x`, program-subpage slugs → `programs/<slug>`,
  everything else → `<slug>`. Program slugs come from the committed
  [`url-taxonomy.json`](url-taxonomy.json), shared with the Python contract checker.
- `localePrefix` / `localeDirForSlug` / `urlDirForSlug` — apply the active-locale
  prefix (`""` for default, `<code>/` otherwise) to the base dir.
- `outputPathForSlug(slug)` — the `<dir>/index.html` write target used by `build`.
- `hrefForSlug(target, currentDir, anchor)` — caller-relative clean href (always
  trailing `/`); `crossLocaleHref` is the language-switcher variant; `parseFlatHref`
  resolves legacy `<slug>.html` literals through the taxonomy.

## Subdirectory map

- [`render/`](render/) — page renderers and the `layout()` shell (CSP-safe HTML,
  SEO/metadata, search index, feeds-adjacent helpers).
- [`lib/`](lib/) — low-level helpers (`output.mjs` writeFile, `paths.mjs`,
  `text.mjs`, `resources.mjs`, `instituteos.mjs`).
- [`content/`](content/) — JSON content sources (site config + `pages/` + the
  `instituteos/` public slices).
- [`content/pages/`](content/pages/) — per-page JSON (schema: `slug`, `title`,
  `sections[]`, `cards[]`, `primaryActions[]`, `externalSourceIds`, …).
- [`i18n/`](i18n/) — locale registry and the active-locale switch / string
  extraction.
- [`pages/`](pages/) — standalone page renderers (`directory`, `resources`,
  `search`, `simulations`, `calendar`, `sitemap`, `ecosystem`).

## Verify

Run `npm run check` before committing — it runs the link, instituteos, design-system,
site-contract, and security gates (Python + Node, no network).
