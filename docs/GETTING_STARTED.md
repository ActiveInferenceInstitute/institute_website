> Part of the `institute_website` documentation set — see [README.md](README.md).

# Getting Started

A quickstart for contributors. For the conceptual model read
[ARCHITECTURE.md](ARCHITECTURE.md); for the editing rules read
[CONTENT_AUTHORING.md](CONTENT_AUTHORING.md).

## Prerequisites

- **Node.js** (a recent LTS). The build is plain Node with **no runtime dependencies**
  and no framework — `node src/build.mjs` runs the whole site.
- **Python 3** — used only by the check gates (`scripts/check_*.py`), no third-party
  packages required.

## Build the site

```bash
cd repos/institute_website
npm run build
```

This reads JSON under `src/content/` and writes HTML into the **repo root**
(`about/index.html`, `active-inference/robotics/index.html`, per-locale subtrees
like `de/…`, plus `index.html`, `404.html`, `sitemap.xml`, `feed.xml`, …). GitHub Pages
serves that committed output directly, so **built output is committed** — but you never
hand-edit it (see below).

## Preview locally

Serve the repo root with any static server, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## The golden rules (these are what `npm run check` enforces)

1. **Edit source, never built output.** Change `src/content/*.json`, `src/render/*.mjs`,
   `assets/`, then rebuild. Never hand-edit `*/index.html`.
2. **External links must be registered** in `src/content/live-sources.json` and
   referenced by `sourceId` — never a raw `href` on a content page. See
   [STATIC security & link contract in GATES_AND_VALIDATION.md](GATES_AND_VALIDATION.md).
3. **Each content page needs** `primaryActions` (non-empty), `externalSourceIds`, and at
   least one primaryAction backed by a registered `sourceId`.
4. **Strict CSP:** no inline `<script>`/`<style>`, no `iframe`/`object`/`embed`/`form`,
   no client-side `fetch`.
5. **Public-safety:** no private emails, rosters, or `coda.io` data payloads. Structured
   InstituteOS data enters only via `scripts/sync_instituteos_public_data.py`.

## First-PR workflow

```bash
# 1. make a source change (e.g. add a page JSON under src/content/pages/)
# 2. rebuild and run the gates
npm run build && npm run check
# 3. commit BOTH the source change and the regenerated built output
git add -A && git commit -m "feat: <describe change>"
```

If `npm run check` fails, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md). For task-specific
runbooks (add a page, add a project, register a link, add a locale, edit redirects), use
the `.claude/skills/institute-website/Workflows/` guides.
