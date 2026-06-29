# instituteos/ — Public Data Contract

This directory holds public-safe JSON files. All files are **build-time inputs**
— consumed by `src/build.mjs` (and `src/feeds.mjs`) to generate static HTML. No
file in this directory is served directly.

**Two producers feed this directory** (see [`../../../GATING.md`](../../../GATING.md)):

1. The registry slices (`people`, `projects`, `ideas`, `ontology`, `assets`,
   `entities`, `processes`, `communications`, `policies`, `calendar`) are
   produced by `scripts/sync_instituteos_public_data.py` and validated by
   `npm run check:instituteos`.
2. The graph/narrative slices (`governance_graph`, `ontology_graph`,
   `tech_tree_graph`, `domain_projects`, `narratives_public`,
   `communications_public`, `strategies_public`) arrive **pre-sanitized from a
   separate private InstituteOS export**, and are **also re-validated in-repo** by
   `validate_public_prose_payload` (a prose-tuned gate in
   `check_committed_public_payloads`, run by `npm run check:instituteos`) — see
   GATING.md.

Run `npm run sync:instituteos` to regenerate the producer-1 slices. Run
`npm run build` to rebuild the HTML.

---

## File schemas

### `people.json`
Public GitHub contributor rows derived from repository metadata.

```
{
  description: string,
  source: string,
  records: [{
    id: string,
    name: string,
    login: string,
    sourceId: string,
    publicRole: string,
    repositories: string[],
    contributionSummary: string,
    relatedSlugs: string[]
  }]
}
```

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

### `processes.json`
Public governance process descriptions.

```
{
  description: string, source: string,
  records: [{
    id: string, title: string, description: string,
    category: string, version: string, status: string,
    triggers: string[], slaDays: number|null,
    linkedPolicies: string[], stepCount: number,
    steps: [{order: number, name: string, description: string}]
  }]
}
```

### `communications.json`
Approved public communications (reports, announcements, newsletters).

```
{
  description: string, source: string,
  records: [{
    id: string, type: string, title: string,
    author: string, date: string,
    referenceNumber: string, language: string
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

> **Note:** `strategies_public.json` currently has **no consumer** in the repo —
> it ships but is not loaded by any renderer or feed. Either wire it into a page
> or remove it (tracked in [`../../../TODO.md`](../../../TODO.md)).

---

## Invariants

- All string values are run through public text normalization (whitespace collapsed, certain internal terms substituted).
- Private fields (contacts, email, phone, interactions, etc.) must never be present in any file. **Enforcement status:** producer-1 slices are gated by `validate_public_payload` (denylist + email regex) and producer-2 slices by `validate_public_prose_payload` (prose-tuned denylist + email/phone regex), both via `check:instituteos`. The rendered HTML is independently gated by `check:security` (no `coda.io`, no PII, external links forced through the `live-sources.json` allowlist).
- `entities.json` uses `people`/`organizations` keys (not `records`) — handle both patterns in consuming code.
- `ontology.json` uses `trees`/`edges` keys (not `records`).
- All other files use a top-level `records` array.
- Run `python3 scripts/sync_instituteos_public_data.py --check` to verify files are current.
