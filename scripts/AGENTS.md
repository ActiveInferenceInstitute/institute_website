# Agent Guide — `scripts/`

Tooling for the static Active Inference Institute website. The build itself is
[`../src/build.mjs`](../src/build.mjs) (`node src/build.mjs`) — it reads JSON
under [`../src/content/`](../src/content/) and writes HTML to the repo **root**
(`about/index.html`, `projects/<slug>/index.html`, flat `index.html`, `404.html`,
…). That built output is committed because GitHub Pages serves the repo root of
`main`. **Edit source, never the built `*/index.html`.** These scripts validate,
sync, and translate that source. Run gates with no network access.

## npm scripts ([`../package.json`](../package.json))

| Command | Runs |
| --- | --- |
| `npm run build` | `node src/build.mjs` — render HTML + crawler files |
| `npm run check` | `node --check` the build, `py_compile` every checker, then `check:links` → `check:instituteos` → `check:design-system` → `check:site` → `check:security` |
| `npm run check:links` | [`check_internal_links.py`](check_internal_links.py) |
| `npm run check:instituteos` | [`sync_instituteos_public_data.py`](sync_instituteos_public_data.py) `--check` |
| `npm run check:design-system` | [`check_design_system_export.mjs`](check_design_system_export.mjs) |
| `npm run check:site` | [`check_site_contract.py`](check_site_contract.py) |
| `npm run check:security` | [`check_static_security.py`](check_static_security.py) |
| `npm run check:sources` | [`check_live_sources.py`](check_live_sources.py) — **network; NOT part of `check`** |
| `npm run sync:instituteos` | `sync_instituteos_public_data.py` (writes) |
| `npm run i18n:extract` | `I18N_EXTRACT=1 node src/build.mjs` → `src/content/i18n/_strings.json` |
| `npm run i18n:translate` | [`i18n_translate.mjs`](i18n_translate.mjs) |

`npm run check` is the offline gate (Python + Node, no network). Run it before
committing any content or build change.

## The check gates

### [`check_internal_links.py`](check_internal_links.py) (`check:links`)
Parses every generated `*.html` (skipping `src`, `scripts`, `simulations`, etc.)
and resolves each `href`/`src`/`poster` against the repo root. Flags references
to missing files and `#fragment` links whose anchor does not exist in the target
document. It derives the deployment base prefix from `site.json`'s `baseUrl`
(`site_base_prefix`) and strips it before resolving absolute paths, so it tracks
the canonical domain automatically.

### [`check_site_contract.py`](check_site_contract.py) (`check:site`)
The large content/structure gate. Reads the canonical origin from
`site.json` `baseUrl` (`_canonical_base`, single source of truth — never
hardcoded). Mirrors the clean-URL taxonomy from
[`../src/url-taxonomy.json`](../src/url-taxonomy.json) and i18n locales from
`../src/i18n/locales.json`. Enforces, among much else:
- `version.json` matches `package.json` version and the sitemap route count.
- Content model: `navigation.json` dropdowns, required `live-sources.json` ids,
  no Coda/Governance sources, registry field shapes, audience pathways, exact
  record counts in the synced `instituteos/*.json`, and the curated/resource/
  knowledge/directory page contracts.
- Canonical/`og:url` URLs, required `instituteos-ds.css` → `styles.css` link
  order, and that every external anchor on a content page is backed by
  `live-sources.json` (or a vetted host).

### [`check_static_security.py`](check_static_security.py) (`check:security`)
The strict CSP/static-safety gate. Every generated page must carry the
`Content-Security-Policy` meta (`default-src 'self'`, `script-src 'self'`,
`connect-src 'none'`, `object-src 'none'`, `form-action 'none'`,
`upgrade-insecure-requests`, …) and a `strict-origin-when-cross-origin`
referrer. Rejects inline `<script>`/style, inline `on*` handlers,
`<form>/<iframe>/<object>/<embed>`, external scripts/stylesheets/images, images
without `alt`, direct Coda anchors, and external anchors missing
`target="_blank"` + `rel="noopener noreferrer"` or not backed by
`live-sources.json` / a vetted host (`youtube.com`, `zoom.us`, `github.com`, …).
Page-specific JS must be an external `assets/js/*.js` file referenced from
`src/render/layout.mjs`.

### [`check_design_system_export.mjs`](check_design_system_export.mjs) (`check:design-system`)
Validates `assets/css/styles.css` token fallbacks against the committed
`assets/css/instituteos-ds.css`. When the design-system source is present
(`../../library/design-system`, override `INSTITUTEOS_DS_ROOT`) it re-exports and
byte-compares to catch a stale committed CSS; in a standalone checkout it skips
the freshness comparison and validates only the self-contained tokens.

## [`sync_instituteos_public_data.py`](sync_instituteos_public_data.py)

Projects public-safe slices of the InstituteOS registries into
`src/content/instituteos/*.json` plus brand-only assets into
`assets/img/instituteos/`. Locates the registry source via `INSTITUTEOS_ROOT`
(or `--instituteos-root`, else auto-detected parent/sibling checkout).

- **write** (`sync:instituteos`): sanitizes people/projects/ideas/ontology/
  entities/processes/communications/policies (and optional `calendar.json`),
  then writes.
- **`--check`** (`check:instituteos`): rebuilds payloads in memory and fails on
  any stale/missing file. With no registry source available and no explicit
  root, it falls back to validating the already-committed payloads.

**Public-safety payload validation** (`validate_public_payload`) is the boundary
guard: it serializes each payload and raises on any blocked private key
(`email`, `phone`, `contacts`, `slack`, …), forbidden substring (`coda.io`,
`/users/`, `workspace`, `aii.pdf`, …), or email-pattern match. `public_text`
scrubs sensitive wording, and per-record `record_is_public_safe` drops a single
colliding row so the surviving payload passes untouched.

## [`check_live_sources.py`](check_live_sources.py) (`check:sources`)

The **only networked** checker, deliberately excluded from `npm run check`.
`curl`s every entry in `src/content/live-sources.json` and compares the live
HTTP result against the recorded `ok`/`statusCode`/`finalUrl`. `--write` updates
those fields plus `lastCheckedAt`; default is read-only verification.

## [`i18n_translate.mjs`](i18n_translate.mjs) (`i18n:translate`)

Offline translation: turns `src/content/i18n/_strings.json` (from
`npm run i18n:extract`) into per-locale `src/content/i18n/<code>.json`. Runs
**only outside** the build, so the build stays pure, deterministic, and
CSP-safe. Default engine is local Ollama; an OpenAI-compatible provider can be
selected via `I18N_PROVIDER`/`I18N_API_*`. Catalogs merge incrementally — a
re-run only fills missing keys (`--force` re-does all). Flags: `--locale`,
`--all`, `--model`, `--limit`, `--force`.

## Other scripts

`generate-project-pages.mjs`, `generate-cards.mjs`, and `generate-icons.sh` are
content/asset generators, not gates; they are not part of `npm run check`.
