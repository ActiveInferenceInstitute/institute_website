# Agent Guide — Active Inference Institute Website

This repository builds the public GitHub Pages website for the Active Inference Institute.
Canonical domain (post-cutover): **[https://activeinference.institute/](https://activeinference.institute/)**
(during the Squarespace → Pages migration; pre-cutover it served at
`activeinferenceinstitute.github.io/institute_website/`). See [SWITCHOVER.md](SWITCHOVER.md).

## Documentation map

Start here, then open the most specific doc for your task:

| Doc | Use it for |
| --- | --- |
| **[`.claude/skills/institute-website/SKILL.md`](.claude/skills/institute-website/SKILL.md)** | The invokable agent skill — golden rules + task workflows. Read this first for any change. |
| This file (`AGENTS.md`) | Operating contract, build/content/design model, gates. |
| [`README.md`](README.md) | Human-facing overview. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Colors, tokens, the design-system export contract. |
| [`INTERNATIONALIZATION.md`](INTERNATIONALIZATION.md) | Locales, `tr()`, offline translation. |
| [`MIGRATION.md`](MIGRATION.md) | Redirect map + subdomain-forward repoint table. |
| [`SWITCHOVER.md`](SWITCHOVER.md) | Cutover handoff: done / can-do / needs-human, DNS records. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CHANGELOG.md`](CHANGELOG.md) · [`TODO.md`](TODO.md) | Contribution flow, history, backlog. |

Per-folder guides: [`src/AGENTS.md`](src/AGENTS.md) ·
[`src/render/AGENTS.md`](src/render/AGENTS.md) ·
[`src/lib/AGENTS.md`](src/lib/AGENTS.md) ·
[`src/content/AGENTS.md`](src/content/AGENTS.md) ·
[`src/content/pages/AGENTS.md`](src/content/pages/AGENTS.md)
(+ [`_TEMPLATES.md`](src/content/pages/_TEMPLATES.md)) ·
[`scripts/AGENTS.md`](scripts/AGENTS.md) ·
[`assets/AGENTS.md`](assets/AGENTS.md).

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

Do not render direct resolved Coda destinations in public pages. When an official `*.activeinference.institute` shortlink redirects to Coda, render the shortlink from `live-sources.json:url`; keep the resolved target only in `finalUrl` for verification.

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
npm run build
npm run check:instituteos
npm run check
npm run check:links
npm run check:sources
npm run check:site
npm run check:security
npm run check:design-system
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
file and `site.json` `baseUrl`. The cutover (push + DNS) is a human step — see
[SWITCHOVER.md](SWITCHOVER.md).
