# Gating — Public Projection Contract

This repository is a **gated, sanitized public projection** of private Institute
sources (the private InstituteOS docs and content library). This document
describes the end-to-end relationship: which private sources feed the public
site, how content is sanitized, where each gate sits, and what is excluded. It is
the single source of truth for the projection contract; the per-folder
`AGENTS.md` files hold the enforced specifics.

## What must never reach the public site

The published site is a visitor-facing resource hub, **not** a working-material
archive. It must exclude:

- Nonpublic rosters, stewardship records, and private operational fields.
- Raw task detail, working documents, drafts, demos, recordings, and internal UI
  captures.
- Input artifacts, generated trace views, and page-by-page extraction surfaces.
- **Resolved Coda destinations.** Visitor-facing links must render the official
  `*.activeinference.institute` shortlink, never the resolved Coda page it
  redirects to.

Internal materials may *inform* authored public copy, but the published surface
must remain clean.

## The two producers

Structured public data lands in `src/content/instituteos/*.json` from **two
distinct pipelines** — this split matters for where the gate applies:

1. **Website-side sync** — `scripts/sync_instituteos_public_data.py` reads
   private registries (tech trees, entities, processes, communications, policies,
   calendar, assets), runs per-field **whitelist** sanitizers plus per-record
   dropping (`record_is_public_safe`), and validates every payload with
   `validate_public_payload`. This is the primary, in-repo gate.
2. **Private InstituteOS export** — a separate pipeline (outside this repo) emits
   the graph/narrative slices: `*_graph.json`, `narratives_public.json`,
   `domain_projects.json`, `communications_public.json`. These arrive
   pre-sanitized from the private side.

## Where the gates sit

| Gate | Run by | What it enforces |
| --- | --- | --- |
| `validate_public_payload` | `sync_instituteos_public_data.py` (write time + `--check`) | `PRIVATE_KEYS` denylist, `FORBIDDEN_SUBSTRINGS` (incl. `coda.io`, `/users/`), email regex — on the sync-produced slices |
| `check:instituteos` | `npm run check` → `sync_instituteos_public_data.py --check` | Committed public-data parity/safety; validates committed files even when the private source is absent |
| `check:security` | `npm run check` → `check_static_security.py` | Rendered HTML: CSP policy, blocks direct `coda.io` anchors, forces external links through the `live-sources.json` allowlist, no PII in output |
| `check:site` | `npm run check` → `check_site_contract.py` | Site contract incl. `version.json` == `package.json` |

The HTML gate (`check:security`) and the data gate (`check:instituteos`) are
**independent**, so a clean rendered site does not by itself prove the source
JSON is clean — and vice versa.

## Known coverage gaps (see TODO.md / open items)

The defense is strong on the sync path. One seam was closed and others remain:

1. **Producer 2 slices — re-validated in-repo (closed).** The committed
   graph/narrative files from the private export (`*_graph.json`,
   `narratives_public.json`, `domain_projects.json`, `communications_public.json`,
   `strategies_public.json`) **are** now run through an in-repo gate:
   `validate_public_prose_payload` in `check_committed_public_payloads`
   (`scripts/sync_instituteos_public_data.py`, executed by `npm run check:instituteos`).
   It is a **prose-tuned** variant of `validate_public_payload` — it blocks real
   emails, `coda.io`, `/users/`, phone numbers, and the unambiguous private keys,
   while tolerating structured-registry tokens (e.g. `slack`/`discord`/`linkedin`
   node labels, the word `workspace`) that legitimately appear in public prose and
   graph node labels. The upstream private exporter remains the first line of
   defense; this is defense-in-depth.
2. **Resolved Coda destinations in source.** `src/content/live-sources.json`
   stores resolved `finalUrl` values for verification; these are not rendered
   into HTML but are committed in source. `check:sources` is not in the default
   `npm run check` chain.
3. **Denylist blind spots.** `validate_public_payload` matches `PRIVATE_KEYS`
   only as exactly-quoted JSON keys and `FORBIDDEN_SUBSTRINGS` as substrings, so
   the per-field whitelist sanitizers — not the denylist — are the primary
   control. The denylist is defense-in-depth.

## The rule for contributors

Public structured content must be injected only through the sanitizing pipelines
above — never hand-add private rows to `src/content/instituteos/*.json`. Edits
under any committed file are **public commits**; never include private paths,
internal tool names, or local context in any file that ships.
