> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Build Pipeline and Slug→URL Taxonomy

## Overview

The Institute website is a static-site generator that converts JSON content to a multi-locale HTML site. The build runs once, renders all content for all locales, and commits the output HTML to the repo root (served by GitHub Pages). **The source of truth is the page's `slug` field, not its file location.**

Run the build with:
```bash
node src/build.mjs
```

## End-to-End Build Flow

### Step 1: Load Content (`src/data.mjs`)

The data module is the single entry point that performs all load-time side effects:

```javascript
// Load all JSON content recursively from src/content/
export const siteData = {
  site: loadJson("site.json"),
  navigation: loadJson("navigation.json"),
  pages: walkPageJson(pagesDir),  // Recursively walks all .json under src/content/pages/
  instituteos: { /* nested public data slices */ }
}
```

**Key property:** `siteData.pages` is built by `walkPageJson()`, which recursively finds every `.json` file under `src/content/pages/` (regardless of subfolder nesting — `institute/`, `programs/`, `projects/`, `communications/`, `participate/`) and loads them as page objects sorted by `order` field then alphabetically by `slug`.

Each page has required fields:
- `slug`: The URL identity (immutable, determines output path)
- `title`: Page title
- `sections[]`: Content sections

Example from `src/content/pages/institute/about.json`:
```json
{
  "slug": "about",
  "title": "About the Institute",
  "sections": [ /* ... */ ]
}
```

The slug `"about"` **is not derived from the folder path** (`institute/`); it is the explicit identity that determines the URL.

### Step 2: Render All Pages for All Locales (`src/build.mjs`)

```javascript
for (const locale of LOCALES) {           // [en, es, fr, de, ...]
  setActiveLocale(locale.code);           // Switch active locale context
  for (const [slug, render] of slugRenderers) {
    writeFile(outputPathForSlug(slug), render());  // Write to disk
  }
}
```

Every renderer reads the active locale via `activeLocale()` and uses it to:
- Resolve internal link hrefs (via `hrefForSlug()`)
- Compute the current page directory (via `urlDirForSlug()`)
- Apply translation lookups (via `tr()`)

**Key insight:** The active-locale switch is the **only** thing that moves the entire site. No per-renderer changes needed.

### Step 3: Write Output (`src/lib/output.mjs`)

```javascript
export function writeFile(file, html) {
  ensure(path.dirname(out(file)));                    // Create parent dirs
  fs.writeFileSync(out(file), 
    html.replace(/[ \t]+$/gm, ''),                    // Trim trailing whitespace
    "utf8"
  );
}
```

The `out()` helper joins the repo root with the provided path:
```javascript
export const out = (...parts) => path.join(root, ...parts);
```

**Output always writes to the repo root** (not to `src/output/` or similar). GitHub Pages serves the root of the `main` branch.

### Step 4: Root Singletons (Default Locale Only)

After all locale passes complete, these files emit once in the default-locale context:

- `404.html` — Flat root file (GitHub Pages requirement), `robots: noindex`
- `robots.txt` — With sitemap reference
- `sitemap.xml` — Priority/changefreq keyed on URL depth
- `version.json` — Site version + build provenance (byte-stable)
- `feed.xml`, `feed.json` — RSS and JSON Feed of Institute updates
- `manifest.webmanifest` — PWA manifest
- `.well-known/security.txt` — Responsible-disclosure contact
- `assets/js/search-data.js` — Embedded search index
- `content/i18n/_strings.json` — (only if `I18N_EXTRACT=1`)
