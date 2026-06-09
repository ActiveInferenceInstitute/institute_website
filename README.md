# Active Inference Institute Website

Static public resource hub for the Active Inference Institute.

Canonical deployment:
[https://activeinferenceinstitute.github.io/institute_website/](https://activeinferenceinstitute.github.io/institute_website/)

Canonical repository:
[https://github.com/ActiveInferenceInstitute/institute_website](https://github.com/ActiveInferenceInstitute/institute_website)

## Purpose

This site helps visitors quickly find:

- What the Active Inference Institute is and how it is organized.
- How to start learning Active Inference.
- Which activities, programs, and projects are public entry points.
- How to join, contribute, follow, or support the Institute.
- Verified public resources, official web surfaces, public repositories, channels, and media links.
- Audience-specific pathways for newcomers, learners, researchers, developers, contributors, partners, and supporters.

The site is intentionally a static GitHub Pages build: no runtime framework, no server dependency, and no client-side requirement beyond the small navigation and resource-filter script.

## Public Content Policy

The public site must not expose input artifacts, drafting screenshots, generated trace views, page-by-page extraction surfaces, or downloadable working materials. Internal materials may inform authored public copy, but the published site should remain a visitor-facing resource hub.

Volatile public links are centralized in `src/content/live-sources.json`. Templates should resolve public channels, official pages, and repositories by `sourceId` instead of hardcoding repeated external URLs.

Visitor-facing links must not point directly at resolved Coda destinations. If an official `*.activeinference.institute` shortlink redirects to a Coda page, render the shortlink and keep the resolved destination only as verification metadata in `live-sources.json`.

## Architecture

```text
.
├── src/
│   ├── build.mjs                 # Static generator
│   └── content/
│       ├── site.json             # Site metadata and canonical URL
│       ├── navigation.json       # Accessible dropdown navigation groups
│       ├── metrics.json          # Homepage summary metrics
│       ├── social.json           # Footer social links by live resource id
│       ├── live-sources.json     # Checked external-link registry
│       ├── resources.json        # Public resource directory model
│       ├── official-pages.json   # Official site pages and public subdomains
│       ├── repositories.json     # Public ActiveInferenceInstitute repositories
│       ├── audience-pathways.json # Homepage visitor pathways
│       └── pages/*.json          # Curated public guide pages
├── assets/
│   ├── css/styles.css            # Dark charcoal theme with red accents
│   └── js/site.js                # Navigation disclosure and resource filters
├── scripts/
│   ├── check_internal_links.py   # Local HTML and asset link checker
│   ├── check_live_sources.py     # External-link verifier
│   ├── check_site_contract.py    # Public resource-hub contract checker
│   └── check_static_security.py  # Static-site security contract checker
├── index.html                    # Generated public root
├── resources.html                # Generated searchable resource directory
├── directory.html                # Generated global index
├── *.html                        # Generated curated pages
├── robots.txt                    # Generated crawler policy
├── sitemap.xml                   # Generated canonical sitemap
└── .nojekyll                     # GitHub Pages static passthrough
```

## Content Model

Curated pages live in `src/content/pages/*.json`. Each page should define:

- `slug`, `title`, `subtitle`, `audience`, and `lede`
- `primaryActions` for main internal or verified external actions
- `resourceGroups` to pull related resources from the directory
- `sections` and `cards` for visitor-facing content
- `relatedSlugs` for internal signposting
- `externalSourceIds` for verified public links

Public resources are split by purpose:

- `src/content/resources.json` contains curated cross-channel resources and filter taxonomies.
- `src/content/official-pages.json` contains reachable official site pages, `activeinference.org`, `activeinference.institute`, START, and official shortlinks.
- `src/content/repositories.json` contains all reachable public `ActiveInferenceInstitute` repositories.
- `src/content/audience-pathways.json` contains homepage routes for visitor intent.
- `src/content/live-sources.json` remains the canonical registry for external URLs and verification status. Its `url` field is the public display URL; `finalUrl` records redirect verification only and is never rendered.

Rendered resources use stable fields: `sourceId`, `type`, `category`, `audience`, `tags`, `summary`, `relatedSlugs`, `priority`, and `promoted`.

## Local Workflow

Install dependencies once:

```bash
npm install
```

Build the site:

```bash
npm run build
```

Run the local release gates:

```bash
npm run check
npm run check:links
npm run check:sources
npm run check:site
npm run check:security
git diff --check
```

Serve locally from the repository root:

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173/](http://localhost:4173/).

## Deployment

GitHub Pages is configured to serve from `main` at the repository root. A release is published by committing generated output and pushing `main` to `origin`.

Before pushing, confirm:

- `npm run build` has refreshed generated HTML, `robots.txt`, and `sitemap.xml`.
- `npm run check` passes.
- `npm run check:links` passes.
- `npm run check:sources` passes or has been intentionally refreshed with reachable public links.
- `npm run check:site` passes.
- `npm run check:security` passes.
- Browser checks cover desktop home, Resources, Directory, mobile navigation, Projects, Get Involved, and 404.

## Design Contract

- Dark mode by default.
- Near-black background, gray surfaces, white primary text, muted gray secondary text.
- Red is the only accent color.
- Dropdown navigation must work by click, keyboard focus, and mobile disclosure.
- Every curated page must include local section navigation, related internal pages, and verified external resources.
- The home page must include audience pathways for newcomer, learner, researcher, developer, contributor, and partner/supporter visitors.
- The resource directory must include focused views for Featured, Official pages, Official shortlinks, Repositories, Learning/Research, Participation, and the Full Directory.
- The full resource directory must support search plus type, group, audience, and popular-tag filtering without a huge tag dropdown.
- The repository view must support local sorting by updated date, stars, language, and group.
- The global directory must index every curated page, page section, resource group, official page, official shortlink, verified external link, and public repository.
- Static security must remain simple: local scripts/styles only, CSP and referrer meta tags present, no forms, no embedded frames, and external anchors backed by `src/content/live-sources.json`.
- External public links should render only internal GitHub Pages links, official Institute domains or shortlinks, GitHub repositories/pages, papers and research records, media/social/donation/contact links, or other verified public resources.
