# Agent Guide — Active Inference Institute Website

This repository builds the public GitHub Pages website for the Active Inference Institute:

[https://activeinferenceinstitute.github.io/institute_website/](https://activeinferenceinstitute.github.io/institute_website/)

## Operating Contract

This is a public resource hub, not a working-material archive. Do not publish input artifacts, drafting screenshots, generated trace views, page extraction output, or downloadable working materials. Public copy may be informed by internal materials, but the current site must remain visitor-facing and navigable.

InstituteOS-derived content must be injected only through `scripts/sync_instituteos_public_data.py`. The generated public slices may include role names, project summaries, concept rows, ontology relationships, count-level governance coverage, and approved brand marks. They must not include private operational fields, raw task detail, working documents, demos, recordings, or internal UI captures.

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
- `scripts/sync_instituteos_public_data.py` copies sanitized InstituteOS public tables and brand-only assets into this repo.
- Generated root files are committed because GitHub Pages serves from `main` at repository root.

Generated public files should be limited to:

- `index.html`
- curated page HTML files
- `resources.html`
- `directory.html`
- `knowledge.html`
- `404.html`
- `robots.txt`
- `sitemap.xml`
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
- `src/content/instituteos/*.json` for sanitized InstituteOS public people, projects, ideas, ontology, and asset tables.
- `src/content/live-sources.json` for URL, status, and last-check data.

Refresh InstituteOS public data from the default sibling checkout:

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
- The Knowledge Map must provide searchable/filterable tables for public people/roles, projects, ideas, and ontology relationships, with accessible captions and Directory row-anchor links.
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
git diff --check
```

For browser verification, serve from the repository root:

```bash
python3 -m http.server 4173
```

Check desktop home, Resources, Directory, Knowledge Map, mobile navigation dropdowns, Projects, Get Involved, and 404. Confirm no console errors and no local missing-asset responses.

## Deployment

GitHub Pages serves from `main` at `/`. After a verified commit is pushed to `origin/main`, confirm the deployed site responds at:

- `/`
- `/resources.html`
- `/directory.html`
- `/knowledge.html`
- `/projects.html`
- `/get-involved.html`
- `/sitemap.xml`
- `/robots.txt`

No custom domain is configured for this pass.
