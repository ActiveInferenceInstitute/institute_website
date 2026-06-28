# Run Gates — Verify a Website Change

Use this workflow after editing any source under [`src/`](../../../../src/) — content
JSON, render templates, CSS, or page JS. The site is static and the built HTML at the
repository root is committed, so every change is a two-step loop: rebuild, then run the
offline gate suite.

## The two commands

```bash
node src/build.mjs   # regenerate all HTML + crawler files from src/content/
npm run check        # run the full offline gate suite (python + node, no network)
```

Always run the build first. The gates read the generated `*/index.html`, the root
`index.html`/`404.html`, `sitemap.xml`, `robots.txt`, and `version.json` — stale output
makes them fail (or pass) for the wrong reason. Never hand-edit built `*/index.html` to
make a gate pass; fix the source and rebuild.

## What `npm run check` runs

`check` first syntax-checks `src/build.mjs` (`node --check`) and `py_compile`s the five
checker scripts, then runs these sub-checks in order. Any non-zero exit fails the whole
chain.

| Sub-check | Command | Enforces |
| --- | --- | --- |
| `check:links` | [`scripts/check_internal_links.py`](../../../../scripts/check_internal_links.py) | No broken local links or missing asset references in generated HTML. |
| `check:instituteos` | [`scripts/sync_instituteos_public_data.py --check`](../../../../scripts/sync_instituteos_public_data.py) | The committed sanitized Open Source Map slices + brand assets match what the sync would produce; drift means re-run `npm run sync:instituteos`. |
| `check:design-system` | [`scripts/check_design_system_export.mjs`](../../../../scripts/check_design_system_export.mjs) | `styles.css` token fallbacks are intact; when the sibling DS source is present, byte-compares `instituteos-ds.css` to catch a stale committed copy. |
| `check:site` | [`scripts/check_site_contract.py`](../../../../scripts/check_site_contract.py) | The resource-hub content contract (see below). |
| `check:security` | [`scripts/check_static_security.py`](../../../../scripts/check_static_security.py) | Strict CSP meta tag (`script-src 'self'`, `connect-src 'none'`), referrer policy, and no `<form>`/`<iframe>`/`<object>`/`<embed>` or inline event-handler attributes. |

### What `check:site` covers

`check_site_contract.py` is the largest gate. It validates, against `CANONICAL_BASE`
read from [`src/content/site.json`](../../../../src/content/site.json) `baseUrl`:

- **Versioning** — `version.json` `site_version` matches `package.json`, and its `pages`
  count matches the `<loc>` count in `sitemap.xml`.
- **Content model** — required nav slugs, required live-source ids, registry record
  counts (resources, official pages, 52 repositories, people/projects/ideas), and that
  every content page has non-empty `audience`, `resourceGroups`, `primaryActions`,
  `relatedSlugs`, and `externalSourceIds`.
- **Curated pages** — each page renders the `next-actions`, `resources`,
  `official-pages`, `repositories`, and `related-pages` sections with cards, an `On this
  page` guide, and at least one verified external action.
- **Directory / knowledge / resources / instituteos** pages render their expected
  sections, filters, and row anchors.
- **Canonical + external links** — every page's `<link rel=canonical>` and `og:url`
  start with `CANONICAL_BASE`; sitemap/robots point at it. Every external anchor is
  either a registered live source (`sourceId`) or a vetted host suffix.
- **Hygiene** — no obsolete artifacts, no stale theme tokens, no direct `coda.io` URLs,
  no hardcoded external URLs in `build.mjs`.

## Reading failures

Each script prints a header then a `- ` bulleted list of every violation to stderr, e.g.:

```text
Site contract check failed:
- get-involved: missing required public content field primaryActions
- structure/index.html external anchor is not in live-sources.json: https://example.org/x
```

Fix the first cause, rebuild, and re-run — many bullets often share one root (a missing
content field, an unregistered external link, or stale built HTML). For an external-link
failure, add a `{sourceId}` entry to [`live-sources.json`](../../../../src/content/live-sources.json)
and reference it; a raw `href` to an external host fails even for vetted domains.

## Network verifier (not in the default gate)

`check:sources` (`python3 scripts/check_live_sources.py src/content/live-sources.json`)
is a **separate network probe** that re-fetches every live source to confirm it is still
reachable. It is intentionally excluded from `npm run check` so the gate stays offline
and deterministic. Run it manually when you add or edit a live source, and commit the
refreshed `ok` flags.
