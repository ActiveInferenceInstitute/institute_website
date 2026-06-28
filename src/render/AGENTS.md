# Agent Guide — `src/render/`

HTML-rendering modules for the static Active Inference Institute site. The build
(`node src/build.mjs`) reads JSON under `src/content/`, calls these modules to
produce markup, and writes HTML to the repo ROOT (`about/index.html`,
`projects/<slug>/index.html`, flat `index.html`, `404.html`). Built output is
committed — GitHub Pages serves the repo root of `main`. **Edit these modules and
the content JSON; never edit a built `*/index.html`.**

Every page wraps its body in [`layout()`](layout.mjs). The strict CSP
([`security.mjs`](security.mjs)) forbids inline script/style, iframes/objects,
forms, and any client-side fetch (`connect-src 'none'`), so all page behaviour
ships as external `assets/js/*.js` referenced conditionally from `layout()`.

## The `layout()` contract — [`layout.mjs`](layout.mjs)

`layout({ title, description, currentDir, canonicalPath, body, bodyClass, slug,
robots, ogType, redirects })` returns a full `<!doctype html>` document: head
metadata, header (brand, `nav()`, search box, language switcher, theme/accent/TTS
controls), `<main>`, footer, and the shared `assets/js/*` script tags.

Key behaviours:

- **Relative depth.** `relPrefix(currentDir)` ([`urls.mjs`](urls.mjs)) computes
  the `../` hops to site root so every asset/href resolves from any directory.
- **Page-specific JS is injected conditionally by scanning the rendered body**,
  not by a flag the caller must remember:
  - body contains `graph-mount` → emit `assets/css/graphs.css` +
    `assets/js/graphs.js`.
  - body contains `search-page-mount` → emit `assets/js/search-page.js` (the
    dedicated `/search/` page only).
  - `redirects: true` → emit `assets/js/redirects.js` with a `data-base`
    **absolute** base path. Passed only for `404.html`, GitHub Pages' catch-all
    for unmatched (legacy Squarespace) URLs; absolute base survives deep paths.
- **Canonical + SEO.** `canonicalUrl` derives from `currentDir` (or
  `canonicalPath` override for the flat 404) via `absoluteUrl()`, which is rooted
  at `siteData.site.baseUrl` (`https://activeinference.institute/`). Head also
  emits OG/Twitter tags, `ogImageForSlug(slug)`, hreflang alternates, and
  `structuredData(...)` — all from [`seo.mjs`](seo.mjs).
- **i18n.** Locale comes from `activeLocale()`; the language switcher and
  `hreflang` alternates are pure markup (CSP-safe). Non-default machine-translated
  locales render an honest provenance note linking the English original.

## Link resolution — [`links.mjs`](links.mjs)

A link descriptor is **either** `{sourceId}` **or** `{label, href}`. `resolveLink`:

- `{sourceId}` → `sourceFor(id)` looks up `liveSourceById` and returns the source
  only when `source.ok`; the public `href` is the registered URL, `label` falls
  back to the source label, and the link is marked `external`. An unknown/failed
  source resolves to `null` and is dropped. This is why content-page external
  links **must** use `{sourceId}` against `src/content/live-sources.json` — a raw
  external `href` has no registered source and is filtered out by the gate.
- `{label, href}` → passed through; `externalHref()` decides if it is external
  (used for internal absolute clean paths like `/structure/`).

`resolveLinks` maps + filters `null`s. Consumers ([`page-sections.mjs`](page-sections.mjs))
add `linkAttrs()` (`target="_blank" rel="noopener noreferrer"`) for external hrefs.

## SEO / security / URLs

- [`seo.mjs`](seo.mjs) — `structuredData()` (Organization/WebSite, BreadcrumbList,
  per-project `SoftwareSourceCode`/`CreativeWork`, collection ItemList for hubs),
  `metaDescription()` clipping, per-slug OG cards, JSON-LD escaping. `sameAs` and
  all URLs derive from verified sources / `absoluteUrl()` — no hardcoded literals.
- [`security.mjs`](security.mjs) — single source of the `cspContent()` string
  emitted into every `<head>`.
- [`urls.mjs`](urls.mjs) — `relPrefix`, `absoluteUrl`, `externalHref`,
  `resolveInternalHref` (maps legacy `<slug>.html` and root-absolute `/dir/`
  references back through the slug taxonomy), and `isVerifiedExternalUrl`.
- [`metadata.mjs`](metadata.mjs) — `buildManifest()` (PWA) and
  `buildSecurityTxt()` root files.

## Other modules

| Module | Role |
| --- | --- |
| [`pages.mjs`](pages.mjs) | Assembles the home page and each public content page from the page schema. |
| [`page-sections.mjs`](page-sections.mjs) | `nav`, `socialLinks`, `actionButtons`, `linkChips`, `linkList` — resolved-link renderers. |
| [`components.mjs`](components.mjs) | Shared `sectionHeading`, `cardGrid`, `breadcrumb`, `pageGuide` primitives. |
| [`feature-sections.mjs`](feature-sections.mjs) | InstituteOS feature bands and the home export gate. |
| [`tables.mjs`](tables.mjs) | Tabular renderers for directory/registry data. |
| [`knowledge.mjs`](knowledge.mjs) | Open Source Map tables and per-page knowledge previews. |
| [`narrative.mjs`](narrative.mjs) | Narrative-prose section rendering. |
| [`resources.mjs`](resources.mjs) | Resource-card grids (filterable / compact). |
| [`search.mjs`](search.mjs) | Search-page mount markup and embedded index hooks. |
| [`sources.mjs`](sources.mjs) | Live-source presentation helpers. |
| [`text.mjs`](text.mjs) | Small text/markup helpers local to rendering. |
| [`icons.mjs`](icons.mjs) | Inline SVG `cardIcon` glyphs. |
| [`forms.mjs`](forms.mjs) | Placeholder — no `<form>` is emitted (CSP forbids forms). |
| [`pager.mjs`](pager.mjs) | Prev/next pager for public content pages. |

## Before committing

Run `npm run check` (check:links, check:instituteos, check:design-system,
check:site, check:security — all offline). The security/links gates reject
unregistered external anchors, inline JS/CSS, and CSP violations.
