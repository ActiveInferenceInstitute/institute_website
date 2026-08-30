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
   private registries (tech trees, entities, processes, policies, calendar,
   assets), runs per-field **whitelist** sanitizers plus per-record dropping
   (`record_is_public_safe`), and validates every payload with
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
| `check:security` | `npm run check` → `check_static_security.py` | Rendered HTML: CSP policy, blocks direct `coda.io` anchors, forces external links through the `live-sources.json` allowlist, disallows `form`/`iframe`/`object`/`embed`, and (2026-07-05) scans rendered visible text and `mailto:` targets for unvetted emails/phone numbers |
| `check:site` | `npm run check` → `check_site_contract.py` | Site contract incl. `version.json` == `package.json`, plus (2026-07-05) a dynamic scan of **every** committed `src/content/instituteos/*.json` file (previously a hardcoded 5-of-17 subset) for coda.io references and internal-governance-surface terms |

The HTML gate (`check:security`) and the data gate (`check:instituteos`) are
**independent**, so a clean rendered site does not by itself prove the source
JSON is clean — and vice versa.

## Known coverage gaps (see TODO.md / open items)

The defense is strong on the sync path. Two seams were closed this review, one
new content-level finding is open, and known residual gaps remain:

1. **Producer 2 slices — re-validated in-repo, unconditionally (closed
   2026-07-05).** The committed graph/narrative files from the private export
   (`*_graph.json`, `narratives_public.json`, `domain_projects.json`,
   `communications_public.json`, plus `newsletter.json` and the four
   build-consumed slices `programs.json`, `citations.json`, `calendar.json`,
   `videos.json`) are run through an
   in-repo gate, `validate_public_prose_payload` (via the new
   `check_producer2_payloads`, `scripts/sync_instituteos_public_data.py`,
   executed by `npm run check:instituteos`). This previously only ran when the
   private `instituteos` checkout could **not** be resolved — i.e. it was dead
   code in the normal local monorepo layout — and now runs unconditionally in
   `--check` mode regardless of layout. It is a **prose-tuned** variant of
   `validate_public_payload` — it blocks real emails, `coda.io`, `/users/`,
   phone numbers, and the unambiguous private keys, while tolerating
   structured-registry tokens (e.g. `slack`/`discord`/`linkedin` node labels,
   the word `workspace`) that legitimately appear in public prose and graph
   node labels, per a documented exception allowlist enforced by a drift-guard
   test in the private repo (`tests/orchestrator/website_export/test_gate_sync.py`).
   The upstream private exporter remains the first line of defense; this is
   defense-in-depth.
2. **Content-safety scan widened to every committed slice (closed 2026-07-05).**
   `check:site`'s `instituteos_data()` previously scanned a hardcoded 5-file
   subset (`people`, `projects`, `ideas`, `ontology`, `assets`); it now
   dynamically globs every `*.json` under `src/content/instituteos/` (19 files
   at the time of writing), so the scan cannot fall behind the file set.
3. **RESOLVED — governance-surface content found by the widened scan (2026-07-05).**
   Once every file was actually scanned, `check:site` started reporting real,
   pre-existing internal-governance-surface language across `entities.json`,
   `governance_graph.json`, `narratives_public.json`, `policies.json`, and
   `processes.json`. Confirmed with the Institute: **entity/role NAMES are
   public** ("Board of Directors", "Officers", "Scientific Advisory Board" —
   the Institute names its governance bodies publicly, so these are no longer
   blocked anywhere) — but **process/workflow mechanics are not** (the
   step-by-step descriptions in `processes.json`, e.g. specific approval/
   sign-off/review sequences, are backend governance detail). `processes.json`
   and its generator (`sanitize_processes`) were removed entirely — not
   filtered — along with every render-side consumer (the Open Source Map
   "Processes" table/section, its search-index entries, and its summary counts
   in `src/render/knowledge.mjs`, `src/lib/instituteos.mjs`,
   `src/render/tables.mjs`, `src/render/search.mjs`). "workspace" was
   confirmed a legitimate common-word false-positive and is no longer blocked.
   `npm run check:site` passes.
4. **Resolved Coda destinations in source (closed 2026-07-20).**
   `src/content/live-sources.json` no longer commits resolved `finalUrl`
   values; redirect targets are resolved live by `check:sources`
   (`scripts/check_live_sources.py`, the deliberately networked gate outside
   the offline `npm run check` chain) on every run, and a committed
   `finalUrl` field in the manifest is now a hard error in that gate — so
   resolved Coda destinations can no longer recur in source.
5. **Denylist blind spots.** `validate_public_payload` matches `PRIVATE_KEYS`
   only as exactly-quoted JSON keys and `FORBIDDEN_SUBSTRINGS` as substrings, so
   the per-field whitelist sanitizers — not the denylist — are the primary
   control. The denylist is defense-in-depth.
6. **Governance glossary intentionally not exported (open, 2026-07-14).**
   `library/resources/definitions/glossary.json` (79 terms, private repo) is
   never projected onto this site. Only 7 of 79 terms are `core_concept`
   (Active Inference, Bayesian Inference, Free Energy Principle, Generative
   Model, Markov Blanket, Variational Free Energy, ReInference); the remaining
   72 are `governance`/`legal_compliance`/`it_security`/`organisation`/
   `policy_framework`/`financial`/`values` — the exact content class removed
   from this site on 2026-07-05 (see item 3 above). A comprehensive audit
   flagged this as a finding and deliberately did **not** build an export for
   it, since doing so risks silently reversing that removal. **Unblocking
   requires a human editorial call** on whether any subset (most plausibly
   just the 7 `core_concept` terms) is public-appropriate, before any exporter
   or page work is done. Until that decision is made, do not add a glossary
   export.

7. **Dead producer-1 `communications.json` output (closed 2026-07-14).**
   `sanitize_communications()` read `library/registries/communications.json`
   and wrote `src/content/instituteos/communications.json`, but `src/data.mjs`
   only ever loads the **producer-2** `communications_public.json` for the
   communications page render — the producer-1 file had zero consumers. The
   two files' record sets were kept byte-identical by convention with no gate
   enforcing that, so the producer-1 sanitizer/validation work was pure
   overhead with no effect on the rendered site. `sanitize_communications()`
   was removed, `communications.json` was dropped from
   `REQUIRED_PUBLIC_JSON_FILES`, and the stale committed
   `src/content/instituteos/communications.json` was deleted.
   `communications_public.json` (producer-2) remains the sole, authoritative
   source for this domain.
8. **Program and bibliography projections (closed 2026-07-17).** The private
   InstituteOS exporter now emits explicit public-safe `programs.json` and
   `citations.json` slices. Programs retain visitor-facing descriptions,
   categories, topics, and page slugs while dropping staffing, operational
   process/policy links, entity links, and raw source URLs. Citations retain
   bibliographic fields and verified `sourceIds`. Both slices are rendered in
   the Open Source Map and covered by the static-site contract.
## The rule for contributors

Public structured content must be injected only through the sanitizing pipelines
above — never hand-add private rows to `src/content/instituteos/*.json`. Edits
under any committed file are **public commits**; never include private paths,
internal tool names, or local context in any file that ships.
