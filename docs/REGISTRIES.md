> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md` (see [`src/content/AGENTS.md`](../src/content/AGENTS.md)).
> The `docs/` folder is **not** built into the site.

# Top-Level Content Registries

Page JSON under `src/content/pages/` is per-page content (see
[CONTENT_AUTHORING.md](CONTENT_AUTHORING.md)). Everything else under
`src/content/*.json` is a **registry** — a single shared file loaded once at build
time and referenced from many pages and special surfaces (nav, footer, resources
directory, directory page, home page). This is the schema reference for those
registries.

## `site.json`
- **Purpose**: Site identity and metadata
- **Structure**: Single object with `name`, `shortName`, `tagline`, `description`, `email`, `baseUrl` (canonical URL), `repository`, `resourcePolicy`
- **Used by**: Page layout, meta tags, contact info

## `navigation.json`
- **Purpose**: Header navigation menus
- **Structure**: Array of menu groups `[{ label: string, items: [{label, slug, anchor?}] }]`
- **Size**: 5 menu groups (Institute, Learn, Participate, Projects, Resources)
- **Used by**: Header menu rendering; `slug` values resolve through `url-taxonomy.mjs`

## `live-sources.json`
- **Purpose**: **External link allowlist** (security & link-checking)
- **Structure**: Object with:
  - `lastCheckedAt` (ISO timestamp)
  - `policy` (text description)
  - `sources[]` array where each source has:
    - `id` (sourceId reference)
    - `label` (display name)
    - `category` (Projects, Social, Community, Support, etc.)
    - `url` (original URL)
    - `finalUrl` (after redirects)
    - `statusCode`, `ok` (reachability)
    - `checkedAt` (last verification timestamp)
    - `sourceBasis` (how it was verified)
- **Rule**: **All external links MUST use sourceId**, verified here before publication. Full workflow: [GATES_AND_VALIDATION.md § Live Sources & External Links](GATES_AND_VALIDATION.md#live-sources--external-links-the-full-workflow).

## `official-pages.json`
- **Purpose**: Official Institute website pages and branded shortlinks
- **Structure**: Object with `description`, `checkedAt`, `pages[]` array where each page has:
  - `sourceId` (unique identifier)
  - `title`, `type` ("official")
  - `group` (institute category), `category` (resource category)
  - `audience` (newcomer, learner, researcher, developer, etc.)
  - `tags[]`, `summary`, `relatedSlugs[]`
  - `priority`, `promoted` (bool)
- **Used by**: Resources directory, breadcrumb navigation

## `resources.json`
- **Purpose**: Curated public learning and research resources
- **Structure**: Object with:
  - `types[]` (community, learning, media, official, repository, research, social, support)
  - `categories[]` (each with id, label, description, relatedSlugs)
  - `audiences[]` (newcomer, learner, researcher, developer, contributor)
  - `popularTags[]` (strings like "active-inference", "python", "ontology")
  - `resources[]` array (each resource has sourceId, type, category, audience, tags, summary, priority, featured)
- **Used by**: Resources page, resource filtering

## `repositories.json`
- **Purpose**: Public GitHub repositories in the `ActiveInferenceInstitute` namespace (auto-refreshed from GitHub API)
- **Structure**: Object with `description`, `checkedAt`, `count`, `repositories[]` array where each has:
  - `sourceId` (repo-<name>)
  - `name`, `fullName`, `url`
  - `type` ("repository"), `category` (projects, etc.)
  - `audience`, `tags[]`, `summary`
  - `language`, `stars`, `updatedAt`, `archived`
  - `projectFamily`, `repoType`, `docsUrl`, `docsSourceId`
  - `priority`, `promoted`
- **Used by**: Resources page, projects listing. `check:site` asserts an exact count — see [GATES_AND_VALIDATION.md § 4b](GATES_AND_VALIDATION.md#4b-content-model).

## `social.json`
- **Purpose**: Ordered social channel shortcuts
- **Structure**: Array of `[{ label, sourceId }]` pairs resolved through `live-sources.json`
- **Size**: 7 channels (Discord, YouTube, X, Bluesky, Podbean, Facebook, LinkedIn)
- **Used by**: Footer and get-involved pages

## `metrics.json`
- **Purpose**: Headline stat cards for the home page
- **Structure**: Array of `{ value, label }` objects
- **Used by**: Home page hero section

## `audience-pathways.json`
- **Purpose**: Audience-specific entry points and resource curation
- **Structure**: Object with `description` and `pathways[]` array where each pathway has:
  - `id` (newcomer, learner, researcher, developer, contributor, partner-supporter)
  - `label`, `summary`
  - `primaryHref` (recommended starting page)
  - `links[]` (labeled resourceId or sourceId shortcuts)
- **Size**: 6 pathways — `check:site` requires exactly this set
- **Used by**: Home page, audience-targeting

## `ontology-terms.json`
- **Purpose**: Active Inference Ontology (May 2023) — term definitions and connections
- **Structure**: Object with:
  - `description`, `source` (GitHub URL), `version`
  - `tags[]` (category tags like "Action", "Perception", "Systems")
  - `terms[]` array where each term has:
    - `id` (term-<slug>)
    - `term` (label), `tag` (category)
    - `definition`, `definition2` (optional alt definition)
    - `examples`, `connections` (text)
- **Used by**: Knowledge base surfaces, term cross-referencing

---

## `instituteos/` — Sync-Generated Public Data

`src/content/instituteos/` holds public-safe JSON produced by `scripts/sync_instituteos_public_data.py`. These are **build-time inputs**, never served directly, and never hand-edited.

**Run to regenerate:**
```bash
npm run sync:instituteos
python3 scripts/sync_instituteos_public_data.py --check  # verify
npm run build
```

| File | Schema | Purpose |
| --- | --- | --- |
| `people.json` | `{ records: [{ id, name, login, sourceId, publicRole, repositories[], contributionSummary, relatedSlugs[] }] }` | Public GitHub contributors |
| `projects.json` | `{ records: [{ id, title, sourceId, url, category, audience, language, stars, summary, tags[], relatedSlugs[] }] }` | Repository snapshot |
| `ideas.json` | `{ records: [{ id, label, nodeType, maturity, summary, tags[], trees[], relatedSlugs[] }] }` | Ontology concept nodes |
| `ontology.json` | `{ trees: [], edges: [] }` | Directed relationships in ontology |
| `assets.json` | `{ records: [{ id, filename, path, alt, theme, source }] }` | Brand and design assets |
| `entities.json` | `{ people: [], organizations: [] }` | Governance members and orgs |
| `processes.json` | `{ records: [{ id, title, category, status, steps[] }] }` | Governance workflows |
| `communications.json` | `{ records: [{ id, type, title, author, date, referenceNumber }] }` | Reports and announcements |
| `policies.json` | `{ records: [{ id, title, category, status, tags[] }] }` | Policy registry |
| `tech_tree_graph.json` | Graph data (nodes + edges) | Concept dependency graph |
| `ontology_graph.json` | Graph data | Ontology relationship visualization |
| `governance_graph.json` | Graph data | Governance structure |
| `domain_projects.json` | Project list by domain | Domain-grouped projects |
| `narratives_public.json` | Narrative records | Public stories and case studies |
| `calendar.json` | Event/activity records | Public calendar data |

**Invariants:**
- All string values are normalized (whitespace collapsed, internal terms redacted)
- No private fields (contacts, email, phone) ever present
- `entities.json` uses `people`/`organizations` keys (not `records`)
- `ontology.json` uses `trees`/`edges` keys (not `records`)
- All others use top-level `records` array

Full sync/check contract and failure-mode reference:
[GATES_AND_VALIDATION.md § Gate 2](GATES_AND_VALIDATION.md#gate-2-instituteos-public-data-sync-checkinstituteos).
