# INDEX.md — institute_website

Static, zero-runtime-dependency site for the Active Inference Institute. `node src/build.mjs` renders JSON content into clean-URL HTML that is **committed at the repo root** and served by GitHub Pages. CI fails if committed HTML != `build(source)`.

> **Load-bearing invariant:** a page's output URL derives from its `slug`, **not** its source file path. Never hand-edit built `*.html` — edit `src/` and rebuild. See [docs/SLUG_AND_URL_TAXONOMY.md](docs/SLUG_AND_URL_TAXONOMY.md).

## Top-level map

| Entry | Kind | Edit? | Purpose |
| --- | --- | --- | --- |
| `src/` | SOURCE | yes | Build engine + content. `build.mjs`, `data.mjs`, `feeds.mjs`, `render/`, `pages/`, `lib/`, `i18n/`, `content/`. See [src/AGENTS.md](src/AGENTS.md) |
| `scripts/` | SOURCE | yes | Build/gate/sync scripts (`check_*.py`, `sync_instituteos_public_data.py`, `i18n_translate.mjs`). See [scripts/AGENTS.md](scripts/AGENTS.md) |
| `assets/` | SOURCE | yes | CSS / JS / images (`css/styles.css`, `css/graphs.css`, `js/site.js`). See [assets/AGENTS.md](assets/AGENTS.md) |
| `data/` | CONFIG | yes | Build provenance (`export-manifest.json`) + `projects.json` feed. See [data/README.md](data/README.md) |
| `docs/` | DOCS | yes | 11 conceptual guides — **start at [docs/README.md](docs/README.md)** |
| `.claude/` | TOOLING | yes | `skills/institute-website/` skill + Workflows |
| `.github/` | CONFIG | yes | CI (builds, runs `npm run check`, asserts committed HTML parity) |
| `node_modules/` | TOOLING | never | npm-managed, gitignored — not build output |
| `Plans/` | LOCAL | never | Untracked scratch (remove or `.gitignore`) |
| **all other tracked root dirs** — `about/`, `active-inference/`, `activities/`, `calendar/`, `directory/`, `ecosystem/`, `eduactive/`, `get-involved/`, `grants/`, `history/`, `instituteos/`, `knowledge/`, `learning/`, `measure/`, `prepare/`, `programs/`, `projects/`, `reinference/`, `resources/`, `search/`, `simulations/`, `sitemap/`, `strategy/`, `structure/`, `video/`, `volunteer/`, `weekly/`, `years/`, and locales `ar/ de/ es/ fr/ hi/ it/ ja/ ko/ pt/ ru/ zh/` | OUTPUT | **never** | **Generated, tracked HTML — regenerate via `node src/build.mjs`** |
| `index.html` `404.html` `sitemap.xml` `feed.json` `feed.xml` `version.json` `manifest.webmanifest` `robots.txt` `.nojekyll` | OUTPUT | never | Generated root files |
| `CNAME` `package.json` `package-lock.json` `.gitignore` | CONFIG | yes | Domain + npm/build config |
| `README.md` `AGENTS.md` `INDEX.md` `CHANGELOG.md` `CONTRIBUTING.md` `TODO.md` `RELEASING.md` `MIGRATION.md` `SWITCHOVER.md` `GATING.md` `DESIGN_SYSTEM.md` `INTERNATIONALIZATION.md` | DOCS | yes | Root docs (see Doc map) |

## Build & gates

```bash
npm install
node src/build.mjs          # render content -> committed HTML
npm run check               # all gates (run before commit)
```

`npm run check` = `check:links` (built HTML internal links) + `check:instituteos` (public-data parity/safety, `sync_instituteos_public_data.py --check`) + `check:design-system` (token parity) + `check:site` (`check_site_contract.py`, incl. `version.json`==`package.json`) + `check:security` (`check_static_security.py`, CSP + no coda.io/PII in HTML). Extra: `npm run sync:instituteos`, `npm run check:sources`, `npm run i18n:extract`, `npm run i18n:translate`.

## Doc map

- **Start here for concepts:** [docs/README.md](docs/README.md) → ARCHITECTURE, SLUG_AND_URL_TAXONOMY (load-bearing), CONTENT_AUTHORING, REGISTRIES, GATES_AND_VALIDATION, MIGRATION_AND_REDIRECTS, INTERNATIONALIZATION, DESIGN_SYSTEM, GETTING_STARTED, TROUBLESHOOTING.
- **Operating contracts:** per-folder `AGENTS.md` in root, `src/`, `src/render/`, `src/lib/`, `src/content/`, `src/content/pages/`, `scripts/`, `assets/`.
- **Root longform:** [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md), [TODO.md](TODO.md), [RELEASING.md](RELEASING.md), [GATING.md](GATING.md).
- **Skill:** `.claude/skills/institute-website/SKILL.md` + Workflows.
- **Doc precedence:** per-folder `AGENTS.md` = enforced contract · root longform = canonical narrative · `docs/` = conceptual guide.

## Gated public-release relationship

This repo is a **gated, sanitized public projection** of the private InstituteOS docs and library. It must EXCLUDE nonpublic rosters, private operational fields, raw task detail, working documents, demos/recordings, internal UI captures, and resolved Coda destinations (render `*.activeinference.institute` shortlinks instead). Structured public data lands in `src/content/instituteos/*.json` via **two producers**: (1) `scripts/sync_instituteos_public_data.py` emits ~10 registry slices through field-whitelist sanitizers + `validate_public_payload` (PRIVATE_KEYS / FORBIDDEN_SUBSTRINGS / email denylist), enforced by `check:instituteos`; (2) a separate private InstituteOS export emits the graph/narrative slices (`*_graph.json`, `narratives_public.json`, `domain_projects.json`, `communications_public.json`). A second independent gate, `check_static_security.py`, blocks direct `coda.io` anchors and forces external links through the `live-sources.json` allowlist in rendered HTML. See [GATING.md](GATING.md) and [src/content/instituteos/README.md](src/content/instituteos/README.md).

## How to version & improve

- **Single source of truth:** `package.json` `version` → `src/data.mjs` `SITE_VERSION` → `src/build.mjs` writes `version.json` `{site_version, built_at, source_fingerprint (from data/export-manifest.json), pages, commit}` and stamps every page. `feed.json`/`feed.xml` (`src/feeds.mjs`) carry no version. `check:site` asserts `version.json` site_version == `package.json` version.
- **SemVer policy (content site):** patch = copy/link/data fix + rebuild · minor = new pages/sections/locale · major = URL-taxonomy or domain/baseUrl change requiring redirects.
- **Release checklist:** edit source → `node src/build.mjs` → `npm run check` → commit source AND all regenerated HTML together → bump `package.json` → rebuild (refresh `version.json`) → add dated `## vX.Y.Z` CHANGELOG section (empty `## Unreleased`) → `git tag -a vX.Y.Z` → push to `origin`. Full procedure: [RELEASING.md](RELEASING.md).
- **Improve loop:** reproduce/observe → edit `src/` → rebuild → `npm run check` → commit source + HTML → release when shipped to main.
- **Submodule push:** this repo is a git submodule of the private monorepo but commits/pushes **directly to its public upstream `origin`** (github.com/ActiveInferenceInstitute/institute_website). Never include private paths, tool names, or internal context in any committed file.
