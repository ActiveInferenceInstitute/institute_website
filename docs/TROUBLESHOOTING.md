> Part of the `institute_website` documentation set — see [README.md](README.md).

# Troubleshooting

Symptom → cause → fix for the common build and gate failures. Full gate semantics are in
[GATES_AND_VALIDATION.md](GATES_AND_VALIDATION.md).

## `check:links` — "broken local reference"

- **Cause:** an internal link (nav entry, `relatedSlugs`, in-body link, or
  `primaryActions` `href`) points at a slug/path that no page emits.
- **Fix:** confirm the target page exists and its `slug` resolves to the path you linked.
  Remember URLs come from the slug, not the file location
  ([SLUG_AND_URL_TAXONOMY.md](SLUG_AND_URL_TAXONOMY.md)). Cross-link by the canonical
  clean URL the slug produces.

## `check:security` — "disallowed tag" / "unsafe external anchor"

- **Cause:** an `iframe`/`object`/`embed`/`form`/inline `<script>`/`<style>` slipped into
  output, or a content page used a raw external `<a href>` instead of a registered source.
- **Fix:** remove the disallowed tag (page-specific JS must be an external
  `assets/js/*.js` referenced from `layout.mjs`). For external links, register them in
  `src/content/live-sources.json` and reference by `sourceId` — see the
  RegisterLiveSource workflow. Even vetted hosts fail as raw content hrefs.

## `check:site` — "site contract" failure

- **Cause:** a required structural invariant is missing — e.g. a page lacks
  `primaryActions` / `externalSourceIds` / a verified external action, or a canonical
  URL / taxonomy expectation is violated.
- **Fix:** add the missing required fields to the page JSON. If you changed routing,
  ensure `scripts/check_site_contract.py` and `src/url-taxonomy.json` agree.

## `check:design-system` — "tokens do not match"

- **Cause:** `assets/css/instituteos-ds.css` (or the `styles.css` fallbacks) drifted from
  the canonical design tokens.
- **Fix:** re-sync the design-system export; do not hand-edit the generated token block.
  See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## `check:instituteos` — "public data sync check failed"

- **Cause:** the embedded InstituteOS public data under `src/content/instituteos/` is out
  of date with its source registries.
- **Fix:** re-run `scripts/sync_instituteos_public_data.py` (without `--check`) to
  regenerate, then rebuild. This data is produced by the InstituteOS export pipeline —
  do not hand-edit it.

## "I edited a page but the site didn't change"

- **Cause:** you edited built output (`*/index.html`) instead of source, or forgot to
  rebuild.
- **Fix:** edit `src/content/…`, then `npm run build`.

## Before deleting a live source

A `sourceId` may be referenced by many pages. Find all uses first:

```bash
grep -rn "your-source-id" src/content/
```

Remove the references (or repoint them) before removing the entry from
`live-sources.json`, or `check:site` / `check:security` will fail.

## Huge diff after a build

The build is **byte-deterministic**: `version.json`'s `built_at` mirrors the
export timestamp (`EXPORTED_AT` from `data/export-manifest.json`), and the
footer `build-stamp` carries the export's `source_fingerprint` — neither uses a
live clock, so rebuilding without touching source changes nothing
(CI asserts committed HTML == `build(source)`). A large diff therefore signals
**real drift**, not churn:

- A `package.json` version bump or a new `data/export-manifest.json` export
  changes the stamp on every page — expected, and the diff is one line per page.
- A content/source change touches only the pages that consume it.
- If a rebuild produces a large diff you did not intend, you likely edited a
  built `*/index.html` (see above) or the export manifest changed underneath you
  — check `git diff --stat` before committing.
