# Workflow: Add or Edit a Content Page

Add or edit a content page in the Active Inference Institute website by writing JSON
under `src/content/pages/`, then rebuilding and gating. **Edit source JSON, never the
built `*/index.html`** — `node src/build.mjs` regenerates every HTML file from JSON.

## 1. Choose the slug and folder

The **slug** is the page identity and the only thing that controls its URL. Folder
nesting under `src/content/pages/` (e.g. `institute/`, `programs/`, `participate/`)
is for maintainer organization only — `src/data.mjs` walks the tree recursively and
ignores placement.

Slug → URL rule (`src/url-taxonomy.mjs`, `baseDirForSlug`):

| Slug             | URL              |
| ---------------- | ---------------- |
| `structure`      | `/structure/`    |
| `project-foo`    | `/projects/foo/` |
| a program slug   | `/programs/<slug>/` |
| `index`          | `/` (home)       |

Program slugs must be registered in `src/url-taxonomy.json` (`programSubpageSlugs`) —
that list is the shared source for both the JS build and the Python contract checker.
A new program subpage requires adding its slug there too.

To **edit**, open the existing `<folder>/<slug>.json`. To **add**, create a new
`.json` in the most fitting folder. Slugs must be unique across the whole tree.

## 2. Write the page to the schema

Every page is a flat JSON object:

```jsonc
{
  "slug": "my-page",              // identity → URL; unique, lowercase-hyphen
  "title": "My Page",
  "subtitle": "One-line framing of the page.",
  "audience": "Who this page is for.",
  "lede": "Opening paragraph shown beneath the title.",
  "primaryActions": [             // NON-EMPTY; ≥1 must be sourceId-backed
    { "label": "Primary thing", "sourceId": "official-fellowship" },
    { "label": "Internal page", "href": "/get-involved/" }
  ],
  "sections": [                   // body content, in order
    {
      "heading": "First Section",
      "body": "Prose paragraph(s).",
      "links": [ { "sourceId": "ecosystem" } ]
    }
  ],
  "cards": [                      // optional callout grid
    { "title": "Card", "text": "Short text.", "links": [ { "href": "/projects/" } ] }
  ],
  "order": 20,                    // sort order within nav/listings
  "relatedSlugs": ["programs", "get-involved"],
  "externalSourceIds": ["official-fellowship", "ecosystem"],
  "resourceGroups": ["participation", "projects"]
}
```

### Link descriptors

Every link (in `primaryActions`, `sections[].links`, `cards[].links`) is **either**:

- `{ "sourceId": "<id>" }` — a source registered in
  [`src/content/live-sources.json`](../../../../src/content/live-sources.json). Use
  this for **all external URLs**. A raw external `href` fails `check:security` /
  `check:site` even for vetted hosts. If the source is not yet registered, register
  it first — see [RegisterLiveSource.md](RegisterLiveSource.md).
- `{ "label": "...", "href": "/clean/path/" }` — an **internal** link only. Use
  absolute clean directory paths (`/structure/`, `/projects/`, `/structure/#officers`).

A `sourceId` link may add a `label` to override the source's default text.

### Required invariants (gated)

- `primaryActions` is non-empty.
- At least one `primaryAction` is backed by a `sourceId`.
- `externalSourceIds` lists every `sourceId` the page references.
- `relatedSlugs` point at real slugs (they render as "related" next actions).
- `resourceGroups[0]` becomes the filter for the page's "Filtered resources" link
  (`hrefForSlug("resources", …, group)`), so use a real resources group id.

## 3. No inline assets

The site runs a strict CSP: no inline `<script>`/`<style>`, no `iframe`/`object`/
`embed`/`form`, and no client-side fetch (`connect-src 'none'`). Page-specific JS must
be an external file under `assets/js/*.js`, referenced conditionally from
[`src/render/layout.mjs`](../../../../src/render/layout.mjs). Do not embed scripts in
page JSON.

## 4. Rebuild

```bash
node src/build.mjs      # or: npm run build
```

This reads the JSON and writes HTML to the repo **root** (`my-page/index.html`, etc.)
plus the flat `index.html` and `404.html`. The built output **is committed** —
GitHub Pages serves the repo root of `main` at <https://activeinference.institute/>.

## 5. Gate

```bash
npm run check
```

Runs `check:links`, `check:instituteos`, `check:design-system`, `check:site`, and
`check:security` (Python + Node, no network). Fix any reported slug, source, or CSP
violation and rebuild before committing both the source JSON and the regenerated HTML.

## References

- [RegisterLiveSource.md](RegisterLiveSource.md) — register an external `sourceId`.
- [`src/url-taxonomy.mjs`](../../../../src/url-taxonomy.mjs) — slug → URL routing.
- Reference pages: `src/content/pages/institute/structure.json`,
  `src/content/pages/programs/fellowship.json`.
