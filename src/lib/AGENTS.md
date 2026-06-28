# Agent Guide — `src/lib/`

Leaf helper modules for the static build. These are pure utilities: no
network, no client-side state, no hidden globals. The only side effect in the
whole directory is `output.mjs` writing a file. Import them from render and
build code; never reach around them.

The build is `node src/build.mjs`, which reads JSON under `src/content/` and
writes HTML to the repo **root**. Edit source here — never a built
`*/index.html`.

## Modules

### [`output.mjs`](output.mjs) — file output

The one module that touches the filesystem for writes.

- `writeFile(file, html)` — resolves `file` under the repo root, creates parent
  dirs, trims trailing horizontal whitespace per line (keeps output
  byte-stable), and writes UTF-8.

Use it for every generated artifact so committed output stays diff-clean.

### [`paths.mjs`](paths.mjs) — output path helpers

Pure path helpers over the repo root. Kept separate from `data.mjs` so
`output.mjs → paths.mjs → data.mjs` never becomes a value cycle.

- `out(...parts)` — `path.join(root, ...parts)`; build an absolute output path.
- `ensure(dir)` — recursive `mkdir`.

### [`text.mjs`](text.mjs) — string utilities

Dependency-free, data-free string helpers. Safe to unit-test in isolation.

- `escapeHtml(value)` — escape `& < > "` for interpolation into markup. Always
  the last step before emitting a value into HTML.
- `sanitizePublicProse(value)` — public-safe prose normalizer for free text from
  registries/narratives: strips markdown link syntax to its label, removes raw
  URLs, drops redacted-email placeholders, and neutralizes private-channel
  tokens. Output is **plain text** — still pass it through `escapeHtml`.
- `proseParagraphs(value)` — sanitize, then split into renderable paragraph
  strings (markdown list markers and blank lines become breaks; empties
  dropped).
- `slugifyAnchor(value)` — lowercase hyphen-separated anchor token.
- `title_case_token_js(value)` — title-case a snake/kebab token for labels.

Raw external URLs are scrubbed here on purpose: anchors must originate from
`src/content/live-sources.json` via a `sourceId`, never as bare URLs smuggled
through prose.

### [`instituteos.mjs`](instituteos.mjs) — Open Source Map data access

Reads `siteData.instituteos.*` slices (synced by
`scripts/sync_instituteos_public_data.py`) and shapes them into renderable rows.

- `brandAsset(theme)` — pick the brand mark for `"dark"`/`"light"`, or `null`.
- `instituteosCounts()` — record counts (people, projects, ideas, ontology,
  research, organizations, members, processes, publications, policies).
- `knowledgeSearchText(values)` / `knowledgeDataAttrs(kind, values)` — build the
  lowercased search blob and `data-knowledge-*` attributes that drive
  client-side filtering on the knowledge tables.
- Row builders, each `(limit = Infinity)` returning records decorated with a
  `rowId` (Directory anchor) and `dataAttrs`: `peopleRows`, `projectRows`,
  `ideaRows`, `ontologyRows`, `researchRows`, `entityOrgRows`,
  `entityPeopleRows`, `processRows`, `communicationRows`, `policyRows`.

### [`resources.mjs`](resources.mjs) — curated resource access

Normalizes the curated registries against `live-sources.json` so every rendered
resource resolves to a registered live source.

- `normalizeResource(resource, sourceKind)` — resolve `sourceId` via
  `sourceFor`; returns `null` if the source is unknown (so unregistered links
  drop out instead of leaking). Adds type/category/audience labels, `label`,
  `href` (from `publicHrefForSource`), `summary`, and tags.
- `normalizedCuratedResources()` / `normalizedOfficialPages()` /
  `normalizedRepositories()` — normalize each registry, dropping
  `promoted === false` and unresolvable entries.
- `allResourceEntries()` — merged, priority-then-label sorted.
- `uniqueEntries(entries)` — dedupe by `sourceId || href`.
- `recordMatchesPage(record, page)` — true when a record relates to a page via
  `relatedSlugs`, `resourceGroups`, or `externalSourceIds`.
- `entriesForPage(page, entries, limit = 8)` — filter + cap for a page.

## Rules

- Keep these modules pure. Filesystem writes live only in `output.mjs`; data
  reads come through `data.mjs`, not direct JSON reads here.
- Treat `sanitizePublicProse`/`escapeHtml` as mandatory for any registry-sourced
  text reaching HTML.
- A resource with no registered `sourceId` must resolve to `null` and disappear
  — do not add fallback raw hrefs; that breaks the security gate (`npm run
  check`).
