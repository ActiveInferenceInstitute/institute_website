> Part of the `institute_website` documentation set — see [README.md](README.md).
> This is a point-in-time assessment + change log of the folder/route refactor.

# Folder & Route Refactoring Assessment

## Implementation status (2026-06-28)

| Item | Status |
| --- | --- |
| `docs/` folder (this set) | ✅ Done |
| **Phase 1 — move `active-inference-and-*` pages → `src/content/pages/domains/`** | ✅ **Done & verified** |
| Locales → `/languages/` (Axis B) | ❌ **Not done — recommended against** (see §b) |
| `/ecosystem/<domain>/` → `/domains/<domain>/` (Axis B) | ⏸️ Deferred, gated behind approval (see §a2) |
| Codify `baseDirForSlug` prefixes as `url-taxonomy.json` data | ⏸️ Recommended, deferred |
| Taxonomy-driven redirect generator | ⏸️ Recommended as prerequisite for any Axis-B change |

**Phase 1 verification (executed):** all six `active-inference-and-*` page sources were
moved out of `src/content/pages/institute/` into `src/content/pages/domains/`
(via the InstituteOS exporter's new `OutputTarget.PAGES_DOMAINS`). `npm run build`
still emits **1236 pages across 12 locales**, every domain page still resolves at its
**unchanged** URL (`/active-inference-and-<domain>/` and `/<locale>/active-inference-and-<domain>/`),
and **all five gates pass** (`check:links`, `check:instituteos`, `check:design-system`,
`check:site`, `check:security`). This empirically confirms the core invariant below.

**Open question #6 answered:** `docs/` is **not** built into the site. The build
(`src/build.mjs` → `walkPageJson(src/content/pages/)`) only walks `src/content/pages/`
for page JSON and named registries under `src/content/`; a top-level `docs/` folder of
Markdown is never read by any generator and `check:links` only scans `*.html`.

---

## Executive Summary

The website has a single-point-of-control routing architecture in which **the output
URL is derived exclusively from the `slug` field of each page object, never from the
source file's location on disk** (`src/data.mjs:47` `walkPageJson()` walks
`src/content/pages/` recursively and discards file path; `src/url-taxonomy.mjs:33`
`baseDirForSlug()` reads only the slug string). This produces a decisive split that
should govern every refactoring decision:

- **Source organization is free and safe.** Any `.json` page under
  `src/content/pages/` can be moved between maintainer-facing subfolders with **zero**
  URL, build, sitemap, redirect, or gate impact.
- **Output-URL taxonomy is the public contract.** Root-level output folders (`/de/`,
  `/active-inference-and-robotics/`, `/ecosystem/<domain>/`, `/programs/fellowship/`)
  **are** the live URLs. Changing them breaks bookmarks, backlinks, canonicals,
  hreflang alternates, the XML sitemap, and feed links — and given the **recent
  Squarespace → GitHub Pages cutover**, the site is in exactly the window where SEO
  equity is most fragile.

**One line:** proceed with source-only regroupings (the `domains/` folder is the clear
win — now done), document the taxonomy and gates (this `docs/` folder), and **gate
every output-URL change behind explicit approval plus a redirect recipe.** Do not touch
the locale URL structure.

---

## The Two Independent Axes

| Axis | What it controls | Where it lives | Cost of change |
| --- | --- | --- | --- |
| **Axis A — Source organization** | How maintainers find/group `.json` page sources | `src/content/pages/**` subfolders | **Free, reversible, invisible to the public.** |
| **Axis B — Output-URL taxonomy** | The public clean-URL path of every page | `src/url-taxonomy.mjs` (`baseDirForSlug`, `localePrefix`) + slugs + `ecosystem.mjs` | **Breaking.** Old URLs 404 without redirects; sitemap regen, search-console resubmission, SEO decay window. |

The load-bearing governance rule: **folder placement under `src/content/pages/` is
maintainer-facing only; the slug is identity.** Axis A refactors are encouraged; Axis B
refactors are change-management events.

There are **two distinct families of "domain" pages**, which must not be merged blindly:
1. **Curated `active-inference-and-*` knowledge pages** — now under
   `src/content/pages/domains/`, routing **flat** to `/active-inference-and-<domain>/`
   (slug = file basename). *This is the family the InstituteOS pipeline generates.*
2. **Programmatically generated ecosystem domain pages** — emitted by
   `src/pages/ecosystem.mjs:62` as `ecosystem/<domain.slug>`, routing to
   `/ecosystem/<domain>/`.

(1) is an Axis-A source-folder question; (2) is an Axis-B output question.

---

## Per-Proposal Analysis

### (a1) Group "AI & X" pages under `domains/` — source only ✅ DONE

- **What changed:** all `active-inference-and-*.json` page sources now live in
  `src/content/pages/domains/` instead of `institute/`. The InstituteOS exporter writes
  there via a new `OutputTarget.PAGES_DOMAINS` (`contract.py`), with
  `ResearchDomainsExporter.target` repointed accordingly.
- **URL impact:** **None.** Slugs unchanged; output stays `/active-inference-and-<domain>/`.
- **Risk:** Low, fully reversible. **Verified:** build + all gates green.
- **Recommendation:** **Done.** Scales cleanly for future `active-inference-and-economics`, `-climate`, etc.

### (a2) Rename ecosystem route `/ecosystem/<domain>/` → `/domains/<domain>/` — Axis B ⏸️ DEFER

- Prefer the data-driven option: add a `domainRouteSlugs` set to `src/url-taxonomy.json`
  consumed by a conditional in `baseDirForSlug()`, keeping content slugs stable.
- **URL impact:** **Breaking** for ~8 ecosystem pages + per-locale variants. SEO impact
  HIGH during the post-cutover window.
- **Recommendation:** **Defer; gate behind explicit approval + redirect recipe** (and a
  Search Console change-of-address). Note client-side `redirects.js` rewrites are
  crawler-invisible — prefer pre-generated meta-refresh pages for SEO.

### (b) Group locales under `languages/` — Axis B ❌ NOT RECOMMENDED

- One-line code change (`localePrefix()` at `src/url-taxonomy.mjs:27`), but it changes
  **every** non-English URL (`/es/about/` → `/languages/es/about/`), doubling path depth.
- The source catalogs (`src/content/i18n/*.json`) are **already cleanly grouped**, so
  this changes only the public URL — at **severe** SEO cost, on a static host with no
  server 301s, for **no maintainer benefit**.
- **Recommendation:** **Do not do this.** The current flat `/<code>/` scheme is shorter
  and standard. There is no business reason in evidence to justify it.

### (c) Other source-folder regroupings (Axis A)

All zero-URL-impact and reversible; evaluated on maintainer value:

- **`pages/domains/`** — done (a1).
- **`pages/meta/`** for `activity`/`measure`/`strategy`/`history`/`video`/`weekly` —
  zero impact, but `institute/` is currently manageable. **Not now** (churn without payoff).
- **`pages/programs/units/`** for `eduactive`/`reinference` — **not recommended** (lightweight).
- **`pages/communications/`** — **defer** until publication needs arise.
- **Codify the taxonomy as data:** migrate hard-coded prefix logic in `baseDirForSlug()`
  into `src/url-taxonomy.json` rule sets (matching the existing `programSubpageSlugs`
  pattern shared with `scripts/check_site_contract.py`). Source-only, improves modularity,
  keeps JS/Python in sync. **Recommended** as a careful, `check:site`-parity-gated change.

### (d) Route/taxonomy improvements (Axis B)

- Unifying the flat (`active-inference-and-*`) and prefixed (`ecosystem/<domain>`,
  `project-<id>`, program subpages) families is an output-URL change — **document the
  current convention rather than change it.**
- **Redirect generation tooling:** build a taxonomy-driven `scripts/generate-redirects.mjs`
  (+ `npm run check:redirects`) **before** any Axis-B change; hand-written maps at
  170–330 entries are error-prone.

---

## Recommended Phased Plan

**Phase 0 — Documentation & guardrails (no code, no URLs).** ✅ Done — this `docs/` folder,
leading with `SLUG_AND_URL_TAXONOMY.md`, `GATES_AND_VALIDATION.md`, and
`MIGRATION_AND_REDIRECTS.md`.

**Phase 1 — Safe source-only wins (Axis A).** ✅ `domains/` move done and verified.
Optional next: migrate `baseDirForSlug()` prefixes into `url-taxonomy.json` (test-gated).

**Phase 2 — URL changes (Axis B) — only behind explicit approval.** For any approved
change: build the redirect generator first, generate the map, add entries (and/or
meta-refresh pages for crawlers), update `check_site_contract.py`, rebuild, run all gates,
deploy, submit Search Console change-of-address, maintain redirects 6–12 months. Locale
`/languages/` restructure is explicitly **out of scope**.

Each phase is independently shippable; Phase 1 is fully reversible.

---

## Open Questions for the Maintainer

1. **Business driver?** Is there any external/brand/SEO driver for `/domains/` or
   `/languages/` URLs, or is the motivation source-tree tidiness? If the latter, the
   Axis-A `domains/` move (done) already satisfies it at zero risk.
2. **Backlink inventory:** how many external sites link to `/ecosystem/<domain>/`? This
   decides whether (a2) is worth the redirect cost.
3. **Crawler redirect strategy:** are client-side `redirects.js` rewrites acceptable, or
   should approved URL changes emit pre-generated meta-refresh pages?
4. **Search Console ownership:** who submits a change-of-address and monitors crawl errors?
5. **Does `check_site_contract.py` fully mirror `url-taxonomy.mjs`,** or only
   `programSubpageSlugs`? This sets the true blast radius of any taxonomy rule change.
