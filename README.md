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
- Structured public tables for public GitHub people, open-source repositories, research links, ideas, and ontology relationships.

The site is intentionally a static GitHub Pages build: no runtime framework, no server dependency, and no client-side requirement beyond the small navigation and resource-filter script.

## Public Content Policy

The public site must not expose input artifacts, drafting screenshots, generated trace views, page-by-page extraction surfaces, or downloadable working materials. Internal materials may inform authored public copy, but the published site should remain a visitor-facing resource hub.

Volatile public links are centralized in `src/content/live-sources.json`. Templates should resolve public channels, official pages, and repositories by `sourceId` instead of hardcoding repeated external URLs.

Visitor-facing links must not point directly at resolved Coda destinations. If an official `*.activeinference.institute` shortlink redirects to a Coda page, render the shortlink and keep the resolved destination only as verification metadata in `live-sources.json`.

InstituteOS-adjacent data may be injected only through the public sync script. The sync output is intentionally sanitized: it may include public GitHub profile rows, public repository rows, concept nodes, relationship rows, and approved brand marks, but it must exclude nonpublic rosters, private operational fields, raw task detail, nonpublic stewardship records, and internal UI captures.

## Architecture

```text
.
├── src/
│   ├── build.mjs                 # Static generator (renders all public HTML + crawler files)
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
│       ├── instituteos/*.json    # Sanitized Open Source Map public tables
│       └── pages/*.json          # Curated public guide pages
├── assets/
│   ├── css/styles.css            # Site theme on top of the design-system tokens
│   ├── css/instituteos-ds.css    # Design-system token export (from library/design-system)
│   ├── css/graphs.css            # Graph / visualization styles
│   ├── js/site.js                # Navigation disclosure, resource filters, repo sorting
│   └── js/theme.js               # Light/dark theme toggle (localStorage)
├── scripts/
│   ├── sync_instituteos_public_data.py # Sanitized public data injection
│   ├── generate-project-pages.mjs # Per-project page content generator
│   ├── generate-cards.mjs        # Per-page Open Graph social cards
│   ├── generate-icons.sh         # Brand icon / favicon generation
│   ├── check_internal_links.py   # Local HTML and asset link checker
│   ├── check_live_sources.py     # External-link verifier
│   ├── check_site_contract.py    # Public resource-hub contract checker
│   └── check_static_security.py  # Static-site security contract checker
├── index.html                    # Generated public root (only flat HTML besides 404)
├── 404.html                      # Generated not-found page (served by GitHub Pages)
├── resources/index.html          # Generated searchable resource directory (clean URL /resources/)
├── directory/index.html          # Generated global index (clean URL /directory/)
├── knowledge/index.html          # Generated Open Source Map (clean URL /knowledge/)
├── search/index.html             # Generated dedicated search page (clean URL /search/)
├── sitemap/index.html            # Generated human-readable HTML sitemap (clean URL /sitemap/)
├── <section>/<slug>/index.html   # Generated curated pages as clean URLs (about/, projects/, programs/, ecosystem/, …)
├── robots.txt                    # Generated crawler policy
├── sitemap.xml                   # Generated XML sitemap
├── feed.xml                      # Generated RSS feed
├── feed.json                     # Generated JSON feed
├── manifest.webmanifest          # Generated PWA manifest (installability)
├── version.json                  # Generated machine-readable version + provenance
├── .well-known/security.txt      # Generated RFC 9116 disclosure contact
└── .nojekyll                     # GitHub Pages static passthrough
```

Since v2.0 every routed page is served as a clean URL: the generator writes
`<section>/index.html` (and `<section>/<slug>/index.html` for child pages) so
GitHub Pages serves `/resources/`, `/projects/<name>/`, etc. The only flat HTML
files at the repository root are `index.html` and `404.html`.

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
- `src/content/instituteos/*.json` contains sanitized Open Source Map tables: public GitHub people, public repositories, ideas, ontology relationships, and brand assets.
- `src/content/live-sources.json` remains the canonical registry for external URLs and verification status. Its `url` field is the public display URL; `finalUrl` records redirect verification only and is never rendered.

Rendered resources use stable fields: `sourceId`, `type`, `category`, `audience`, `tags`, `summary`, `relatedSlugs`, `priority`, and `promoted`.

## Public Data Injection

The public Open Source Map is generated from public repository metadata plus public-safe concept graph data from a sibling InstituteOS checkout. By default it looks for `../instituteos` next to this repository; set the `INSTITUTEOS_ROOT` environment variable to point elsewhere:

```bash
npm run sync:instituteos
```

Check that injected files are current without rewriting them:

```bash
npm run check:instituteos
```

The sync creates `src/content/instituteos/people.json`, `projects.json`, `ideas.json`, `ontology.json`, and `assets.json`, plus brand-only images under `assets/img/instituteos/`. People rows must be externally visible public GitHub profiles. Project rows must come from public repositories. Only `ActInferServe.png` and `Dark_ActInfServe.png` are copied. Do not copy working documents, demos, recordings, nonpublic rosters, or internal UI captures into the public website.

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
npm run check:instituteos
npm run check:links
npm run check:sources
npm run check:site
npm run check:security
npm run check:design-system
git diff --check
```

`npm run check` already chains `check:links`, `check:instituteos`,
`check:design-system`, `check:site`, and `check:security`; the individual
commands above are listed for targeted runs.

Serve locally from the repository root:

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173/](http://localhost:4173/).

## Deployment

GitHub Pages is configured to serve from `main` at the repository root. A release is published by committing generated output and pushing `main` to `origin`.

Before pushing, confirm:

- `npm run build` has refreshed generated HTML, `robots.txt`, `sitemap.xml`, the
  HTML sitemap at `/sitemap/`, `feed.xml`, `feed.json`, `manifest.webmanifest`,
  `version.json`, and `.well-known/security.txt`.
- `npm run check:instituteos` confirms sanitized Open Source Map tables and brand assets are current.
- `npm run check` passes.
- `npm run check:links` passes.
- `npm run check:sources` passes or has been intentionally refreshed with reachable public links.
- `npm run check:site` passes.
- `npm run check:security` passes.
- `npm run check:design-system` confirms the CSS stays aligned with the design-system tokens.
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
- The Open Source Map must expose searchable/filterable structured tables for public GitHub people, repositories, research links, ideas, and ontology relationships, with Directory links to every table and row anchor.
- Static security must remain simple: local scripts/styles only, CSP and referrer meta tags present, no forms, no embedded frames, and external anchors backed by `src/content/live-sources.json`.
- External public links should render only internal GitHub Pages links, official Institute domains or shortlinks, GitHub repositories/pages, papers and research records, media/social/donation/contact links, or other verified public resources.
