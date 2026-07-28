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

**Client-Side Redirect Script**: `assets/js/redirects.js` is loaded **only** on `404.html` (via a `<script>` tag with `defer`). It implements three independent mechanisms:

1. **`MAP`** — a flat, English-only lookup table of one-off Squarespace-era
   aliases (`about-us` → `about/`). These pre-date the locale system entirely,
   so `MAP` is never locale-aware.
2. **`PREFIX_REDIRECTS`** (added v3.0.0) — locale-aware structural renames for
   `"prefix"`-routed families (an Axis-B change in
   [SLUG_AND_URL_TAXONOMY.md](SLUG_AND_URL_TAXONOMY.md)), where every member
   shares a literal slug prefix. Each entry is one
   `{ "from": "<old-prefix>", "to": "<new-dir>" }` pair; one entry covers the
   rename across **all 12 locales** — the script strips a leading locale
   segment before matching, then re-attaches it to the destination.
3. **`SET_REDIRECTS`** (added v4.0.0) — the same idea as `PREFIX_REDIRECTS`,
   for `"set"`-routed families whose slugs share **no** common string prefix
   (`board-of-directors`, `officers`, `2025`, …). Each entry is one
   `{ "from": "<old-exact-slug>", "to": "<new-full-path>" }` pair, matched by
   exact equality (not prefix), locale-aware the same way.

On a 404, the script:
1. Reads `location.pathname` and normalizes it (strips leading/trailing slashes, lowercases, removes `.html` suffix)
2. Looks it up in `MAP` first (exact match, full path including any locale prefix)
3. On a `MAP` miss, strips a recognized leading locale segment (if any), then tests the remainder against each `PREFIX_REDIRECTS` rule (prefix match), then each `SET_REDIRECTS` rule (exact match); on a match, re-attaches the locale prefix to the computed destination
4. On any match, calls `location.replace()` to the new clean URL
5. On a full miss, allows the normal 404 page to display

**Base-Path Awareness**: The script reads a `data-base` attribute from its own `<script>` tag, allowing it to work at both the apex domain (`/`) and project-page bases (`/institute_website/`). It strips the base from the incoming path and prepends it to destination URLs.

**CSP-Safe**: The script makes no network requests and contains no external dependencies — all three redirect tables are inline JSON. This satisfies the strict Content-Security-Policy.

**Gated by `check:redirects`** (`scripts/check_redirects.py`, part of `npm run check`): verifies every `MAP`, `PREFIX_REDIRECTS`-, and `SET_REDIRECTS`-derived destination resolves to a real built file, that each `PREFIX_REDIRECTS`/`SET_REDIRECTS` entry has a matching `"prefix"`/`"set"` rule in `src/url-taxonomy.json`, and — critically — that the **old** pre-migration output directories have actually been removed (`git rm`'d), since the build only ever adds files and the redirect script only fires once GitHub Pages returns a 404 for the old path. Note `SET_REDIRECTS` is deliberately **not** required to cover every member of every `"set"`-routed family — `programSubpageSlugs` has always routed to `programs/<slug>/` and never had a flat URL to migrate away from, so it needs no entries at all.

### How Legacy URLs Become 404s

When Squarespace hosted the apex domain, requests like `/fellowship` returned a 200 page. After cutover to GitHub Pages, GitHub sees no built file at `/fellowship/index.html` and serves `404.html` instead, triggering the redirect script.

---

## Legacy-URL and Shortlink Redirect Table

### Apex Page Redirects (MAP in assets/js/redirects.js)

All keys are normalized (lowercase, no leading/trailing slash, no `.html`):

| Old Squarespace Path | New Clean URL | Notes |
|---|---|---|
| `/home` | `/` | Home redirect |
| `/welcome` | `/get-involved/` | Welcome → Get involved |
| `/about-us` | `/about/` | About alias (`/history` is its own live page, not a redirect) |
| `/bod` | `/structure/board-of-directors/` | Legacy shortlink alias (updated v4.0.0 — see `board-of-directors` in the SET_REDIRECTS table below for the live-URL rename itself) |
| `/sab` | `/structure/scientific-advisory-board/` | Legacy shortlink alias (updated v4.0.0) |
| `/structure` | `/structure/` | Structure direct (no-op, kept for completeness) |
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

### Structural Renames (`PREFIX_REDIRECTS` in assets/js/redirects.js)

Unlike `MAP`, these rules are locale-aware — one rule redirects the same rename
across every locale subtree.

| Rule (`from` → `to`) | Shipped | Locales covered | Domains affected |
|---|---|---|---|
| `active-inference-and-` → `active-inference/` | v3.0.0 (2026-07-01) | All 12 (`en` + 11 non-default) | All 16 "Active Inference and X" domain pages |

**Concretely**, every one of these old URLs 404s and redirects to its new nested
location (shown here for the default locale; the same rename applies verbatim
under every `/<code>/` prefix, e.g. `/es/active-inference-and-medicine/` →
`/es/active-inference/medicine/`):

| Old URL | New URL |
|---|---|
| `/active-inference-and-economics/` | `/active-inference/economics/` |
| `/active-inference-and-climate/` | `/active-inference/climate/` |
| `/active-inference-and-education/` | `/active-inference/education/` |
| `/active-inference-and-law/` | `/active-inference/law/` |
| `/active-inference-and-neuroscience/` | `/active-inference/neuroscience/` |
| `/active-inference-and-linguistics/` | `/active-inference/linguistics/` |
| `/active-inference-and-urban-planning/` | `/active-inference/urban-planning/` |
| `/active-inference-and-music/` | `/active-inference/music/` |
| `/active-inference-and-agriculture/` | `/active-inference/agriculture/` |
| `/active-inference-and-cybersecurity/` | `/active-inference/cybersecurity/` |
| `/active-inference-and-healthcare/` | `/active-inference/healthcare/` |
| `/active-inference-and-robotics/` | `/active-inference/robotics/` |
| `/active-inference-and-ecology/` | `/active-inference/ecology/` |
| `/active-inference-and-medicine/` | `/active-inference/medicine/` |
| `/active-inference-and-psychology/` | `/active-inference/psychology/` |
| `/active-inference-and-entomology/` | `/active-inference/entomology/` |

**Why nested under `/active-inference/` and not `/domains/`:** the ecosystem
family (`src/pages/ecosystem.mjs`) already uses several of the same topic
names as bare slugs — `economics`, `education`, `neuroscience`, `robotics` all
already exist at `/ecosystem/<name>/`. A `/domains/<name>/` scheme would have
put two differently-authored pages about "robotics" at confusingly similar
paths. Nesting under the existing `/active-inference/` hub page instead avoids
any collision and reads correctly: these pages *are* "Active Inference and X."
See [SLUG_AND_URL_TAXONOMY.md § Two independent axes](SLUG_AND_URL_TAXONOMY.md#two-independent-axes-source-organization-vs-output-url).

**Follow-up (manual, outside this repo):** submit a Search Console
change-of-address / re-submit the sitemap so search engines re-crawl the new
paths promptly, since the old URLs had been live and indexed.

### Structural Renames (`SET_REDIRECTS` in assets/js/redirects.js)

Same idea as `PREFIX_REDIRECTS` above, but for `"set"`-routed families whose
slugs share no common string prefix — the whole slug is matched exactly, not
stripped. Shipped in v4.0.0, for the same reason as v3.0.0's domain-page move:
both are families that add roughly one new page per year and would otherwise
keep cluttering the repository root indefinitely.

| Rule (`from` → `to`) | Shipped | Locales covered |
|---|---|---|
| `board-of-directors` → `structure/board-of-directors/` | v4.0.0 (2026-07-01) | All 12 |
| `officers` → `structure/officers/` | v4.0.0 (2026-07-01) | All 12 |
| `scientific-advisory-board` → `structure/scientific-advisory-board/` | v4.0.0 (2026-07-01) | All 12 |
| `2025` → `years/2025/` | v4.0.0 (2026-07-01) | All 12 |
| `2026` → `years/2026/` | v4.0.0 (2026-07-01) | All 12 |

Concretely, shown for the default locale (the same rename applies verbatim
under every `/<code>/` prefix):

| Old URL | New URL |
|---|---|
| `/board-of-directors/` | `/structure/board-of-directors/` |
| `/officers/` | `/structure/officers/` |
| `/scientific-advisory-board/` | `/structure/scientific-advisory-board/` |
| `/2025/` | `/years/2025/` |
| `/2026/` | `/years/2026/` |

**Why nest under the existing `/structure/` and a new `/years/`:** `/structure/`
was already the Institute's governance hub page, so reusing it (rather than
inventing a fourth top-level governance concept, e.g. `/organization/`) keeps
one clear taxonomy. `/years/` had no existing hub page, so
[`src/content/pages/institute/years.json`](../src/content/pages/institute/years.json)
was added as a real "Annual Reports" index — this also fixes the auto-generated
breadcrumb, which otherwise linked to a `/years/` directory with no page
(unlike `/structure/` and `/active-inference/`, which already existed as real
pages before their nested families did).

**Maintenance note:** `yearPageSlugs` in `src/url-taxonomy.json` needs a new
entry every year a new annual-report page ships (e.g. `"2027"`) — this is the
one recurring manual step in an otherwise fully data-driven routing table.

**Follow-up (manual, outside this repo) — DONE, verified 2026-07-27:** the
`2025`/`2026`/`sab`/`bod` subdomain shortlinks have been repointed to the new
clean URLs. Each now resolves `200` at its `/years/…` or `/structure/…`
destination (checked with a Googlebot user-agent).

### Subdomain Shortlinks (Squarespace Domain Forwards, NOT in this repo)

These are forwarding rules administered in the **Squarespace** domain panel for
`activeinference.institute` (confirmed by the `server: Squarespace` response
header on every `*.activeinference.institute` shortlink). They are independent
of the static-site hosting on GitHub Pages, and no file in this repository can
change them. They remain unchanged through the cutover.

Squarespace forwarding emits only a bare `301`/`302` — it cannot set an
`X-Robots-Tag` header, and it cannot serve a per-subdomain `robots.txt`
(a request to `<sub>.activeinference.institute/robots.txt` is itself
forwarded). This matters: see
[Externally-blocked forwards](#externally-blocked-forwards-seo-trap) below.

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
| `2025` | `/years/2025/` | On-site (gap page) | Annual overview — repointed, verified `200` 2026-07-27 |
| `2026` | `/years/2026/` | On-site (gap page) | Annual overview — repointed, verified `200` 2026-07-27 |
| `aicacp` | `/projects/aicacp/` | On-site | Ready |
| `ontology` | `/projects/active-inference-ontology/` | On-site | Ready |
| `sab` | `/structure/scientific-advisory-board/` | On-site | Repointed, verified `200` 2026-07-27 |
| `bod` | `/structure/board-of-directors/` | On-site | Repointed, verified `200` 2026-07-27 |
| `newsletter` | `https://activeinferenceinstitute.substack.com/` | External | Permanent — destination crawlable |
| `chat` | `https://www.perplexity.ai/search/…` | External | Permanent — ⚠️ **destination robots-blocked** (see below) |
| `obsidian` | Obsidian knowledge base (surfaced on `/active-inference/`) | External | Permanent — destination crawlable |
| `resnei` | `https://zenodo.org/records/15389683` | External | Permanent — destination crawlable |
| `zoom` | Zoom meeting room (`us06web.zoom.us/j/…`) | External | Temporary (302) — ⚠️ **destination robots-blocked** (see below) |
| `start` | `https://github.com/ActiveInferenceInstitute/Start/` | External | Permanent — destination crawlable |
| `donate`, `paypal`, `support` | `https://www.paypal.com/donate/` | External | Permanent — destination crawlable |
| `discord` | `https://discord.com/invite/FSUvYD2p9S` | External | Permanent — destination crawlable |
| `bodform` | Coda/Superhuman form | External | Live — ⚠️ **destination robots-blocked** (see below) |
| `sabform` | Coda/Superhuman form | External | Live — ⚠️ **destination robots-blocked** (see below) |
| `internform` | Coda/Superhuman form | External | Live — ⚠️ **destination robots-blocked** (see below) |
| `prepareform` | Coda/Superhuman form | External | Live — ⚠️ **destination robots-blocked** (see below) |
| `measureform` | Coda/Superhuman form | External | Live — ⚠️ **destination robots-blocked** (see below) |

All five `*form` shortlinks are registered in
[`src/content/live-sources.json`](../src/content/live-sources.json) as
`bodform`, `sabform`, `internform`, `prepareform`, `measureform` and are
referenced from content pages by `sourceId`, per the external-link contract.

### Externally-blocked forwards (SEO trap)

**Symptom.** Google Search Console (property `sc-domain:activeinference.institute`,
Page indexing report) flags shortlink subdomains as
**"Indexed, though blocked by robots.txt"**. A validation attempt opened
2026-07-20 failed 2026-07-24.

**Verified chain** (2026-07-27, requests sent with a Googlebot user-agent):

```
https://bodform.activeinference.institute/
  → 302  (server: Squarespace — domain forwarding)
https://coda.io/form/Active-Inference-Institute-Board-of-Directors-application-form_dmZ3v7jK3mC
  → 307  (Coda is now rebranded as Superhuman Docs)
https://docs.superhuman.com/form/…
  → 200, and that host serves:
        User-agent: *
        Disallow: /
```

`sabform`, `internform`, `prepareform` and `measureform` follow the identical
chain to the same blocked host.

**Why Google reports it this way.** Googlebot cannot fetch the final
destination — `docs.superhuman.com/robots.txt` disallows everything — so it
never retrieves any content for the shortlink. It still knows the URL exists
(it is linked from `/structure/board-of-directors/`, `/programs/internship/`,
`/prepare/`, and their 12 locale variants), so it indexes the shortlink URL
**title-only, with no description**. That is exactly the state GSC labels
"Indexed, though blocked by robots.txt".

**Two things that look like fixes but are not:**

1. *"Remove the `Disallow` rule."* The rule is not ours. It lives on
   `docs.superhuman.com`, a third-party SaaS host. Nothing in this repository,
   in the apex `robots.txt`, or in the Squarespace panel can change it.
2. *"Keep it crawlable but add a `noindex` tag."* The destination form page
   **already** carries `<meta name="robots" content="noindex"/>`. Googlebot can
   never see it, because the robots.txt block prevents the fetch that would
   reveal it. This is the classic *noindex-behind-a-robots-block* trap: a
   `noindex` is only honoured on a page the crawler is allowed to read.
   Squarespace domain forwarding cannot substitute for it either — a forwarding
   rule emits a bare `301`/`302` and cannot set an `X-Robots-Tag` header, and
   the subdomain has no `robots.txt` of its own (that path is forwarded too).

**What actually resolves it.** The shortlink must resolve to a URL Googlebot is
permitted to crawl, on a host we control. The fix is a change in the
**Squarespace domain panel** and cannot be made from this repository.

**Repoint each `*form` forward from the Coda URL to its existing on-site page:**

| Shortlink | Current (broken) target | Repoint to |
|---|---|---|
| `bodform` | `coda.io/form/…Board-of-Directors…` | `https://activeinference.institute/structure/board-of-directors/` |
| `sabform` | `coda.io/form/…Scientific-Advisory-Board…` | `https://activeinference.institute/structure/scientific-advisory-board/` |
| `internform` | `coda.io/form/…Internship…` | `https://activeinference.institute/programs/internship/` |
| `prepareform` | `coda.io/form/…Project-Preparation…` | `https://activeinference.institute/prepare/` |
| `measureform` | `coda.io/form/…Short-Measurement…` | `https://activeinference.institute/measure/` |

Googlebot then follows the `301` to an indexable page and consolidates the
shortlink into it, so the GSC issue clears *and* the shortlink gains a real
search appearance instead of a title-only entry. Use a **301** (permanent), not
a 302, so the signal consolidates rather than leaving the shortlink as the
canonical.

The user cost is one click, and it is a cheap one: on all five destination pages
the form is already the **first `primaryAction`** — a prominent CTA button
rendered at the top of the page, backed by the registered `sourceId`
(`"Apply to the Board"` → `bodform`, `"Apply for the internship"` → `internform`,
and so on). Nothing in this repository needs to change for the repoint to work.

**Rejected alternative — a `noindex` interstitial.** Adding thin on-site pages
(e.g. `/forms/board-of-directors/`) that carry
`<meta name="robots" content="noindex">` and bounce straight to the form would
preserve one-click access, and `layout()` already supports a `robots` argument.
It is nonetheless **not viable in this repository**, because such a page has no
legal link target:

- Linking to the Coda URL directly is blocked by `check:security` —
  `check_static_security.py` raises *"direct Coda anchor is not allowed"* on any
  rendered `coda.io` anchor, and `check_live_sources.py` strips committed
  `finalUrl` values precisely because they "historically leaked resolved coda.io
  destinations into source". Resolved Coda destinations are deliberately kept
  out of source; see [GATING.md](../GATING.md).
- Linking to the `*form` shortlink instead would create a redirect loop
  (shortlink → interstitial → shortlink).

Weakening either gate to allow the interstitial would trade a cosmetic search
issue for a hole in the public-safety boundary. Not worth it.

After repointing, re-run **Validate Fix** in GSC. The GSC *Removals* tool only
suppresses a URL for ~6 months and does not address the cause.

**Same trap, not yet reported by GSC.** Two further shortlinks forward to
robots-blocked destinations and will surface the identical issue once Google
crawls them:

- `chat` → `www.perplexity.ai/search/…` — Perplexity's `robots.txt` has a
  Googlebot-specific `Disallow: /search*` (the URL also returned `403` to a
  Googlebot user-agent on 2026-07-27).
- `zoom` → `us06web.zoom.us/j/…` — Zoom's `robots.txt` has `Disallow: /j/*`.

These are lower priority than the `*form` set — they are utility shortlinks
rather than application entry points, and neither is yet reported by GSC. **The
two need opposite treatment, and the difference matters:**

**`chat` — safe to repoint.** No page in this repository links to
`chat.activeinference.institute`; it is a bare DNS shortlink with no on-site
referrer, so there is no loop risk and nothing to update in source. Repoint it
at `https://activeinference.institute/active-inference/`, which is crawlable and
preserves the original intent (the Perplexity query it currently targets is an
Active Inference research prompt). `/search/` also works but is a weaker match.

**`zoom` — do NOT repoint. It would break every meeting join link.**
`/calendar/` links to `https://zoom.activeinference.institute/` as the join URL
for its events — sourced from `src/content/instituteos/calendar.json`, rendered
across all 12 locales. Repointing `zoom` at `/calendar/` would make the join
button forward straight back to the calendar it was clicked from: an infinite
loop, and a live outage for the Textbook Group sessions. The shortlink must keep
forwarding to the real Zoom room.

The residual cost of leaving `zoom` alone is a title-only index entry for a
meeting-room shortlink. That is cosmetic, and every available "fix" is worse
than the symptom — the same shape as the rejected interstitial above. Leave it.

The general rule both cases illustrate: **before repointing a shortlink, check
whether the site links to it.** A shortlink that appears in rendered output
cannot be forwarded to the page that contains that link.

The remaining external forwards were checked on the same date and their
destinations are crawlable: `newsletter` (Substack), `obsidian`
(`publish.obsidian.md`, `Allow: /`), `resnei` (Zenodo `/records/` is not
disallowed), `start` (GitHub repo roots are not disallowed), `donate`/`paypal`/
`support` (PayPal has no rule matching `/donate/`), and `discord`
(`Allow: /invite`).

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
   - **monthly** for deeper routes
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
