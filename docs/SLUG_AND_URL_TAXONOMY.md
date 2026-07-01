> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Slug → URL Taxonomy

## Two independent axes: source organization vs. output URL

Every refactoring decision on this site turns on one split, so it comes first:

| Axis | What it controls | Where it lives | Cost of change |
| --- | --- | --- | --- |
| **A — Source organization** | How maintainers group `.json` page sources for navigation | `src/content/pages/**` subfolders | **Free, reversible, invisible to the public.** The build walks the tree recursively and discards file path (see `walkPageJson()` in `src/data.mjs`). |
| **B — Output-URL taxonomy** | The public clean-URL path of every page | `src/url-taxonomy.mjs`/`.json` (`baseDirForSlug`, `localePrefix`) + slugs + `src/pages/ecosystem.mjs` | **Breaking.** Old URLs 404 without a redirect entry; touches the sitemap, canonicals, hreflang alternates, and (given the Squarespace → GitHub Pages cutover) live SEO equity. See [MIGRATION_AND_REDIRECTS.md](MIGRATION_AND_REDIRECTS.md). |

**Governance rule:** folder placement under `src/content/pages/` is maintainer-facing
only; the slug is identity. Axis A refactors are encouraged and need no approval.
Axis B refactors (changing what `baseDirForSlug()` returns for a slug, or renaming a
slug) are change-management events — gate them behind explicit approval plus a
redirect recipe before touching code.

There are two distinct families of "domain" pages that must not be conflated:
1. **Curated `active-inference-and-*` knowledge pages** — `.json` sources live in
   `src/content/pages/domains/` (an Axis-A grouping), routing **flat** to
   `/active-inference-and-<domain>/` (slug = file basename, no `domains/` prefix in
   the URL).
2. **Programmatically generated ecosystem domain pages** — emitted by
   `src/pages/ecosystem.mjs` as `ecosystem/<domain.slug>`, routing to
   `/ecosystem/<domain>/`. Renaming this to `/domains/<domain>/` would be an Axis-B
   change (see the worked example below) — it is currently **deferred**, not done.

Locale grouping under `/languages/` is a hypothetical Axis-B change that was
evaluated and **rejected**: the source catalogs (`src/content/i18n/*.json`) are
already cleanly grouped, so the only effect would be doubling every non-English
path depth for no maintainer benefit, at real SEO cost on a static host with no
server-side 301s.

## Slug→URL Taxonomy (Source of Truth)

The URL taxonomy is defined in **`src/url-taxonomy.mjs`** and the shared JSON config **`src/url-taxonomy.json`**.

### Core Rules: `baseDirForSlug(slug)` (data-driven)

`baseDirForSlug(slug)` in `src/url-taxonomy.mjs` maps a slug to its locale-agnostic
directory by **iterating the ordered routing rules** in `src/url-taxonomy.json`
(rather than hard-coded `if/else` branches):

```javascript
export function baseDirForSlug(slug) {
  if (slug === _ROUTING.indexSlug) {
    return "";                                          // → index.html (root)
  }
  for (const rule of _ROUTING.rules) {
    if (rule.type === "prefix" && slug.startsWith(rule.match)) {
      return `${rule.dir}${slug.slice(rule.match.length)}`;  // strip prefix, reroot
    }
    if (rule.type === "set" && _SLUG_SETS[rule.match]?.has(slug)) {
      return `${rule.dir}${slug}`;                      // reroot a named slug-set
    }
  }
  return slug;                                          // → <slug>/ (everything else)
}
```

### The routing table (`src/url-taxonomy.json`)

Both the JS build and the Python contract checker (`scripts/check_site_contract.py`)
read these rules, so they can never disagree:

```json
{
  "programSubpageSlugs": [
    "fellowship",
    "internship",
    "mentorship",
    "partnership",
    "philanthropy"
  ],
  "routing": {
    "indexSlug": "index",
    "rules": [
      { "type": "prefix", "match": "project-", "dir": "projects/" },
      { "type": "set", "match": "programSubpageSlugs", "dir": "programs/" }
    ]
  }
}
```

- A **`prefix`** rule strips `match` and reroots the remainder under `dir`
  (`project-affordances` → `projects/affordances`).
- A **`set`** rule reroots an entire named slug-set under `dir`, keeping the full
  slug (`fellowship` → `programs/fellowship`).
- Anything matching no rule routes to root `/<slug>/`.

To add a routing family, add a rule here — no code change in `url-taxonomy.mjs` or
`check_site_contract.py` is needed. Verify with `npm run check` (the `check:site`
gate asserts the JS build and Python checker agree on every URL).

### Slug→URL Examples

| Slug | Source File | `baseDirForSlug()` | Output Path | URL |
|------|-------------|-------------------|-------------|-----|
| `index` | (hardcoded) | `""` | `index.html` | `/` |
| `about` | `institute/about.json` | `about` | `about/index.html` | `/about/` |
| `resources` | `resources.json` | `resources` | `resources/index.html` | `/resources/` |
| `fellowship` | `programs/fellowship.json` | `programs/fellowship` | `programs/fellowship/index.html` | `/programs/fellowship/` |
| `project-active-inference-ontology` | `projects/project-active-inference-ontology.json` | `projects/active-inference-ontology` | `projects/active-inference-ontology/index.html` | `/projects/active-inference-ontology/` |
| `project-affordances` | `projects/project-affordances.json` | `projects/affordances` | `projects/affordances/index.html` | `/projects/affordances/` |
| `ecosystem/ai-and-ecology` | (generated by `ecosystem.mjs`) | `ecosystem/ai-and-ecology` | `ecosystem/ai-and-ecology/index.html` | `/ecosystem/ai-and-ecology/` |

### Output File Path Computation

```javascript
// Active-locale clean directory for a slug
export function urlDirForSlug(slug) {
  return localeDirForSlug(slug, activeLocale());
}

// Directory under a specific locale
export function localeDirForSlug(slug, code = activeLocale()) {
  const base = baseDirForSlug(slug);      // "projects/affordances" or "about" etc.
  const prefix = localePrefix(code);      // "" for en, "es/" for es, etc.
  if (!base) {
    return prefix ? prefix.slice(0, -1) : "";
  }
  return `${prefix}${base}`;
}

// The actual file path: <dir>/index.html
export function outputPathForSlug(slug) {
  return localeOutputPathForSlug(slug, activeLocale());
}

export function localeOutputPathForSlug(slug, code = activeLocale()) {
  const dir = localeDirForSlug(slug, code);
  return dir ? `${dir}/index.html` : "index.html";
}
```

**In code flow:**
1. `build()` calls `outputPathForSlug(slug)` for each page
2. This calls `localeOutputPathForSlug(slug, activeLocale())`
3. Which calls `localeDirForSlug(slug, activeLocale())`
4. Which calls `baseDirForSlug(slug)` + `localePrefix(activeLocale())`
5. Result: e.g., `"projects/affordances/index.html"` or `"es/projects/affordances/index.html"`
6. Passed to `writeFile()`, which prepends the repo root and writes to disk

## Locale Output Paths

### Locale Prefix System

The `localePrefix()` function in `src/url-taxonomy.mjs:27–29` applies the locale code as a path segment:

```javascript
export function localePrefix(code = activeLocale()) {
  return code && code !== DEFAULT_LOCALE ? `${code}/` : "";
}
```

- **Default locale** (`en`): No prefix → root
- **Non-default locales**: Prefix with locale code → own subtree

### Locale Registry

**`src/i18n/locales.json`** defines the available locales:

```json
{
  "defaultLocale": "en",
  "locales": [
    { "code": "en", "name": "English", "nativeName": "English", "machine": false },
    { "code": "es", "name": "Spanish", "nativeName": "Español", "machine": true },
    { "code": "fr", "name": "French", "nativeName": "Français", "machine": true },
    { /* ... more locales: de, pt, it, ru, zh, ja, ko, hi, ar ... */ }
  ]
}
```

### Build Locale Loop

In `src/build.mjs:50–56`:

```javascript
for (const locale of LOCALES) {
  setActiveLocale(locale.code);              // Activate locale context
  for (const [slug, render] of slugRenderers) {
    writeFile(outputPathForSlug(slug), render());
  }
}
```

For each locale iteration:
- `activeLocale()` returns the current locale code
- `localePrefix()` returns the prefix for that locale
- All `urlDirForSlug()` calls return paths with the correct prefix
- All `hrefForSlug()` calls compute relative paths within that locale's subtree

### Locale Examples

For slug `"about"` and page at `src/content/pages/institute/about.json`:

| Locale | Code | `localePrefix()` | `urlDirForSlug()` | Output Path |
|--------|------|------------------|-------------------|-------------|
| English (default) | `en` | `""` | `about` | `about/index.html` |
| Spanish | `es` | `es/` | `es/about` | `es/about/index.html` |
| German | `de` | `de/` | `de/about` | `de/about/index.html` |

For slug `"project-affordances"`:

| Locale | Code | Output Path |
|--------|------|-------------|
| English | `en` | `projects/affordances/index.html` |
| Spanish | `es` | `es/projects/affordances/index.html` |
| German | `de` | `de/projects/affordances/index.html` |

### Root Home Page in Non-Default Locales

When the slug is `"index"` (home page) and locale is not `en`:
- `baseDirForSlug("index")` returns `""`
- `localePrefix("es")` returns `"es/"`
- Result: `localeDirForSlug("index", "es")` returns `"es"` (not empty + prefix)
- Output: `es/index.html`

This allows the home page to exist at both `/` (English) and `/es/` (Spanish).

### Translation Catalogs and i18n

Located in `src/i18n/index.mjs`:

- Translation catalogs live at `src/content/i18n/<code>.json` (e.g., `es.json`, `de.json`)
- Keyed by the exact English source string
- The `tr(text)` function looks up `text` in the active locale's catalog
- Falls back to English if translation is missing

No runtime translation occurs (CSP forbids network fetch). All locales are fully pre-rendered at build time.

## Rendering Pages

### Route Renderer Registry

In `src/build.mjs:30–41`, the `slugRenderers` array lists every routable page:

```javascript
const slugRenderers = [
  ["index", homePage],
  ...siteData.pages.map((page) => [page.slug, () => publicPage(page)]),
  ["knowledge", knowledgePage],
  ["resources", resourcesPage],
  ["directory", directoryPage],
  ["search", searchPage],
  ["simulations", simulationsPage],
  ["calendar", calendarPage],
  ["sitemap", sitemapPage],
  ...ecosystemDomainPages().map((page) => [page.slug, page.render]),
];
```

### Hard-Coded Routes

Some pages are not loaded from `siteData.pages` but generated programmatically:

- **`knowledge`** — Open Source Map table (from `src/render/knowledge.mjs`)
- **`resources`** — Resource directory (from `src/pages/resources.mjs`)
- **`directory`** — People/projects directory (from `src/pages/directory.mjs`)
- **`search`** — Search page with embedded index (from `src/pages/search.mjs`)
- **`simulations`** — Simulations gallery (from `src/pages/simulations.mjs`)
- **`calendar`** — Event calendar (from `src/pages/calendar.mjs`)
- **`sitemap`** — HTML sitemap (from `src/pages/sitemap.mjs`)

### Ecosystem Domain Pages

Generated dynamically by `ecosystemDomainPages()` in `src/pages/ecosystem.mjs:54–102`:

- One page per domain in `siteData.instituteos.domainProjects.domains`
- Slugs: `ecosystem/<domain.slug>` (e.g., `ecosystem/ai-and-ecology`)
- Not part of `siteData.pages`; generated on-the-fly per locale

## HTML Layout and Output

Every routed page wraps its body with the `layout()` function in `src/render/layout.mjs`:

```javascript
export function layout({
  title,
  description,
  currentDir = "",      // e.g., "projects/affordances" or "about"
  canonicalPath,
  body,                 // The rendered page body (HTML string)
  bodyClass = "",
  slug = "",            // For OG cards and language switcher
  robots = "",
  ogType,
  redirects = false
}) {
  // Returns full <!doctype html> document with:
  // - Head metadata (SEO, CSP, canonical URL)
  // - Header (brand, nav, search, language switcher)
  // - <main> body
  // - Footer
  // - Shared <script> tags for JS features (graphs, search, redirects)
}
```

### Relative Path Resolution

All internal links are computed relative to the **current page directory** using `hrefForSlug(target, currentDir)`:

```javascript
export function hrefForSlug(targetSlug, currentDir = "", anchor = "") {
  const targetDir = urlDirForSlug(targetSlug);
  let rel = path.posix.relative(currentDir, targetDir);
  if (rel === "") {
    rel = "./";
  }
  if (!rel.endsWith("/")) {
    rel += "/";
  }
  return `${rel}${hash}`;
}
```

Examples from `/projects/affordances/index.html` (currentDir = `"projects/affordances"`):
- Link to `/about/`: `../../about/`
- Link to `/resources/`: `../../resources/`
- Link to `/projects/inference-engines/`: `../inference-engines/`
- Link to home (`/`): `../../`

### Asset Prefix Computation

The `relPrefix(currentDir)` function in `src/render/urls.mjs:71–77` computes the number of `../` hops to the repo root:

```javascript
export function relPrefix(currentDir = "") {
  if (!currentDir) {
    return "";
  }
  const depth = currentDir.split("/").filter(Boolean).length;
  return "../".repeat(depth);
}
```

Examples:
- From root (`currentDir = ""`): `""` → `/assets/css/site.css` (absolute)
- From `/about/`: `currentDir = "about"`, depth = 1 → `"../"` → `../assets/css/site.css`
- From `/projects/affordances/`: `currentDir = "projects/affordances"`, depth = 2 → `"../../"` → `../../assets/css/site.css`

This ensures CSS, JS, and images resolve correctly from any directory depth.

## Adding a New URL/Route Pattern

To add a new top-level URL pattern, follow this checklist:

### 1. If it's a simple slug-based page in JSON

Add a `.json` file anywhere under `src/content/pages/` (folder nesting doesn't matter):

```bash
src/content/pages/my-section/my-page.json
```

With a slug:
```json
{
  "slug": "my-new-page",
  "title": "My New Page",
  "sections": [ /* ... */ ]
}
```

The page automatically routes to `/my-new-page/` via the default rule in `baseDirForSlug()`.

### 2. If it needs a custom directory pattern (e.g., `/custom/<slug>/`)

Modify **`src/url-taxonomy.mjs`** in the `baseDirForSlug()` function:

```javascript
export function baseDirForSlug(slug) {
  if (slug === "index") {
    return "";
  }
  if (slug.startsWith("custom-")) {
    return `custom/${slug.slice("custom-".length)}`;  // → /custom/<slug>/
  }
  if (slug.startsWith("project-")) {
    return `projects/${slug.slice("project-".length)}`;
  }
  if (PROGRAM_SUBPAGE_SLUGS.has(slug)) {
    return `programs/${slug}`;
  }
  return slug;
}
```

Now slugs like `"custom-my-route"` will output to `/custom/my-route/`.

### 3. If it's a program-like subpage

Add the slug to **`src/url-taxonomy.json`**:

```json
{
  "programSubpageSlugs": [
    "fellowship",
    "internship",
    "mentorship",
    "partnership",
    "philanthropy",
    "new-subpage"
  ]
}
```

Then reference it in `baseDirForSlug()` via the existing `PROGRAM_SUBPAGE_SLUGS` check.

### 4. If it's a programmatically generated page (like ecosystem domains)

Create a function like `ecosystemDomainPages()` in `src/pages/ecosystem.mjs` that returns an array of `{ slug, render }` objects, and add it to `slugRenderers` in `src/build.mjs`.

The render function must:
- Call `urlDirForSlug(slug)` to get the current directory
- Use `hrefForSlug()` for all internal links
- Call `layout()` with the computed `currentDir`
- Return the HTML string

### 5. Verify with the contract checker

After adding a new slug or URL pattern, run:
```bash
npm run check:site
```

This runs `scripts/check_site_contract.py`, which validates that:
- Every routed slug has a valid output path
- No duplicate slugs exist
- Program subpage slugs match `url-taxonomy.json`
- All URLs are listed in `sitemap.xml`

## Refactoring Implications

### Q: Does output URL derive from source file PATH or from the slug field?

**Answer: The slug field is the sole source of truth.** The source file's path (e.g., `institute/about.json` vs. `about.json`) is **irrelevant** to the output URL.

Evidence:
- `src/data.mjs:45–58`: The `walkPageJson()` function recursively loads all `.json` files from `src/content/pages/` without regard to folder nesting. The loaded page object is a plain JS object with a `slug` field.
- `src/data.mjs:61–63`: Pages are sorted only by `order` and `slug`, not by file path.
- `src/url-taxonomy.mjs:33–47`: The `baseDirForSlug()` function reads only the slug string, never the file path.
- `src/build.mjs:32`: The build loops over `siteData.pages`, extracting `page.slug` and ignoring file location entirely.

### Q: Can source page files be moved between folders under `src/content/pages/` WITHOUT changing URLs?

**Answer: Yes, absolutely.** Reorganizing the source folder structure has zero impact on output URLs. You can move:
- `institute/about.json` → `about.json` ✓ No URL change
- `programs/fellowship.json` → `participate/programs/fellowship.json` ✓ No URL change
- `projects/project-affordances.json` → `archive/project-affordances.json` ✓ No URL change

The slug `"about"` will always output to `/about/index.html` no matter where the JSON file lives.

### Q: What would have to change to put AI&X pages under a `/domains/` URL prefix?

**Answer:** Add a conditional in `baseDirForSlug()` to detect domain-related slugs and map them accordingly.

Currently, ecosystem pages are generated with slugs like `"ecosystem/ai-and-ecology"` and route to `/ecosystem/ai-and-ecology/` because `baseDirForSlug("ecosystem/ai-and-ecology")` returns the slug itself (default rule at line 46).

To route under `/domains/`:

**Option 1: Rename the slug prefix**

In `src/pages/ecosystem.mjs:62`, change:
```javascript
const routedSlug = `ecosystem/${domain.slug}`;
```

to:
```javascript
const routedSlug = `domain-${domain.slug}`;
```

Then add a rule in `src/url-taxonomy.mjs`:
```javascript
if (slug.startsWith("domain-")) {
  return `domains/${slug.slice("domain-".length)}`;
}
```

Result: `"domain-ai-and-ecology"` → `/domains/ai-and-ecology/`

**Option 2: Pattern matching by slug**

If the slugs are not systematically named, add a list in `url-taxonomy.json`:
```json
{
  "domainSlugs": ["ecosystem/ai-and-ecology", "ecosystem/healthcare", /* ... */],
  "programSubpageSlugs": [ /* ... */ ]
}
```

Then in `baseDirForSlug()`:
```javascript
if (DOMAIN_SLUGS.has(slug)) {
  return `domains/${slug.replace(/^ecosystem\//, "")}`;
}
```

**Changes required:**
- `src/url-taxonomy.mjs` (add the conditional logic)
- `src/url-taxonomy.json` (optionally add the slug list if pattern matching)
- `src/pages/ecosystem.mjs` (optionally rename slugs to use a consistent prefix)
- Run `npm run check:site` to validate

### Q: What would have to change to put locales under `/languages/` instead of `/<code>/`?

**Answer:** Modify the locale prefix system throughout `url-taxonomy.mjs` and `render/layout.mjs`, which is a significant refactor.

Currently, non-default locales add a prefix via:
```javascript
export function localePrefix(code = activeLocale()) {
  return code && code !== DEFAULT_LOCALE ? `${code}/` : "";
}
```

To use `/languages/` prefix instead:
```javascript
export function localePrefix(code = activeLocale()) {
  return code && code !== DEFAULT_LOCALE ? `languages/${code}/` : "";
}
```

But this cascades to many places:

1. **`src/url-taxonomy.mjs`** — Update:
   - `localePrefix()` (as above)
   - `localeDirForSlug()` (would work unchanged)
   - `localeOutputPathForSlug()` (would work unchanged)

2. **`src/render/layout.mjs`** — The language switcher and hreflang links use `crossLocaleHref()` and `localeOutputPathForSlug()`, which would automatically adjust.

3. **`src/i18n/index.mjs`** — No changes needed; the active-locale context is independent of the prefix.

4. **`scripts/check_site_contract.py`** — The Python contract checker would need to know about the `/languages/` prefix if it validates URLs.

**Files that would change:**
- `src/url-taxonomy.mjs` (localePrefix function)
- Possibly `scripts/check_site_contract.py` (URL validation)

**Files that stay the same:**
- All renderers (they call `urlDirForSlug()`, which would automatically return `/languages/es/...`)
- All internal link computation (relative paths would still work)
- Page structure and content (unchanged)

**Migration impact:**
- All non-English URLs would change: `/es/about/` → `/languages/es/about/`
- Old URLs would return 404 unless a redirect script is added
- The 404.html redirect handler would need updating if it maps legacy URLs

**Effort:** Moderate — mostly configuration, but requires testing all cross-locale links and potentially adding a legacy-URL redirect handler.

## Related Documentation

- `src/AGENTS.md` — High-level build pipeline walkthrough
- `src/render/AGENTS.md` — Rendering module structure
- `scripts/check_site_contract.py` — URL/slug contract validation (shares `url-taxonomy.json` with the JS build)
- `src/build.mjs` — Full build entry point with all renderer assembly
