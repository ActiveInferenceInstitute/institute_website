> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Gate & Guard Reference — Institute Website

This document is a complete reference for all gates and guards enforcing the static institute website. Gates are automated verifications run before commit; guards are structural constraints that gates enforce.

---

## Quick Start: Running the Gates

```bash
# Build first (always) — gates read generated HTML
node src/build.mjs

# Run the offline gate suite (5 sub-checks)
npm run check

# Explicitly run a single gate
npm run check:links        # check_internal_links.py
npm run check:instituteos  # sync_instituteos_public_data.py --check
npm run check:design-system  # check_design_system_export.mjs
npm run check:site         # check_site_contract.py
npm run check:security     # check_static_security.py

# Network probe (NOT part of npm run check)
npm run check:sources      # check_live_sources.py
```

---

## Gate 1: Internal Links (`check:links`)

**File:** `scripts/check_internal_links.py`

**What it enforces:**
- Every generated HTML file has resolvable local references in `href`, `src`, and `poster` attributes
- No broken asset references
- All `#fragment` anchors in same-page links exist as `id` or `name` attributes in the target document
- Respects the deployment `baseUrl` from `site.json` and strips it before resolving paths

**How to run:**
```bash
npm run check:links
# or directly:
python3 scripts/check_internal_links.py
```

**Scope:**
- Parses all `*.html` files in the repo root (excluding `.git`, `.cache`, `node_modules`, `scripts`, `src`, `simulations`)
- Skips source files; validates only **generated HTML** at the repo root

**Failure messages:**
```
Broken local references:
- pages/learning/index.html href references missing /path/to/file.html -> missing/file.html
- pages/learning/index.html href references missing anchor #invalid-anchor -> pages/resources/index.html#invalid-anchor
- pages/learning/index.html href escapes project root: ../../../../etc/passwd
```

**How to fix violations:**
1. **Missing file reference:** Create the file or fix the `href`/`src` attribute in the **source** JSON or template
2. **Missing anchor:** Check the target page's HTML source (after build) and ensure the anchor `id="..."` exists in the target section
3. **Escapes project root:** Remove the reference; it's a security risk
4. **Stale generated HTML:** Rebuild with `node src/build.mjs`

**Example:**
```json
// src/content/pages/example.json
{
  "sections": [
    {
      "links": [
        { "href": "/resources/", "label": "Go to resources" }  // OK after build
      ]
    }
  ]
}
```

---

## Gate 2: InstituteOS Public Data Sync (`check:instituteos`)

**File:** `scripts/sync_instituteos_public_data.py --check`

**What it enforces:**
- Committed sanitized data in `src/content/instituteos/*.json` matches what the sync would produce from InstituteOS source
- No private keys leak into public exports: `email`, `phone`, `contacts`, `slack`, `discord`, `linkedin`, `primary_contact`, etc.
- No forbidden substrings: `coda.io`, `/users/`, `workspace`, `source atlas`, `source manifest`, `aii.pdf`
- No email-address patterns in any serialized value
- Brand assets in `assets/img/instituteos/` are present and match the export

**How to run:**
```bash
npm run check:instituteos
# or directly:
python3 scripts/sync_instituteos_public_data.py --check
```

**Scope:**
- Validates 9 required JSON files:
  - `src/content/instituteos/{people.json, projects.json, ideas.json, ontology.json, entities.json, processes.json, communications.json, policies.json, assets.json}`
- Checks 2 allowed brand assets: `assets/img/instituteos/{ActInferServe.png, Dark_ActInfServe.png}`
- Verifies exact record counts match expected public-safe subsets

**Failure modes:**

| Failure | Cause | Fix |
|---------|-------|-----|
| `stale src/content/instituteos/people.json` | InstituteOS source changed, committed export is outdated | Run `npm run sync:instituteos` if you have the InstituteOS registry source |
| `missing src/content/instituteos/people.json` | Export file was deleted | Run `npm run sync:instituteos` or restore from git |
| `contains private field "email"` | Private key accidentally included in sync | Check the sanitize function in `sync_instituteos_public_data.py` and remove the key before re-syncing |
| `contains blocked public term "coda.io"` | A URL or text still references Coda | Strip Coda URLs and replace with `live-sources.json` references |
| `contains blocked email address` | Email leaked into a record value | Remove the email pattern and re-sync |

**Failure messages:**
```
InstituteOS public data sync check failed:
- stale src/content/instituteos/people.json
- src/content/instituteos/projects.json failed public-safety validation: contains blocked public term "coda.io"
- missing src/content/instituteos/calendar.json (optional, ok if not synced)
```

**How to fix violations:**
1. **Stale files:** If you have the InstituteOS source (sibling `../instituteos` or `INSTITUTEOS_ROOT`), run `npm run sync:instituteos`
2. **Private field leaks:** Edit the offending JSON file to remove private data, or re-sync from a clean source
3. **Coda URLs:** Replace direct `coda.io` links with references to `live-sources.json` by `sourceId`
4. **Email patterns:** Manually remove email addresses from record values and re-save

**Public-safety rules:**
- `record_is_public_safe()` checks: all PRIVATE_KEYS, all FORBIDDEN_SUBSTRINGS, and EMAIL_RE pattern
- Single records that fail can be dropped (e.g. an organization named "Discord") via `record_is_public_safe()`
- Entire payloads are validated by `validate_public_payload()` before commit

---

## Gate 3: Design System Export (`check:design-system`)

**File:** `scripts/check_design_system_export.mjs`

**What it enforces:**
- `assets/css/styles.css` token fallbacks stay aligned with the canonical design-system values
- When the design-system source is present (`../../library/design-system`), `assets/css/instituteos-ds.css` is a fresh byte-for-byte export
- Font file list and bytes match the canonical export

**How to run:**
```bash
npm run check:design-system
# or directly:
node scripts/check_design_system_export.mjs
```

**Scope:**
- Reads `assets/css/styles.css` for `var(--ds-x, <fallback>)` declarations
- Compares fallback values against the canonical dark-mode `:root` tokens from:
  - `../../library/design-system/src/styles/tokens.css` (if source present)
  - Or `assets/css/instituteos-ds.css` itself (standalone checkout)
- Byte-compares font files in `assets/css/fonts/`

**Failure modes:**

| Failure | Cause | Fix |
|---------|-------|-----|
| `Website design-system CSS is stale` | CSS export in the committed file is outdated | Run the design-system export: `npm run export:website -- --to ../../repos/institute_website/assets/css/instituteos-ds.css` in the sibling `design-system` monorepo |
| `styles.css fallback for --ds-red is "#cc0000" but the design-system value is "#dd0000"` | Fallback was edited without updating the canonical token | Edit `assets/css/styles.css` `:root` to match the canonical value |
| `Website design-system font is stale` | Font binary has been updated upstream but not synced | Copy fresh fonts from `../../library/design-system/src/styles/fonts/*.woff2` to `assets/css/fonts/` |
| `Website design-system font list differs from export` | Font filenames have changed | Sync font filenames from the design-system source |

**Failure messages:**
```
- Website design-system CSS is stale: /path/to/assets/css/instituteos-ds.css
- styles.css fallback for --ds-text is "#0f252a" but the design-system value is "#1a3a40"
- Website design-system font is stale: /path/to/assets/css/fonts/Fraunces-Bold.woff2
```

**How to fix violations:**
1. **Stale CSS export:** Navigate to `../../library/design-system` and run `npm run export:website -- --to ../../repos/institute_website/assets/css/instituteos-ds.css`
2. **Fallback mismatch:** Edit `assets/css/styles.css` and update the `:root` block to match the canonical value printed in the error
3. **Stale fonts:** Copy all `.woff2` files from `../../library/design-system/src/styles/fonts/` to `assets/css/fonts/`

**Key insight:**
- The design-system gate ensures the "degraded" state (fallbacks without instituteos-ds.css loaded) still looks correct
- Never edit fallbacks without checking the canonical token first
- Token names like `--ds-font-body`, `--ds-motion`, `--ds-ease` are formatting-sensitive and validated by byte-compare, not value-comparison

---

## Gate 4: Site Contract (`check:site`)

**File:** `scripts/check_site_contract.py`

**What it enforces:**
This is the **largest and most complex gate**. It validates the entire content model, structure, canonical URLs, external links, and design system integration.

### 4a. Versioning

**Enforces:**
- `version.json` `site_version` equals `package.json` `version`
- `version.json` `pages` count matches the number of `<loc>` entries in `sitemap.xml`

**Failure messages:**
```
- version.json site_version "2.5.0" does not match package.json version "2.6.0"
- version.json pages "42" does not match sitemap route count "43"
```

**Fix:**
- Run `node src/build.mjs` to regenerate `version.json`
- Increment `package.json` version if you changed the site structure
- Never hand-edit `version.json`

### 4b. Content Model

**Enforces:**
- `navigation.json` must define grouped dropdown navigation with `items` in each group
- Required navigation destination slugs exist: `directory`, `resources`, `projects`, `get-involved`, `instituteos`
- `live-sources.json` has no duplicate IDs
- All 23 required source IDs are present and marked `ok: true`:
  - `official-activeinference-org`, `start-docs`, `ecosystem`, `official-activities-shortlink`, `official-intern`, `official-measure`, `official-projects-shortlink`, `official-symposium-shortlink`, `official-textbook-group-shortlink`, `official-volunteer`, `shortlink-2025`, `shortlink-fellows`, `shortlink-mentorship`, `shortlink-obsidian`, `shortlink-ontology`, `shortlink-prepare`, `shortlink-rxinfer`, `shortlink-strategy`, `shortlink-wave-hypothesis`, `shortlink-welcome`, `video`, `weekly`
- No blocked governance source IDs: `official-board`, `official-officers`, `official-scientific-advisory-board`, `shortlink-bod`, `shortlink-sab`
- No `"category": "Governance"` in `live-sources.json`
- No direct `coda.io` URLs in `live-sources.json` public `url` field
- `resources.json`, `official-pages.json`, `repositories.json` have valid record shapes:
  - Required fields: `sourceId`, `type`, `category`, `audience`, `tags`, `summary`, `relatedSlugs`, `priority`, `promoted`
  - No `governance` category or audience exposed
- Exactly 52 repositories in `repositories.json`
- At least 10 promoted official shortlinks in `official-pages.json`
- `audience-pathways.json` defines exactly 6 required pathways: `newcomer`, `learner`, `researcher`, `developer`, `contributor`, `partner-supporter`
  - Each pathway has non-empty `primaryHref` and `links`
- Every curated page in `src/content/pages/*.json` has non-empty:
  - `audience`, `resourceGroups`, `primaryActions`, `relatedSlugs`, `externalSourceIds`
- Resources/official-pages/repositories entries reference only live source IDs that exist and are reachable (`ok: true`)
- All `externalSourceIds` in page JSON reference valid live sources

**Failure messages:**
```
Site contract check failed:
- live-sources.json missing required official sources: ['shortlink-strategy', 'shortlink-welcome']
- live-sources.json contains duplicate ids: ['ecosystem']
- required source shortlink-strategy is not promoted as reachable
- live-sources.json public url may not point directly to Coda: ecosystem
- resources.json expected 52 public repositories, found 48
- get-involved: missing required public content field primaryActions
- official-pages.json expected at least 10 promoted non-governance official shortlinks, found 9
- audience-pathways.json expected ['contributor', 'developer', 'learner', 'newcomer', 'partner-supporter', 'researcher'], found ['contributor', 'developer', 'learner']
```

**Fix:**
- Add missing required sources to `live-sources.json` with `ok: true`
- Remove duplicate source IDs (rename one)
- Remove or unmark blocked governance source IDs
- Replace direct `coda.io` URLs with shortlinks in `live-sources.json`
- Ensure repositories.json has exactly 52 entries
- Add required fields to page JSON files
- Re-run `npm run check:sources` to update live-source reachability

### 4c. Curated Pages

**Enforces:**
- Each page renders sections with IDs: `next-actions`, `key-surfaces`, `resources`, `official-pages`, `repositories`, `related-pages`
- Each page includes an "On this page" guide with links to those sections
- `next-actions` section contains at least one external verified action (regex `href="https?://`)
- `next-actions` links to both `resources` and `directory` pages
- `related-pages` section contains at least one link to another curated page
- `resources` section contains at least one external verified link
- `official-pages` and `repositories` sections render resource cards
- Every external anchor on a page is either:
  - In `live-sources.json` with `ok: true`, or
  - On a vetted host: `youtube.com`, `youtu.be`, `activeinference.institute`, `github.com`, `zoom.us`, `meet.google.com`, `twitch.tv`, `odysee.com`

**Failure messages:**
```
- learning: missing section ids {'key-surfaces', 'related-pages'}
- learning: missing page-local guide label
- learning: best next actions must link to resources and directory
- learning: best next actions lacks a verified external action
- learning: related-pages section lacks a related internal page link
- learning: resources section lacks an external verified link
- learning: official-pages section does not render resource cards
- learning: external anchor is not represented in live-sources.json: https://example.org/whitepaper
```

**Fix:**
- Rebuild with `node src/build.mjs` (sections are generated)
- Check the page JSON structure in `src/content/pages/`
- Add missing `primaryActions` with verified external links via `sourceId`
- Ensure pages reference live sources by `sourceId` (not raw `href`)
- Run `npm run check:sources` to ensure referenced sources are marked `ok: true`

### 4d. Resource Directory, Knowledge, and Directory Pages

**Enforces:**
- `resources/index.html` renders:
  - All required view IDs: `resource-views`, `featured`, `official-pages`, `official-shortlinks`, `repositories-view`, `learning-research`, `participation-view`, `full-directory`
  - All required filter IDs: `resource-search`, `resource-type`, `resource-category`, `resource-audience`, `resource-tag`, `resource-count`
  - Resource cards with data attributes: `data-type`, `data-category`, `data-audience`, `data-tags`, `data-search`
  - Popular tag chip filters with `data-tag-filter`
  - Repository sorting attributes: `data-repository-list`, `data-repo-card`
  - All categories as anchors (for deep links)
  - All promoted official pages and repositories as links
- `knowledge/index.html` renders:
  - 5 table section IDs: `people-table`, `projects-table`, `ideas-table`, `ontology-table`, `research-table`
  - Filter IDs: `knowledge-search`, `knowledge-kind`, `knowledge-count`
  - Proper table structure: `<caption>`, `<thead>`, `scope="row"`
  - Data attributes: `data-knowledge-row`, `data-knowledge-kind`, `data-knowledge-search`
  - Row anchors matching records from InstituteOS data (e.g., `person-{id}`, `project-{id}`)
  - Signpost links to resources, directory, projects, and learning pages
- `directory/index.html` includes:
  - All required section IDs: `site-pages`, `resource-groups`, `official-pages`, `official-shortlinks`, `repositories`, `verified-links`, `open-source-map`
  - Links to all curated pages by slug
  - Links to all page sections by anchor
  - All promoted official pages and repositories
  - All Open Source Map row links (people, projects, ideas, edges)
- Every generated page (except directory itself) links to both `directory/` and `knowledge/` using caller-relative clean URLs

**Failure messages:**
```
- resources.html missing resource view ids ['featured', 'full-directory']
- resources.html missing filter ids ['resource-tag']
- knowledge.html missing table section ids ['research-table']
- knowledge.html row counts {'people': 8, 'projects': 12} do not match sanitized registries {'people': 8, 'projects': 14}
- knowledge.html missing row anchor #project-cerebrum
- directory.html missing page learning
- pages/learning/index.html does not link to directory
- pages/learning/index.html does not link to knowledge
```

**Fix:**
- Rebuild with `node src/build.mjs` (renders are generated)
- Update `src/content/pages/institute/resources.json` or knowledge page source if custom structure is needed
- Ensure InstituteOS sync has the latest data (`npm run sync:instituteos`)
- Check that `relatedSlugs` in curated pages are set correctly

### 4e. InstituteOS Public Interface

**Enforces:**
- `instituteos/index.html` exists and renders:
  - Section IDs: `source-ownership`, `export-boundary`, `best-public-interfaces`, `release-checks`, `public-export-gate`, `export-snapshot`
  - Export manifest totals: artifact count and record count displayed
  - Gate version displayed
  - Source fingerprint displayed
  - All artifacts and paths from `data/export-manifest.json` listed
- `data/export-manifest.json` includes:
  - `gate_version` field
  - `source_fingerprint` field
  - `generated_at` timestamp
  - `files[]` array with `name`, `output_path`, `record_count`
- `index.html` (home page) surfaces the public interface:
  - `id="public-interface"` section
  - Links to `instituteos/#export-snapshot` and `instituteos/#public-export-gate`
  - Open Source Map row count (`{people + projects + ideas + ontology}`)
  - Artifact count

**Failure messages:**
```
- instituteos/index.html is missing
- data/export-manifest.json missing gate_version
- instituteos/index.html missing interface ids ['export-snapshot']
- instituteos/index.html does not surface export gate version
- instituteos/index.html missing manifest artifact name people.json
- index.html missing InstituteOS interface homepage snippet 'href="instituteos/#export-snapshot"'
```

**Fix:**
- Run `node src/build.mjs` to regenerate pages
- Ensure `src/content/pages/institute/instituteos.json` exists
- Populate `data/export-manifest.json` with gate metadata and file listings

### 4f. Design System & Canonical URLs

**Enforces:**
- Every generated page has both CSS links in order:
  1. `assets/css/instituteos-ds.css` (design system)
  2. `assets/css/styles.css` (website overrides)
- Every CSS variable alias in `styles.css` `:root` maps to design-system names:
  - `--ink` → `--ds-text`
  - `--muted` → `--ds-text-muted`
  - `--paper` → `--ds-bg`
  - `--surface` → `--ds-surface`
  - `--surface-strong` → `--ds-surface-2`
  - `--line` → `--ds-glass-border`
  - `--red` → `--ds-red`
  - `--shadow` → `--ds-shadow`
  - `--radius` → `--ds-radius-sm`
- Every page's `<link rel=canonical>` and `og:url` start with the canonical `CANONICAL_BASE` from `site.json`
- `robots.txt` points to the canonical sitemap: `Sitemap: {CANONICAL_BASE}sitemap.xml`
- `sitemap.xml` includes canonical URLs for:
  - Root: `{CANONICAL_BASE}`
  - Core pages: `directory/`, `knowledge/`, `search/`, `sitemap/`
  - No obsolete entries: `source.html`, `assets/source`, `atlas`
- `sitemap.xml` includes `<changefreq>` hints

**Failure messages:**
```
- assets/css/styles.css does not alias --ink to var(--ds-text)
- pages/learning/index.html missing required CSS links ['assets/css/instituteos-ds.css', 'assets/css/styles.css']
- pages/learning/index.html must link instituteos-ds.css before styles.css
- index.html has invalid canonical URL ['https://old-domain.com/']
- index.html has invalid og:url ['']
- robots.txt does not point at the canonical sitemap URL
- sitemap.xml does not include the canonical root URL
- sitemap.xml contains obsolete entry source.html
```

**Fix:**
- Run `node src/build.mjs` (sets canonical URLs)
- Edit `src/content/site.json` `baseUrl` if deploying to a new domain
- Update `assets/css/styles.css` to add missing CSS aliases
- Ensure `robots.txt` and `sitemap.xml` are regenerated by the build

### 4g. Hygiene & Safety

**Enforces:**
- No obsolete public artifacts remain on disk:
  - Paths: `atlas/`, `assets/source/AII.pdf`, `assets/js/atlas.js`, `source.html`, `src/content/pdf-pages.json`, `scripts/extract_pdf.py`
  - Images matching pattern `assets/img/source-page-*.png`
- No stale theme tokens (old color hex values or variable names from prior design):
  - Patterns: `#11383f`, `#0e7c7b`, `#bd8b2f`, `var(--teal)`, `docxology.github.io`
- No obsolete text in public files:
  - Patterns: `\bPDF\b`, `AII\.pdf`, `Source Atlas`, `atlas/`, `pdf-pages`, `Pages [0-9]`
- No direct `coda.io` URLs in:
  - Generated HTML files
  - `assets/css/styles.css`
  - `assets/js/site.js`
  - `robots.txt`, `sitemap.xml`
  - `README.md`, `AGENTS.md`
- No hardcoded external URLs in `src/build.mjs` (except allowed schema/feed URLs)
- `site.json` `sourcePdf` field removed (obsolete)
- No `Governance` category or blocked governance sources in registries

**Failure messages:**
```
- obsolete public artifact remains: atlas
- obsolete public image remains: assets/img/source-page-1.png
- assets/css/styles.css contains stale reference #0e7c7b
- README.md contains visible Coda/workspace wording
- src/build.mjs hardcodes external URLs instead of live-sources.json: ['https://example.org/x']
- site.json still contains the obsolete sourcePdf field
```

**Fix:**
- Delete obsolete files (they're dead code)
- Search and replace old hex colors and theme variables in CSS
- Replace direct Coda URLs with shortlinks in `live-sources.json`
- Move all external URLs to `live-sources.json` and reference by `sourceId`
- Remove the `sourcePdf` field from `site.json`

### 4h. Navigation

**Enforces:**
- Every generated page has dropdown navigation buttons:
  - `class="nav-menu-button"` present
  - `aria-expanded` and `data-nav-toggle` attributes for disclosure behavior

**Failure messages:**
```
- pages/learning/index.html lacks dropdown navigation buttons
- pages/learning/index.html lacks accessible navigation disclosure attributes
```

**Fix:**
- Rebuild with `node src/build.mjs` (navigation is rendered)

---

## Gate 5: Static Security (`check:security`)

**File:** `scripts/check_static_security.py`

**What it enforces:**
The strict **Content Security Policy (CSP)** and static-asset safety contract. All external interactions go through explicitly vetted channels.

### 5a. Content Security Policy (CSP) Meta Tag

**Enforces:**
- Every page has a CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="...">`
- CSP includes all required directives:
  - `default-src 'self'` — default to same-origin, block everything else
  - `script-src 'self'` — only same-origin scripts
  - `style-src 'self'` — only same-origin stylesheets
  - `img-src 'self' data:` — images from same-origin or data URLs (for inline icons)
  - `font-src 'self'` — fonts from same-origin only
  - `connect-src 'none'` — no network requests (fetch, XMLHttpRequest, WebSocket)
  - `object-src 'none'` — no `<embed>`, `<object>`, `<applet>`
  - `base-uri 'self'` — `<base href>` only to same-origin
  - `form-action 'none'` — no form submissions
  - `upgrade-insecure-requests` — auto-upgrade `http://` to `https://`

**Failure messages:**
```
- index.html: missing Content-Security-Policy meta tag
- pages/learning/index.html: CSP missing directives ['connect-src', 'form-action']
```

**Fix:**
- Add the meta tag to the page template in `src/render/layout.mjs`
- Ensure `src/render/security.mjs` exports the correct CSP string
- Rebuild with `node src/build.mjs`

### 5b. Referrer Policy

**Enforces:**
- Every page has a referrer policy meta tag: `<meta name="referrer" content="strict-origin-when-cross-origin">`
- This prevents leaked URLs in the Referer header on cross-origin navigation

**Failure messages:**
```
- pages/learning/index.html: missing strict referrer policy
```

**Fix:**
- Add to page template in `src/render/layout.mjs`

### 5c. Disallowed Tags

**Enforces:**
- No `<form>` tags (CSP forbids `form-action`)
- No `<iframe>` tags (CSP forbids object-src)
- No `<object>` or `<embed>` tags (CSP forbids object-src)
- No inline event handlers (`onclick=`, `onmouseover=`, etc.)

**Failure messages:**
```
- pages/learning/index.html: disallowed <iframe> tag
- pages/learning/index.html: inline event handler attribute onclick
```

**Fix:**
- Remove the tag from the HTML (never in generated files — fix the source JSON or template)
- Replace inline handlers with `data-*` attributes + external JS

### 5d. Scripts & Assets

**Enforces:**
- No inline `<script>` content (CSP forbids it)
  - Exception: JSON-LD `<script type="application/ld+json">` (not executable, allowed for schema.org data)
- No external scripts (`<script src="https://...">`; must be same-origin)
- No external stylesheets (`<link rel=stylesheet href="https://...">`; must be same-origin)
- No external images (`<img src="https://..."`; must be same-origin or `data:`)
  - Exception: `assets/img/instituteos/` brand images (pre-approved whitelist)
- Every image must have `alt` text
- No InstituteOS images outside the approved set: `ActInferServe.png`, `Dark_ActInfServe.png`

**Failure messages:**
```
- pages/learning/index.html: inline script content is not allowed
- pages/learning/index.html: external script is not allowed: https://cdn.example.org/lib.js
- pages/learning/index.html: external stylesheet is not allowed: https://fonts.googleapis.com/css
- pages/learning/index.html: external image is not allowed: https://example.org/logo.png
- pages/learning/index.html: image missing alt text: assets/img/diagram.png
- pages/learning/index.html: InstituteOS image is not an approved brand asset: assets/img/instituteos/custom-logo.png
```

**Fix:**
- Move inline scripts to external files in `assets/js/`
- Load fonts from `assets/css/fonts/` (managed by design-system)
- Use local or data URLs only for images
- Add `alt` attributes to all `<img>` tags
- Restrict InstituteOS images to the approved whitelist

### 5e. External Anchors (Links)

**Enforces:**
- Every external HTTP(S) link must be **backed**:
  - Exact match (or `/`-trimmed/suffixed variants) in `live-sources.json` with `ok: true`, OR
  - Host on the public vetted allowlist:
    - `youtube.com`, `youtu.be`
    - `activeinference.institute`
    - `github.com`
    - `zoom.us`
    - `meet.google.com`
    - `twitch.tv`
    - `odysee.com`
- No direct `coda.io` links (banned outright)
- Every external anchor must have `target="_blank"` (open in new tab)
- Every external anchor must have `rel="noopener noreferrer"` (prevent tab hijacking)
- Local and `mailto:` links are exempt

**Failure messages:**
```
- pages/learning/index.html: external anchor is not backed by live-sources.json or a vetted host: https://example.org/paper
- pages/learning/index.html: direct Coda anchor is not allowed: https://coda.io/d/abc123
- pages/learning/index.html: external anchor missing target=_blank: https://github.com/example
- pages/learning/index.html: external anchor missing noopener noreferrer: https://github.com/example
```

**Fix:**
- Register the URL in `live-sources.json` with `ok: true` (then run `npm run check:sources` to verify)
- Reference it from page JSON by `sourceId`, not raw `href`
- Or use the vetted host list for data-driven links (YouTube, GitHub, etc.)
- Renderer adds `target="_blank" rel="noopener noreferrer"` automatically for registered sources

---

## Live Sources & External Links: The Full Workflow

**File:** `src/content/live-sources.json`

External links are **not** raw `href` values. They're registered once in a manifest, then referenced by `sourceId`.

### Why This Matters

1. **Security gate** checks that anchors are "backed" — they must exist in `live-sources.json` or be on a vetted host
2. **Reachability gate** (`npm run check:sources`) verifies they still resolve
3. **Stale-link protection** — if a source is marked `ok: false` (dead), the renderer drops it silently instead of shipping a broken link

### Adding a New External Link

1. Add an entry to `src/content/live-sources.json`:
   ```json
   {
     "id": "learning-guide",
     "label": "Learning guide",
     "category": "Learning",
     "url": "https://example.org/guide",
     "sourceBasis": "Public guide verified on example.org",
     "finalUrl": "https://example.org/guide",
     "statusCode": 200,
     "ok": true,
     "checkedAt": "2026-06-28T00:00:00Z"
   }
   ```

2. Reference it from a page in `src/content/pages/`:
   ```json
   {
     "externalSourceIds": ["learning-guide"],
     "sections": [
       {
         "links": [{ "sourceId": "learning-guide", "label": "Read the guide" }]
       }
     ]
   }
   ```

3. Run the gates:
   ```bash
   node src/build.mjs
   npm run check:sources  # verify reachability (network)
   npm run check         # verify it's registered
   ```

### The `%40` Encoding Caveat

Google Calendar URLs and other resources with `@` characters are `%40`-encoded in the rendered HTML. Store the **`%40`-encoded** form in `url` so it matches the gate check:
```json
{
  "url": "https://calendar.google.com/calendar/...%40group.calendar.google.com"
}
```

---

## Gate Chaining: What Gates Depend on Each Other

The gate order matters because earlier gates set state for later ones:

```
build (generates HTML)
  ↓
check:links (validates generated HTML has no broken refs)
  ↓
check:instituteos (validates public data sync)
  ↓
check:design-system (validates CSS exports)
  ↓
check:site (validates content model, external links, structure)
  ↓
check:security (validates CSP, no disallowed tags, external anchors backed)
```

**Key dependency:** `check:site` and `check:security` both validate external anchors against `live-sources.json`. If either fails, check:

1. Is the source in `live-sources.json`?
2. Is `ok: true`?
3. Does the `url` exactly match (or `/`-trimmed/suffixed variant)?
4. Was `node src/build.mjs` run after adding/editing the source?

---

## Refactoring Constraints

### Internal Links & Folder Restructuring

If you rename or move a folder (e.g., `projects/learning` → `courses/learning`), **all gates fire**:

| Gate | What Breaks | What to Update |
|------|-------------|-----------------|
| `check:links` | All relative `href` attributes | The build regenerates these automatically; just rebuild |
| `check:site` | `url_dir_for_slug()` mappings if the program subpage set changes | Only if you rename program subpages; update `src/url-taxonomy.json` |
| `check:site` | Canonical URLs in `sitemap.xml` and page `<link rel=canonical>` | Regenerated by build; update `site.json` `baseUrl` if domain changes |
| `check:security` | No impact (asset paths are absolute from repo root) | None |

**Safe refactorings** (don't require gate updates):
- Rename a JSON file in `src/content/pages/` — the slug in the JSON is the source of truth
- Move a JSON file to a different directory — same as above
- Add new page slugs — just add them to the JSON and run the build

**Breaking refactorings** (require gate updates):
- Change `baseUrl` in `site.json` — updates all canonical URLs site-wide
- Rename a program subpage slug (e.g., `programs/learning` → `programs/courses`) — update `src/url-taxonomy.json` `programSubpageSlugs`
- Change the clean-URL mapping in `src/url-taxonomy.mjs` — regenerate and update the JSON version

### Live Sources & External Links

**Never** rename or delete a `live-sources.json` entry ID that's referenced from pages:
- It breaks the page (missing link)
- The security gate fails (`sourceId` not found)
- Solution: Add a new source with the new ID, update pages to reference it, then delete the old entry

**Renaming a source ID:**
```bash
# 1. Edit src/content/live-sources.json: rename "old-id" → "new-id"
# 2. Find all references: grep -r "old-id" src/content/pages/
# 3. Update each page JSON to use "new-id"
# 4. Update externalSourceIds array in those pages
# 5. Rebuild and check
node src/build.mjs
npm run check
```

### URL & Canonical Changes

If you change the **deployment domain** (e.g., GitHub Pages → apex domain):
1. Update `site.json` `baseUrl`
2. Run `node src/build.mjs` — this regenerates:
   - All canonical URLs in pages
   - `sitemap.xml` with the new base
   - `robots.txt` with the new sitemap URL
   - `version.json` with page count verification
3. Run `npm run check` — gates verify canonical URLs match the new base

All relative links, internal references, and CSS imports are unaffected (they're path-relative or root-relative).

### Design System & CSS

If you **reorganize CSS imports** (e.g., move fonts or change the link order):
1. `check:design-system` verifies fonts byte-match and are listed in the right order
2. `check:site` verifies the required link order: `instituteos-ds.css` → `styles.css`
3. Update `REQUIRED_CSS_LINK_ORDER` in `check_site_contract.py` if the order changes
4. Update `REQUIRED_STYLE_ALIASES` in `check_site_contract.py` if token names change

### Data & Record Counts

The gates enforce **exact record counts** in InstituteOS data:
- People: 8 (GitHub public contributors)
- Projects: N (all promoted repositories)
- Ideas: 30 (deduplicated tech-tree nodes)
- Ontology: 2 trees, 33 edges

If these change:
1. Update `src/content/instituteos/*.json` via `npm run sync:instituteos`
2. The gate automatically detects stale counts and fails
3. Fix the source (add/remove entries in the registries) or update the hardcoded count in `check_site_contract.py`

---

## Common Failure Scenarios & Fixes

| Scenario | Gates That Fail | Root Cause | Fix |
|----------|-----------------|-----------|-----|
| Added a new page but it doesn't show in navigation | `check:site` | Page slug not in `navigation.json` | Add `{ "slug": "new-page" }` to a nav group in `src/content/navigation.json` |
| External link on a page fails the security gate | `check:security` | Link not in `live-sources.json` or not marked `ok: true` | Add source to `live-sources.json`, run `npm run check:sources`, update page to use `sourceId` |
| Broken internal link after rebuild | `check:links` | Stale HTML or wrong `href` | Run `node src/build.mjs` again; if it persists, check the source JSON for typos in `slug` or `href` |
| Design-system CSS is stale | `check:design-system` | Didn't sync the export | Run `npm run export:website` in the sibling `design-system` repo |
| Public data contains private email | `check:instituteos` | Email leaked during sync | Remove the email from the source JSON in InstituteOS registries and re-sync |
| Page won't render its sections correctly | `check:site` | Missing required page fields | Ensure page JSON has `audience`, `resourceGroups`, `primaryActions`, `relatedSlugs`, `externalSourceIds` |
| Canonical URL is wrong | `check:site` | `site.json` `baseUrl` doesn't match deployment | Update `site.json` `baseUrl` to match where the site is served |

---

## Updating the Gates

Gates are read-only validation. To update a gate's rules:

1. **Add a new required field?** Update the checker script and `REQUIRED_*` constants
2. **Change CSP directives?** Edit `src/render/security.mjs` and `REQUIRED_CSP_DIRECTIVES` in `check_static_security.py`
3. **Rename/move a live source?** Update all references in `src/content/pages/*.json` and `externalSourceIds`
4. **Update design-system tokens?** Re-export CSS and sync fonts
5. **Change the content model (e.g., record counts)?** Update the checker constants and sync new data

All changes go through the gate suite before merge — gates are your guard rails.

---

## Summary Checklist

Before committing any change:

```bash
# 1. Make changes to source (JSON, templates, CSS, JS)
# 2. Rebuild
node src/build.mjs

# 3. Run the offline gate suite (no network)
npm run check

# 4. If gates pass and you've added/updated external links:
npm run check:sources  # verify they're reachable (optional, one-time after adding)

# 5. Commit
git add .
git commit -m "..."
```

All gates must pass. The gates enforce:
- **Links integrity:** no broken refs
- **Public safety:** no private data leaks
- **Design system alignment:** CSS exports and tokens fresh
- **Content contract:** proper structure, required fields, verified external links
- **Security:** strict CSP, no inline scripts, all external anchors backed and safe
