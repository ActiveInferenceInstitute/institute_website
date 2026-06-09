# Agent Guide — Active Inference Institute Website

This repository builds the public GitHub Pages website for the Active Inference Institute:

[https://activeinferenceinstitute.github.io/institute_website/](https://activeinferenceinstitute.github.io/institute_website/)

## Operating Contract

This is a public resource hub, not a working-material archive. Do not publish input artifacts, drafting screenshots, generated trace views, page extraction output, or downloadable working materials. Public copy may be informed by internal materials, but the current site must remain visitor-facing and navigable.

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
- `assets/js/site.js` handles navigation disclosure and resource filtering.
- Generated root files are committed because GitHub Pages serves from `main` at repository root.

Generated public files should be limited to:

- `index.html`
- curated page HTML files
- `resources.html`
- `404.html`
- `robots.txt`
- `sitemap.xml`
- static CSS and JavaScript assets
- `.nojekyll`

## Content Model

Use `src/content/live-sources.json` as the canonical registry for volatile public URLs. Public resources in `src/content/resources.json`, social links, page actions, section links, and card links should reference public destinations by `sourceId` whenever possible.

Curated page JSON files must include:

- `audience`
- `primaryActions`
- `resourceGroups`
- `relatedSlugs`
- `externalSourceIds`
- visitor-facing `sections`
- concise `cards`

Do not reintroduce fields that imply public page extraction or page-number traceability.

## Design Requirements

- Use dark mode by default.
- Use near-black backgrounds, gray surfaces, white text, muted gray secondary text, and red as the only accent color.
- Keep navigation accessible: click-disclosed dropdowns, keyboard focus, no hover-only paths, and mobile-friendly behavior.
- Every curated page must signpost locally, internally, and externally:
  - local section guide
  - related internal pages
  - verified public resources
- The resource directory must remain searchable and filterable.

## Verification Gates

Run these before committing:

```bash
npm run build
npm run check
npm run check:links
npm run check:sources
npm run check:site
git diff --check
```

For browser verification, serve from the repository root:

```bash
python3 -m http.server 4173
```

Check desktop home, mobile navigation dropdowns, Resources search/filter, Projects, Get Involved, and 404. Confirm no console errors and no local missing-asset responses.

## Deployment

GitHub Pages serves from `main` at `/`. After a verified commit is pushed to `origin/main`, confirm the deployed site responds at:

- `/`
- `/resources.html`
- `/projects.html`
- `/get-involved.html`
- `/sitemap.xml`
- `/robots.txt`

No custom domain is configured for this pass.
