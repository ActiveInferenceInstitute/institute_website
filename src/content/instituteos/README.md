# instituteos/ — Public Data Contract

This directory holds public-safe JSON files produced by `scripts/sync_instituteos_public_data.py`.
All files are **build-time inputs** — consumed by `src/build.mjs` to generate static HTML.
No file in this directory is served directly.

Run `npm run sync:instituteos` to regenerate. Run `npm run build` to rebuild the HTML.

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

## Invariants

- All string values are run through public text normalization (whitespace collapsed, certain internal terms substituted).
- Private fields (contacts, email, phone, interactions, etc.) are never present in any file.
- `entities.json` uses `people`/`organizations` keys (not `records`) — handle both patterns in consuming code.
- `ontology.json` uses `trees`/`edges` keys (not `records`).
- All other files use a top-level `records` array.
- Run `python3 scripts/sync_instituteos_public_data.py --check` to verify files are current.
