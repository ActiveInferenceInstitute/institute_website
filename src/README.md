# `src/` — build engine and content

Source of truth for the Active Inference Institute website. The static generator
(`node src/build.mjs`) reads the JSON under `content/` and writes clean-URL HTML
and crawler files to the **repository root**, which GitHub Pages serves from
`main`. The generated `*/index.html` is committed but must never be hand-edited
— edit here and rebuild.

The enforced contract for this folder is [`AGENTS.md`](AGENTS.md); this file is a
short orientation only.

## What is inside

- [`build.mjs`](build.mjs) — entry point; assembles every page renderer and loops
  once per locale.
- [`data.mjs`](data.mjs) — the single load-time-stateful module; loads
  `content/*.json` and builds the derived maps.
- [`url-taxonomy.mjs`](url-taxonomy.mjs) + [`url-taxonomy.json`](url-taxonomy.json)
  — the load-bearing slug → output-directory mapping shared with the Python gate.
- [`redirects.mjs`](redirects.mjs) / [`redirect-runtime.js`](redirect-runtime.js),
  [`public-links.mjs`](public-links.mjs), [`indexing-policy.mjs`](indexing-policy.mjs)
  — redirect stubs, external-link policy, and canonical/hreflang policy.
- [`render/`](render/) — HTML rendering modules and the CSP-safe `layout()` shell.
- [`lib/`](lib/) — low-level helpers (file writes, paths, text, resources).
- [`content/`](content/) — JSON registries plus `pages/` (per-page content) and
  `instituteos/` (sanitized public slices).
- [`pages/`](pages/) — registry-derived standalone page renderers.
- [`i18n/`](i18n/) — locale registry and the active-locale switch.

## Run it

```bash
npm run build    # node src/build.mjs — render the whole site
npm run check    # all offline gates (see ../docs/GATES_AND_VALIDATION.md)
```

Conceptual guides live in [`../docs/README.md`](../docs/README.md); the full repo
map is [`../INDEX.md`](../INDEX.md).
