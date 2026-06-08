# Active Inference Institute Website

This repository contains the canonical GitHub Pages website for public Active Inference Institute information.

- Canonical repository: <https://github.com/ActiveInferenceInstitute/institute_website>
- Public site: <https://activeinferenceinstitute.github.io/institute_website/>

The site is source-driven:

- `src/content/site.json` contains shared site metadata, canonical URLs, and the accuracy policy.
- `src/content/navigation.json`, `social.json`, and `metrics.json` contain shared navigation, public channels, and homepage metrics.
- `src/content/pages/*.json` contains curated public pages.
- `src/content/pdf-pages.json` is generated from `AII.pdf` and powers the searchable source atlas.
- `src/content/live-sources.json` records volatile public URLs, live-check status, source labels, and last-checked timestamps.
- `src/build.mjs` generates static HTML into the repository root for GitHub Pages.
- `assets/` contains shared CSS, JavaScript, source thumbnails, and the source PDF download.

## Local Workflow

```bash
npm run check
npm run extract
npm run build
npm run check:links
npm run check:sources
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## GitHub Pages

GitHub Pages is branch-based: deploy from the `main` branch at repository root (`/`). Keep `.nojekyll` in place so generated static assets and atlas pages are served directly.

## Source Contract

The public pages are refactored from `AII.pdf`. The source atlas keeps page-level coverage so that every extracted PDF page remains discoverable and auditable from the website.

The accuracy rule is **PDF + Live**: the PDF is the base source for institutional content, while volatile public links are updated only when a reachable public source clearly verifies the current detail. The Source Manifest page shows the PDF page count, live-source check date, and checked public URLs.
