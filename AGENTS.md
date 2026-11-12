# Agent Guide — Active Inference Institute Website

This repository builds the public GitHub Pages website for the Active Inference Institute.
Canonical domain (post-cutover): **[https://activeinference.institute/](https://activeinference.institute/)**
(the Squarespace → Pages migration is complete; before the 2026-06 cutover the
site served at `activeinferenceinstitute.github.io/institute_website/`).
See [docs/MIGRATION_AND_REDIRECTS.md](docs/MIGRATION_AND_REDIRECTS.md).

## 30-second orientation

**What this repo is:** a static, zero-runtime-dependency website for the
Active Inference Institute, rendered by `node src/build.mjs` from JSON content
under `src/content/` into clean-URL HTML that is **committed at the repo root**
and served by GitHub Pages from `main`. Generated `*/index.html` must never be
hand-edited — edit `src/`, rebuild. The repo is a gated public projection of
private InstituteOS sources (see [GATING.md](GATING.md)).

**Read order:** this section → [INDEX.md](INDEX.md) (full repo map) → the
[`.claude/skills/institute-website/SKILL.md`](.claude/skills/institute-website/SKILL.md)
skill (task workflows) → the doc-map table below. Concepts live in
[docs/README.md](docs/README.md).

**The loop for any change:** edit `src/` (or docs) → `node src/build.mjs` →
`npm run check` → commit source **and** regenerated HTML together → push.
Never commit private paths or internal tool names — every commit is public.

Composable entry point: `./run.sh` defaults to the existing fast i18n selection.
Use `./run.sh lint`, `docs`, `build`, `full`, `browser` or `gnn` independently.
The [run guide](docs/RUN_GUIDE.md) defines prerequisites and shared CI ownership;
measured wall times live in generated [gate measurements](docs/GATE_MEASUREMENTS.md).

**Canonical commands (verbatim from `package.json`):**

| Command | What it does |
| --- | --- |
| `npm run build` | `node src/build.mjs` — render all public HTML + crawler files |
| `npm run check` | `check:syntax` followed by the `check:*` offline sub-gates below |
| `npm run check:browser` | Real Chrome calendar regression in all locales, including the original runtime-error negative control; requires `CHROME_BIN` |
| `npm run check:browser:all` | Sequential calendar, interaction/contrast and newsletter browser checks; isolated evidence outside the public checkout |
| `npm run i18n:extract` | `I18N_EXTRACT=1 node src/build.mjs` — extract translatable strings |
| `npm run i18n:translate` | `node scripts/i18n_translate.mjs` — offline translation (Ollama/hosted API) |
| `npm run i18n:check-terms` | `node scripts/i18n_check_terminology.mjs` — terminology QA report over the committed catalogs (`--fix` re-translates findings offline) |
| `npm run check:sources` | `python3 scripts/check_live_sources.py src/content/live-sources.json` — **networked**, outside the offline `check` chain |
| `npm run sync:instituteos` / `check:instituteos` | write / `--check` sanitized public data (`scripts/sync_instituteos_public_data.py`) |
| `npm run sync:transcripts` / `check:transcripts` | write / `--check` video transcript excerpts (`scripts/sync_video_transcripts.py`) |

**Offline gate table** (canonical commands in `package.json`; measurements are
generated separately, not maintained in this table):

| Gate | Checks |
| --- | --- |
| `check:links` | Local HTML/asset references and fragments |
| `check:md-links` | Markdown links, flat docs index and generated measurement freshness |
| `check:source-controls` | Python regression discovery and public-link policy |
| `check:sources:offline` | Source registry integrity without network |
| `check:citations` | Citation identity |
| `check:instituteos` | Public-data parity/safety |
| `check:export` | Export, indexing, browser-process and rendering controls |
| `check:design-system` | Token fallbacks and export parity |
| `check:site` | Generated content/structure contract |
| `check:feeds` | Feed/sitemap structure and targets |
| `check:security` | CSP, public-link and privacy policy |
| `check:redirects` | Redirect map/output parity |
| `check:indexability` | Generated crawler signals; regression modules run in source-controls |
| `check:projects` | Project discoverability |
| `check:catalog` | Catalog/page coverage |
| `check:i18n` | Translation helper and terminology logic |
| `check:standalone` | Public-payload verification without an upstream checkout |

Full gate reference with failure messages and fixes:
[docs/GATES_AND_VALIDATION.md](docs/GATES_AND_VALIDATION.md). Gating contract
for public data: [GATING.md](GATING.md). Deep docs are pointed at below and are
not duplicated here.

## Documentation map

Start here, then open the most specific doc for your task:

| Doc | Use it for |
| --- | --- |
| **[`.claude/skills/institute-website/SKILL.md`](.claude/skills/institute-website/SKILL.md)** | The invokable agent skill — golden rules + task workflows. Read this first for any change. |
| **[`INDEX.md`](INDEX.md)** | Top-level repository map: every entry tagged source/output/config/docs, build+gate commands, doc map, gating, versioning. The fastest orientation. |
| This file (`AGENTS.md`) | Operating contract, build/content/design model, gates. |
| [`README.md`](README.md) | Human-facing overview. |
| [`docs/README.md`](docs/README.md) | **Conceptual & navigation guides** (12 docs: ARCHITECTURE, SLUG_AND_URL_TAXONOMY, CONTENT_AUTHORING, GATES_AND_VALIDATION, …). Start here for the *why*. |
| [`GATING.md`](GATING.md) | The gated-public-projection contract: what flows from private sources, sanitizers, gates, exclusions. |
| [`RELEASING.md`](RELEASING.md) | How/where to version and cut a release (SemVer policy, checklist). |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Colors, tokens, the design-system export contract. |
| [`INTERNATIONALIZATION.md`](INTERNATIONALIZATION.md) | Locales, `tr()`, offline translation. |
| [`docs/MIGRATION_AND_REDIRECTS.md`](docs/MIGRATION_AND_REDIRECTS.md) | Redirects, pinned forwarding targets and current hosting/DNS state. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CHANGELOG.md`](CHANGELOG.md) · [`TODO.md`](TODO.md) | Contribution flow, history, backlog. |

> **Doc precedence:** per-folder `AGENTS.md` = enforced contract · root longform
> (`README`, `DESIGN_SYSTEM`, `INTERNATIONALIZATION`, …) = canonical narrative ·
> `docs/` = conceptual guide. When they disagree, the per-folder `AGENTS.md` wins.

Per-folder guides: [`src/AGENTS.md`](src/AGENTS.md) ·
[`src/render/AGENTS.md`](src/render/AGENTS.md) ·
[`src/lib/AGENTS.md`](src/lib/AGENTS.md) ·
[`src/content/AGENTS.md`](src/content/AGENTS.md) ·
[`src/content/pages/AGENTS.md`](src/content/pages/AGENTS.md)
(+ [`_TEMPLATES.md`](src/content/pages/_TEMPLATES.md)) ·
[`src/pages/AGENTS.md`](src/pages/AGENTS.md) ·
[`scripts/AGENTS.md`](scripts/AGENTS.md) ·
[`assets/AGENTS.md`](assets/AGENTS.md) ·
[`data/README.md`](data/README.md) ·
[`simulations/README.md`](simulations/README.md).

## Operating Contract

This is a public resource hub, not a working-material archive. Do not publish input artifacts, drafting screenshots, generated trace views, page extraction output, or downloadable working materials. Public copy may be informed by internal materials, but the current site must remain visitor-facing and navigable.

Public structured content must be injected only through `scripts/sync_instituteos_public_data.py`. The generated public slices may include externally visible GitHub profile rows, public repository rows, concept rows, ontology relationships, research links, and approved brand marks. They must not include nonpublic rosters, nonpublic stewardship records, private operational fields, raw task detail, working documents, demos, recordings, or internal UI captures.

The canonical remote is `origin`:

```bash
git remote get-url origin
```

Expected value:

```text
https://github.com/ActiveInferenceInstitute/institute_website.git
```

Any non-canonical remote, when present, is only a backup reference and should not be updated for this site.

## Build Model

The site is static:

- `src/build.mjs` renders all public HTML and crawler files.
- `src/content/*.json` and `src/content/pages/*.json` are the content sources.
- `assets/css/styles.css` defines the dark charcoal design system.
- `assets/js/site.js` handles navigation disclosure, resource filtering, popular tag chips, and repository sorting.
- `scripts/sync_instituteos_public_data.py` copies sanitized Open Source Map tables and brand-only assets into this repo.
- Generated root files are committed because GitHub Pages serves from `main` at repository root.

Since v2.0 the site serves clean URLs: every routed page is written as
`<section>/index.html` (and `<section>/<slug>/index.html` for child pages), so
the only flat HTML files at the repository root are `index.html` and `404.html`.

The site is multilingual: English is canonical at the root, and each other
locale in `src/i18n/locales.json` is pre-rendered into its own `/<code>/…`
subtree (e.g. `es/about/index.html`). Routing is locale-aware through a single
point (`urlDirForSlug` in `src/url-taxonomy.mjs`); render code wraps visible
English strings in `tr()` (`src/i18n/index.mjs`), which looks up committed
catalogs at `src/content/i18n/<code>.json` and falls back to English. Translation
is an **offline** step (`scripts/i18n_translate.mjs`, Ollama or a hosted API) —
never the build. When adding visible UI text, wrap the English source in `tr()`,
then run `npm run i18n:extract`. Full guide:
[INTERNATIONALIZATION.md](INTERNATIONALIZATION.md).

Generated public files should be limited to:

- `index.html` and `404.html` (the only flat HTML at the repository root)
- build-generated legacy redirect stubs and localized simulation filename stubs,
  inventoried in `data/redirects.json` (never overwrite real pages)
- curated pages as clean-URL directories — `<section>/index.html` and
  `<section>/<slug>/index.html` (e.g. `resources/`, `directory/`, `knowledge/`,
  `search/`, `sitemap/`, `projects/<name>/`, `programs/<name>/`,
  `ecosystem/<domain>/`)
- `robots.txt`
- `sitemap.xml` (XML sitemap) and the human-readable HTML sitemap at `sitemap/index.html`
- `feed.xml` and `feed.json` (RSS + JSON feeds)
- `manifest.webmanifest` (PWA manifest)
- `version.json` (machine-readable version + provenance)
- `.well-known/security.txt` (RFC 9116 responsible-disclosure contact)
- static CSS and JavaScript assets
- brand-only images under `assets/img/instituteos/`
- `.nojekyll`

## Content Model

Use `src/content/live-sources.json` as the canonical registry for volatile public URLs. Public resources, social links, page actions, section links, card links, official pages, and repository links should reference public destinations by `sourceId` whenever possible.

Do not render direct resolved Coda destinations in public pages. When an official `*.activeinference.institute` shortlink redirects to Coda, render the shortlink from `live-sources.json:url`; resolved redirect targets are never committed — `check:sources` resolves them live at check time and errors on any committed `finalUrl`.

The content model is split into registries:

- `src/content/resources.json` for curated resources, filter types, groups, and audiences.
- `src/content/official-pages.json` for reachable official Institute pages, `activeinference.org`, START, and public shortlinks/subdomains.
- `src/content/repositories.json` for reachable public `ActiveInferenceInstitute` repositories.
- `src/content/audience-pathways.json` for homepage visitor routes.
- `src/content/instituteos/*.json` for sanitized public GitHub people, repositories, ideas, ontology, and asset tables.
- `src/content/live-sources.json` for URL, status, and last-check data.

Refresh public Open Source Map data from public repository metadata and the default sibling concept-graph checkout:

```bash
npm run sync:instituteos
```

Check freshness without modifying files:

```bash
npm run check:instituteos
```

Curated page JSON files must include:

- `audience`
- `primaryActions`
- `resourceGroups`
- `relatedSlugs`
- `externalSourceIds`
- visitor-facing `sections`
- concise `cards`

Do not reintroduce fields that imply public page extraction or page-number traceability.

Every rendered external URL should resolve from `src/content/live-sources.json`. Keep unreachable public checks recorded only when they are useful context, and do not promote them into rendered cards unless the live check becomes reachable.

## Design Requirements

- Use dark mode by default.
- Use near-black backgrounds, gray surfaces, white text, muted gray secondary text, and red as the only accent color.
- Keep navigation accessible: click-disclosed dropdowns, keyboard focus, no hover-only paths, and mobile-friendly behavior.
- Every curated page must signpost locally, internally, and externally:
  - local section guide
  - related internal pages
  - related official pages
  - related repositories
  - verified public resources
- The resource directory must remain searchable and filterable by search, type, group, audience, and tag.
- The home page must expose audience pathways for newcomers, learners, researchers, developers, contributors, and partners/supporters.
- The resource directory must separate Featured, Official pages, Official shortlinks, Repositories, Learning/Research, Participation, and Full Directory views.
- The Full Directory filters should use popular tag chips/select options, not an exhaustive noisy tag list.
- The repository view must sort locally by updated date, stars, language, and group.
- The global directory must index every curated page, page section, resource group, official page, official shortlink, verified external link, and public repository.
- The Open Source Map must provide searchable/filterable tables for public GitHub people, repositories, research links, ideas, and ontology relationships, with accessible captions and Directory row-anchor links.
- Static security must stay simple: local scripts/styles only, CSP and referrer meta tags present, no forms or embedded frames, no inline event handlers, and external anchors backed by `src/content/live-sources.json`.
- External public links should render only internal GitHub Pages links, official Institute domains or shortlinks, GitHub repositories/pages, papers and research records, media/social/donation/contact links, or other verified public resources.

## Verification Gates

Run these before committing:

```bash
./run.sh build
./run.sh full
# Separately, after adding/changing external destinations:
npm run check:sources
git diff --check
```

For browser verification, serve from the repository root:

```bash
python3 -m http.server 4173
```

Check desktop home, Resources, Directory, Open Source Map, mobile navigation dropdowns, Projects, Get Involved, and 404. Confirm no console errors and no local missing-asset responses.

## Deployment

GitHub Pages serves from `main` at `/`. After a verified commit is pushed to `origin/main`, confirm the deployed site responds at:

- `/`
- `/resources/`
- `/directory/`
- `/knowledge/`
- `/projects/`
- `/get-involved/`
- `/search/`
- `/sitemap/`
- `/sitemap.xml`
- `/robots.txt`

The custom apex domain `activeinference.institute` is configured via the `CNAME`
file and `site.json` `baseUrl`. The cutover is complete; DNS and registrar updates remain administrator steps — see
[docs/MIGRATION_AND_REDIRECTS.md](docs/MIGRATION_AND_REDIRECTS.md).
