# instituteos/ — Public Data Contract

This directory holds public-safe JSON files. All files are **build-time inputs**
— consumed by `src/build.mjs` (and `src/feeds.mjs`) to generate static HTML. No
file in this directory is served directly.

**Two producers feed this directory** (see [`../../../GATING.md`](../../../GATING.md)):

1. The registry slices (`people`, `projects`, `ideas`, `ontology`, `assets`,
   `entities`, `policies`, `programs`, `citations`, `calendar`) are produced by
   `scripts/sync_instituteos_public_data.py` and validated by
   `npm run check:instituteos`. (`processes.json` was removed 2026-07-05 —
   process/workflow mechanics are backend governance detail, confirmed not
   for public release; entity/role *names* remain public via `entities.json`.
   `communications.json` was removed 2026-07-14 — it was a byte-identical
   duplicate of the producer-2 `communications_public.json` below with zero
   consumers; `src/data.mjs` only ever loaded the producer-2 file for the
   communications page render, so the producer-1 slice did real sanitization
   work with no effect on the rendered site.)
2. The graph/narrative slices (`governance_graph`, `ontology_graph`,
   `tech_tree_graph`, `domain_projects`, `narratives_public`,
   `communications_public`, `strategies_public`, `newsletter`) arrive **pre-sanitized from a
   separate private InstituteOS export**, and are **also re-validated in-repo** by
   `validate_public_prose_payload` (a prose-tuned gate in
   `check_committed_public_payloads`, run by `npm run check:instituteos`) — see
   GATING.md.

Run `npm run sync:instituteos` to regenerate the producer-1 slices. Run
`npm run build` to rebuild the HTML.

---

## File schemas


### `projects.json`
Public repository rows.

```
{
  description: string,
  source: string,
  records: [{
    id: string, title: string, fullName: string, sourceId: string,
    url: string, category: string, audience: string,
    projectFamily: string, repoType: string, language: string,
    stars: number, updatedAt: string, docsUrl: string, docsSourceId: string,
    summary: string, tags: string[], relatedSlugs: string[]
  }]
}
```

### `ideas.json`
Deduplicated concept/method/tool/value/publication nodes from the tech-tree registry.

```
{
  description: string, source: string,
  records: [{
    id: string, label: string, nodeType: string, maturity: string,
    summary: string, tags: string[], trees: string[], relatedSlugs: string[]
  }]
}
```

### `ontology.json`
Directed relationships from the tech-tree registry.

```
{
  description: string, source: string,
  trees: [{id, title, domain, status, summary, nodeCount, edgeCount, linkedProjectCount}],
  edges: [{
    id: string, treeId: string, treeTitle: string,
    sourceId: string, sourceLabel: string, sourceMaturity: string,
    relationship: string, edgeType: string,
    targetId: string, targetLabel: string, targetMaturity: string
  }]
}
```

### `assets.json`
Brand asset records copied from the registry.

```
{
  description: string, source: string,
  records: [{id, filename, path, alt, theme, source}]
}
```

### `entities.json`
Public governance members and organizations.

```
{
  description: string, source: string,
  people: [{
    id: string, name: string, title: string,
    roles: string[], orgId: string, active: boolean,
    tags: string[],
    policyRoles: [{policyId: string, role: string}]
  }],
  organizations: [{
    id: string, name: string, type: string,
    description: string, url: string,
    tags: string[], memberIds: string[], parentId: string|null
  }]
}
```

### `sab_cohorts.json`
Past Scientific Advisory Board cohort rosters, newest year first, transcribed from
the Institute's public SAB roster. Past cohorts only: who serves on the CURRENT
board is derived from the `Scientific Advisory Board` institute role on person
records in `entities.json`, which stays the single source of truth for the live
roster — listing it in both places would create two records of one fact that can
disagree. `url` is the member's own public page and is always an absolute
`http(s)` URL; a contact address is never published as a link. `entityId` is set
when the member is on record in `entities.json`, so the rendered roster can link
to their directory entry.

```
{
  description: string, source: string,
  cohorts: [{
    year: number,
    members: [{ name: string, url: string, entityId: string }]
  }]
}
```

### `fellows.json`
Public Research Fellows roster. Derived from the `fellowship` block on person
entities, and deliberately separate from `entities.json`: a published fellowship
is a program roster entry, not a governance role, so it crosses the boundary
without relaxing the `roster-import` CRM gate that withholds directory contacts
from the governance tables. Sorted newest appointment first, then by name.

```
{
  description: string, source: string,
  fellows: [{
    id: string, name: string, position: string,
    start: string,            // "M/YYYY" as published
    status: "current"|"past", // only "current" renders on /programs/fellowship/
    orcid: string,            // bare ORCID iD, or "" when unpublished
    focus: string, overview: string
  }]
}
```

### `policies.json`
Public governance policy registry overview.

```
{
  description: string, source: string,
  records: [{
    id: string, title: string, category: string,
    description: string, status: string,
    currentVersion: string, tags: string[]
  }]
}
```

### `programs.json`
Public visitor-facing participation and support pathways. Staffing, entity
links, process ids, policy ids, source workspace links, emails, and notes are
deliberately omitted; public destinations remain authored through the site's
verified `live-sources.json` registry.

```
{
  description: string, source: string,
  records: [{
    id: string, name: string, description: string, version: string,
    status: string, category: string, summary: string,
    websiteSlug: string, topics: string[]
  }]
}
```

### `citations.json`
Public bibliographic records used by research-domain pages and the Literature
table in the Open Source Map. `sourceIds` resolve through the website's live
source registry; no internal provenance or private annotations are included.

```
{
  description: string, source: string,
  records: [{
    id: string, citationKey: string, authors: string[], year: number|null,
    title: string, venue: string, doi: string,
    sourceIds: string[], tags: string[]
  }]
}
```

---

## Producer-2 slices (private InstituteOS export)

### `calendar.json`
Public iCalendar snapshot for the calendar page.

```
{
  calendarName: string, description: string,
  embedUrl: string, icsUrl: string, source: string,
  records: [{ id, title, start, end, allDay, status, timeZone, url }]
}
```

### `communications_public.json`
Public communications feed (also read by `src/feeds.mjs` for RSS).

```
{ description: string, records: [{ id, type, title, author, date, referenceNumber, language }] }
```

### `domain_projects.json`
Projects grouped by "Active Inference and X" domain.

```
{ domains: [{ domain: string, slug: string, projects: [...] }] }
```

### `narratives_public.json`
Public Institute prose transposed from the public Coda workspace, keyed to a target page.

```
{ narratives: [{ section: string, title: string, body: string, target_page: string }] }
```

### `governance_graph.json` · `ontology_graph.json` · `tech_tree_graph.json`
Node-link graphs rendered by `assets/js/graphs.js`. Same shape:

```
{
  nodes: [{ id: string, label: string, type: string, meta: object, href?: string }],
  edges: [{ source: string, target: string, relation: string }]
}
```

### `strategies_public.json`
Strategic revenue-stream / department map.

```
{
  description: string,
  departments: [{ id, label, nodeCount }],
  revenueStreams: [{ id, label, from }]
}
```

> **Render status (2026-08-28): not rendered.** The departments-and-revenue-streams
> section (`strategyMapSection()`, `#strategy-map`) was removed from
> [`src/render/feature-sections.mjs`](../../render/feature-sections.mjs) in commit
> `e53b9c97f1` (strategy sections moved to structured narrative formatting). The
> slice is still exported by InstituteOS and still claimed by producer-2 in
> [`scripts/sync_instituteos_public_data.py`](../../scripts/sync_instituteos_public_data.py),
> but `src/data.mjs` still loads it with no renderer reading
> `siteData.instituteos.strategies`. Either retire the export (data.mjs loader,
> producer-2 claim, backend `StrategiesExporter`) or restore a renderer; until
> then this file ships but nothing on the site displays it.

### `newsletter.json`

The public-safe full-content projection of the idempotent Substack archive. It
contains stable internal routes for monthly newsletters and other public
announcements, the original public post URL, complete rendered Markdown bodies,
and relative media paths. Auth-gated workspace links and non-public email
addresses are removed at the InstituteOS export boundary; ordinary public links
and images remain intact.

```
{
  schema_version: string,
  publication: string,
  publication_url: string,
  snapshot_date: string,
  counts: { newsletter: number, announcement: number },
  records: [{ id, type, title, author, date, url, route, tags?,
              body_markdown, media?: string[] }]
}
```

---

## Invariants

- All string values are run through public text normalization (whitespace collapsed, certain internal terms substituted).
- Private fields (contacts, email, phone, interactions, etc.) must never be present in any file. **Enforcement status:** producer-1 slices are gated by `validate_public_payload` (denylist + email regex) and producer-2 slices by `validate_public_prose_payload` (prose-tuned denylist + email/phone regex), both via `check:instituteos`. The rendered HTML is independently gated by `check:security` (no `coda.io`, no PII, external links forced through the `live-sources.json` allowlist).
- `entities.json` uses `people`/`organizations` keys (not `records`) — handle both patterns in consuming code.
- `ontology.json` uses `trees`/`edges` keys (not `records`).
- `fellows.json` uses a `fellows` key (not `records`).
- `sab_cohorts.json` uses a `cohorts` key (not `records`).
- Every `*.json` here must be claimed by exactly ONE producer: this sync, or the
  InstituteOS-side website export (recorded in `data/export-manifest.json`). `--check`
  names any orphan. Two producers writing the same file is a bug, not redundancy —
  `calendar.json` was written by both from the same registry, so its bytes depended on
  which ran last; the InstituteOS exporter owns it.
- This sync produces: `projects.json`, `ideas.json`, `ontology.json`, `entities.json`,
  `fellows.json`, `sab_cohorts.json`, `policies.json`, `assets.json` (plus brand images). Everything else in
  this directory comes from the InstituteOS exporter.
- All other files use a top-level `records` array.
- Run `python3 scripts/sync_instituteos_public_data.py --check` to verify files are current.
