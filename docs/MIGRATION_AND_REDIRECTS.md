> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Routing, Redirects, and SEO Architecture

## Clean URLs on GitHub Pages

The site achieves clean URLs (e.g., `/projects/ai-safety/` instead of `/projects/ai-safety.html`) through GitHub Pages' standard behavior:

**Directory Index Resolution**: GitHub Pages automatically serves `<path>/index.html` when a request matches `<path>/`. The build generates all routed pages as `<section>/index.html` (e.g., `about/index.html`, `projects/active-blockference/index.html`, `es/about/index.html` for Spanish). Requests to `/projects/active-blockference/` are transparently served the content of `projects/active-blockference/index.html`.

**Single Root Entry**: The only flat HTML files at the repository root are `index.html` (home page) and `404.html` (error page, required by GitHub Pages). Every other page is a clean directory URL.

**Base-Path Aware Taxonomy**: The build reads `src/url-taxonomy.mjs` to map slugs to output directories. The taxonomy distinguishes:
- **Locale-agnostic base dirs** (e.g., `projects/ai-safety` from slug `project-ai-safety`)
- **Per-locale output paths** (e.g., `es/projects/ai-safety/index.html` for Spanish, `projects/ai-safety/index.html` for English)
- **Relative asset paths** via `relPrefix()`, which counts "/" segments to reach the true repository root from any page depth

### URL Structure Examples

| Slug | Output Path | Canonical URL | Serves To |
|------|----|----|---|
| `index` | `index.html` | `https://activeinference.institute/` | `/` |
| `about` | `about/index.html` | `https://activeinference.institute/about/` | `/about/` |
| `project-ai-safety` | `projects/ai-safety/index.html` | `https://activeinference.institute/projects/ai-safety/` | `/projects/ai-safety/` |
| `fellowship` (program subpage) | `programs/fellowship/index.html` | `https://activeinference.institute/programs/fellowship/` | `/programs/fellowship/` |
| `search` | `search/index.html` | `https://activeinference.institute/search/` | `/search/` |
| Same slugs in Spanish locale | `es/about/index.html`, `es/projects/ai-safety/index.html` | `https://activeinference.institute/es/about/`, `https://activeinference.institute/es/projects/ai-safety/` | `/es/about/`, `/es/projects/ai-safety/` |

---

## 404-Based Redirect Mechanism

**Server-Side Limitation**: GitHub Pages provides no server-side redirect configuration (no `.htaccess`, no `_redirects` file, no rewrite rules). Legacy Squarespace URLs must be handled client-side.

**404.html as a Catch-All**: GitHub Pages serves `404.html` for any request path that does not match a built file. This includes legacy Squarespace paths that no longer exist.

**Client-Side Redirect Script**: `assets/js/redirects.js` is loaded **only** on `404.html` (via a `<script>` tag with `defer`). When a visitor lands on a 404, the script:
1. Reads `location.pathname` and normalizes it (strips leading/trailing slashes, lowercases, removes `.html` suffix)
2. Looks up the normalized path in a hardcoded `MAP` object
3. On a match, calls `location.replace()` to the new clean URL
4. On a miss, allows the normal 404 page to display

**Base-Path Awareness**: The script reads a `data-base` attribute from its own `<script>` tag, allowing it to work at both the apex domain (`/`) and project-page bases (`/institute_website/`). It strips the base from the incoming path and prepends it to destination URLs.

**CSP-Safe**: The script makes no network requests and contains no external dependencies — the redirect map is inline JSON. This satisfies the strict Content-Security-Policy.

### How Legacy URLs Become 404s

When Squarespace hosted the apex domain, requests like `/fellowship` returned a 200 page. After cutover to GitHub Pages, GitHub sees no built file at `/fellowship/index.html` and serves `404.html` instead, triggering the redirect script.

---

## Legacy-URL and Shortlink Redirect Table

### Apex Page Redirects (MAP in assets/js/redirects.js)

All keys are normalized (lowercase, no leading/trailing slash, no `.html`):

| Old Squarespace Path | New Clean URL | Notes |
|---|---|---|
| `/home`, `/` | `/` | Home redirect |
| `/welcome` | `/get-involved/` | Welcome → Get involved |
| `/about-us`, `/history` | `/about/` | About alias |
| `/board-of-directors`, `/bod` | `/structure/` | Board → Structure |
| `/officers` | `/structure/` | Officers → Structure |
| `/scientific-advisory-board`, `/sab` | `/structure/` | SAB → Structure |
| `/structure` | `/structure/` | Structure direct |
| `/courses`, `/education` | `/learning/` | Courses → Learning |
| `/research-overview`, `/research` | `/learning/` | Research → Learning |
| `/livestreams` | `/activities/` | Livestreams → Activities |
| `/physics-as-information-processing`, `/paip1` | `/ecosystem/physics/` | Physics domain |
| `/participation` | `/get-involved/` | Participation → Get involved |
| `/fellowship` | `/programs/fellowship/` | Fellowship program |
| `/internship` | `/programs/internship/` | Internship program |
| `/mentorship` | `/programs/mentorship/` | Mentorship program |
| `/partnership` | `/programs/partnership/` | Partnership program |
| `/volunteer` | `/volunteer/` | Volunteer direct |
| `/donate`, `/support` | `/programs/philanthropy/` | Donations → Philanthropy |
| `/active-blockference`, `/active-blockference-1` | `/projects/active-blockference/` | Project redirect |
| `/knowledge-engineering` | `/projects/knowledge-engineering/` | Project redirect |
| `/rxinfer` | `/projects/rxinfer/` | Project redirect |
| `/symposium` | `/projects/symposium/` | Project redirect |
| `/textbook-group` | `/projects/textbook-group/` | Project redirect |
| `/theoretical-neurobiology-group`, `/theoretical-neurobiology-group-1`, `/tnb` | `/projects/theoretical-neurobiology/` | Project redirect (3 aliases) |

**Special Behavior**: The matching is case-insensitive and ignores trailing slashes. `/Fellowship`, `/fellowship/`, and `/fellowship.html` all match the same key.

### Subdomain Shortlinks (DNS-Level Forwards, NOT in this repo)

These are registrar/DNS forwards independent of the static site hosting. They remain unchanged through the cutover.

| Subdomain | Destination | Type | Status |
|---|---|---|---|
| `eduactive` | `/eduactive/` | On-site | Ready |
| `activities`, `projects` | `/projects/` | On-site | Ready |
| `ecosystem` | `/ecosystem/` | On-site | Ready |
| `structure` | `/structure/` | On-site | Ready |
| `reinference` | `/reinference/` | On-site | Ready |
| `volunteer` | `/volunteer/` | On-site | Ready |
| `intern` | `/programs/internship/` | On-site | Ready |
| `mentorship` | `/programs/mentorship/` | On-site | Ready |
| `fellows`, `fellowship` | `/programs/fellowship/` | On-site | Ready |
| `partnerships`, `partnership` | `/programs/partnership/` | On-site | Ready |
| `welcome` | `/get-involved/` | On-site | Ready |
| `textbook-group` | `/projects/textbook-group/` | On-site | Ready |
| `rxinfer` | `/projects/rxinfer/` | On-site | Ready |
| `knowledge-engineering` | `/projects/knowledge-engineering/` | On-site | Ready |
| `active-blockference` | `/projects/active-blockference/` | On-site | Ready |
| `symposium` | `/projects/symposium/` | On-site | Ready |
| `tnb` | `/projects/theoretical-neurobiology/` | On-site | Ready |
| `strategy` | `/strategy/` | On-site (gap page) | Link to Coda hub until content migrated |
| `measure` | `/measure/` | On-site (gap page) | Link to Coda hub until content migrated |
| `prepare` | `/prepare/` | On-site (gap page) | Link to Coda hub until content migrated |
| `affordances` | `/projects/affordances/` | On-site (gap page) | Link to Coda hub until content migrated |
| `wave-hypothesis` | `/projects/wave-hypothesis/` | On-site (gap page) | Link to Coda hub until content migrated |
| `video` | `/video/` | On-site (gap page) | Link to Coda hub until content migrated |
| `weekly` | `/weekly/` | On-site (gap page) | Link to Coda hub until content migrated |
| `2025` | `/2025/` | On-site (gap page) | Annual overview |
| `2026` | `/2026/` | On-site (gap page) | Annual overview |
| `aicacp` | `/projects/aicacp/` | On-site | Ready |
| `ontology` | `/projects/active-inference-ontology/` | On-site | Ready |
| `sab` | `/structure/#scientific-advisory-board` | On-site | Ready |
| `bod` | `/structure/#board-of-directors` | On-site | Ready |
| `newsletter` | `https://activeinferenceinstitute.substack.com/` | External | Permanent |
| `chat` | Perplexity search | External | Permanent |
| `obsidian` | Obsidian knowledge base (surfaced on `/active-inference/`) | External | Permanent |
| `resnei` | `https://zenodo.org/records/15389683` | External | Permanent |
| `zoom` | Zoom meeting room | External | Temporary (302) |
| `start` | `https://github.com/ActiveInferenceInstitute/Start/` | External | Permanent |
| `donate`, `paypal`, `support` | `https://www.paypal.com/donate/` | External | Permanent |
| `discord` | `https://discord.gg/FSUvYD2p9S` | External | Permanent |
| `measureform` | Coda form | External | Permanent (to be created) |
| `prepareform` | Coda form | External | Permanent (to be created) |

---

## Sitemap Generation

### XML Sitemap (`sitemap.xml`)

**Generated at Build Time**: `src/build.mjs` produces `sitemap.xml` by:
1. Collecting all routed page slugs via `slugRenderers` array
2. Converting each slug to its output path via `outputPathForSlug()`
3. Converting each output path to an absolute URL via `absoluteUrl()`
4. Assigning priorities based on page depth:
   - **1.0** for home (depth 0)
   - **0.8** for top-level sections (depth 1, e.g., `/projects/`, `/about/`)
   - **0.6** for deep collection/detail pages (depth 2+, e.g., `/projects/ai-safety/`)
5. Assigning `changefreq` hints:
   - **weekly** for home and top-level sections
   - **monthly** for deep pages
6. Setting `lastmod` to the export date (stable per export, never a live clock)

**Location**: The sitemap declares itself in `robots.txt`:
```
User-agent: *
Allow: /
Sitemap: https://activeinference.institute/sitemap.xml
```

**Locale Handling**: The XML sitemap includes only the default (English) locale pages at the root. Non-default locale pages (`es/about/`, `fr/projects/`) are NOT listed in the main sitemap. This is correct: each locale has its own self-contained URL tree, and search engines discover them via `hreflang` alternates on each page.

### Human-Readable Sitemap (`/sitemap/`)

**Generated Page**: `/sitemap/index.html` is rendered from `src/pages/sitemap.mjs` and lists:
1. **Sections & Tools**: Synthetic pages (knowledge, resources, directory, search, simulations, calendar)
2. **Curated Pages**: All content from `src/content/pages/*.json`, with title and summary

The page uses the same slug source as the XML sitemap so the two cannot drift. All links use `hrefForSlug()` for caller-relative clean URLs.

---

## Feed Generation

### RSS Feed (`feed.xml`)

Generated from `src/feeds.mjs` using communications records from `src/content/instituteos/communications_public.json`:
- Title: Site name + " — Updates"
- Items ordered by date (most recent first)
- Each item includes: title, link (to `/activities/`), pubDate, category, description
- Self reference points to `feed.xml` via `absoluteUrl()`

### JSON Feed (`feed.json`)

Same source data, JSON Feed 1.1 format:
- Version: "https://jsonfeed.org/version/1.1"
- Home page URL, feed URL, language (English)
- Items with id, title, content_text, date_published, URL, tags

Both feeds reference `absoluteUrl()` so all URLs are absolute and canonical.

---

## SEO and Canonical Handling

### Canonical URLs

**Source of Truth**: `src/render/urls.mjs` export `absoluteUrl()` transforms any file path to its canonical absolute URL:
- Input: `projects/ai-safety/index.html`
- Output: `https://activeinference.institute/projects/ai-safety/`

The transformation:
1. Reads `baseUrl` from `src/content/site.json`
2. Collapses `index.html` to a trailing `/`
3. Uses the URL constructor to ensure proper formatting

**On Every Page**: `src/render/layout.mjs` calls `absoluteUrl()` to emit:
```html
<link rel="canonical" href="https://activeinference.institute/about/">
<meta property="og:url" content="https://activeinference.institute/about/">
```

The canonical URL is passed to `structuredData()` for JSON-LD breadcrumbs.

**404 Page Special Case**: The 404 page overrides `canonicalPath` to `404.html` (the only exception), yielding:
```html
<link rel="canonical" href="https://activeinference.institute/404.html">
```
with `robots: "noindex"` to prevent crawling.

### Hreflang Alternates

**Purpose**: Advertise locale variants to search engines so they index the correct version per user language.

**Implementation** in `src/render/layout.mjs`:
1. `localeAlternateLinks(slug)` generates a `<link rel="alternate" hreflang="...">` for each locale
2. For each locale code, it calls `localeOutputPathForSlug(slug, code)` to get the locale-specific output path
3. Converts that path to an absolute URL
4. Emits links for all locales (e.g., `hreflang="es"`, `hreflang="de"`) plus `hreflang="x-default"` pointing to the English version

Example for `/about/` page:
```html
<link rel="alternate" hreflang="en" href="https://activeinference.institute/about/">
<link rel="alternate" hreflang="es" href="https://activeinference.institute/es/about/">
<link rel="alternate" hreflang="fr" href="https://activeinference.institute/fr/about/">
<!-- ... other locales ... -->
<link rel="alternate" hreflang="x-default" href="https://activeinference.institute/about/">
```

**Flat 404**: The 404 page has no slug, so it generates no locale alternates (only the canonical).

### Open Graph and Twitter Cards

**Per-Page Images**: `ogImageForSlug(slug)` checks for a custom card at `assets/img/cards/<slug>.png`. If found, uses it; otherwise falls back to the shared `assets/img/social-card.png`.

**Meta Tags**:
```html
<meta property="og:type" content="article|website">  <!-- article for projects, website for sections -->
<meta property="og:title" content="Page Title | Active Inference Institute">
<meta property="og:description" content="...">
<meta property="og:url" content="https://activeinference.institute/.../">  <!-- absolute canonical -->
<meta property="og:image" content="https://activeinference.institute/assets/img/...">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="...">
```

### Structured Data (JSON-LD)

**Pages generate**:
1. **Organization** node (one per site) with schema.org/NGO type, name, logo, contact, social links
2. **BreadcrumbList** for every page (home → section → page)
3. **SoftwareSourceCode** or **CreativeWork** for `/projects/` pages (when a public repository URL exists)
4. **CollectionPage** + **ItemList** for hub pages (`/projects/`, `/programs/`) listing child pages

All URLs in the graph are absolute via `absoluteUrl()`.

### Description Tags

`metaDescription(text)` collapses whitespace and clips descriptions to ~157 characters on a word boundary to prevent SERP truncation. Used in:
- `<meta name="description">`
- `<meta property="og:description">`
- `<meta name="twitter:description">`
- `<meta name="twitter:title">`

### Robots and Indexing

- **404.html**: `<meta name="robots" content="noindex">` — do not index error pages
- **All other pages**: No robots tag — crawl and index everything
- **robots.txt** points to `sitemap.xml` for crawler discovery

### Internationalization Impact on SEO

**Build-Time Rendering**: Every page is pre-rendered once per locale at build time. No runtime translation or client-side language switching affects URLs.

**Locale Prefix in URLs**:
- English (default): `/projects/ai-safety/` (at root)
- Spanish: `/es/projects/ai-safety/`
- French: `/fr/projects/ai-safety/`

**Hreflang on All Locales**: Every page in every locale includes hreflang alternates pointing to all other locales plus x-default, so search engines understand the language tree.

**Locale Switcher**: In the page header, the language switcher uses `crossLocaleHref()` to generate relative links to the same slug in other locales. The switcher markup includes `hreflang` attributes on each link.

**Machine Translation Notice**: Non-default locales marked as machine-translated carry a visible note on the rendered page with a link back to the English original.

---

## Base URL and Custom Domain

**Current Base URL**: `https://activeinference.institute/` (set in `src/content/site.json`)

**CNAME Record**: `activeinference.institute` (tells GitHub Pages to serve the site at this domain)

**Base-Path Aware Build**: The build is aware of the base URL and uses it to:
1. Emit absolute canonical URLs in every page
2. Reference scripts and stylesheets with relative paths (via `relPrefix()`)
3. Generate `sitemap.xml` and `robots.txt` with absolute URLs
4. Configure the redirect script with a `data-base` attribute

This allows the same built HTML to work at different bases (e.g., `/institute_website/` during project-page testing, `/` at the apex domain) without modification.

---

## Internal Link Resolution

All author-supplied hrefs in content go through `resolveInternalHref()` in `src/render/urls.mjs`:

1. **Legacy flat hrefs**: `about.html` or `about.html#section` → resolved via slug lookup to clean URL
2. **Root-absolute paths**: `/projects/ai-safety/` or `/about/#team` → resolved to caller-relative href
3. **External URLs**: `https://...` → pass through unchanged
4. **Fragment-only**: `#section` → pass through unchanged
5. **Already-relative**: `../about/` → pass through unchanged

The resolver uses `SLUG_FOR_DIR` (a Map from output directory to slug) and `ROUTED_SLUG_SET` for fast lookups.
