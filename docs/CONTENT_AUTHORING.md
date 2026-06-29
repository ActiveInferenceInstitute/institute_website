> Part of the `institute_website` documentation set — see [README.md](README.md).
> Curated conceptual view; the authoritative per-folder contracts live in each
> folder's `AGENTS.md`. The `docs/` folder is **not** built into the site.

# Content Source Layout & Page Schema

## Overview

The Active Inference Institute website uses a **single-source-of-truth JSON architecture** where all content lives under `src/content/` and is built to static HTML at the repository root via `src/build.mjs`. Folder nesting is **purely organizational** — the page `slug` field exclusively determines the output URL path (via `src/url-taxonomy.mjs`).

**Key Principle**: Edit JSON sources only; never edit built `*/index.html`. Run `node src/build.mjs && npm run check` after any change.

---

## Page Schema (All Pages)

Every page JSON object supports these fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `slug` | string | **YES** | Drives the output URL via `url-taxonomy.mjs`. Must be unique. |
| `title` | string | **YES** | Page `<h1>` and navigation label. |
| `subtitle` | string | **YES** | One-line descriptor shown under the title. |
| `audience` | string | **YES** | Who the page is for (e.g., "Researchers and practitioners"). |
| `lede` | string | **YES** | Opening summary paragraph (2-3 sentences). |
| `primaryActions[]` | link[] | **YES** (non-empty) | Hero CTA buttons (max 3 rendered). **At least one** must use `sourceId`. |
| `sections[]` | object[] | **YES** | Page body: each `{ heading, body, links[] }`. `heading` and `body` are strings; `links[]` is optional. |
| `cards[]` | object[] | optional | Card grid: each `{ title, text, links[] }`. All three fields are optional per card. |
| `order` | number | **YES** | Sort position within nav/collection listings. Used in primary nav and project/program listings. |
| `relatedSlugs[]` | string[] | optional | Slugs of related pages (used for cross-links and next-action pager). |
| `externalSourceIds[]` | string[] | **YES** | All `sourceId`s used anywhere on the page must be listed here. Enables link-check validation. |
| `resourceGroups[]` | string[] | optional | Live-source **categories** to filter resources (e.g., `["projects", "community"]`). First entry seeds the page's "Filtered resources" next-action. Valid values are lowercased live-source category names. |

### Link Rules

Every link is **one of two shapes** — never both in the same link object:

- **`{ "sourceId": "..." }`** — References a registered external link in `live-sources.json`. **Required for all external links.** A raw external `href` fails security checks.
- **`{ "label": "...", "href": "..." }`** — For **internal links only** (clean absolute paths like `/structure/`, `/structure/#officers`).

Every `sourceId` used on a page must be listed in that page's `externalSourceIds[]` array.

---

## Page Type Taxonomy

All pages use the **same schema** but route differently based on slug shape (registered in `url-taxonomy.json → programSubpageSlugs`):

| Page Type | Slug Example | File Location | Output URL | Route Logic |
| --- | --- | --- | --- | --- |
| **Home** | `index` | `pages/index.json` | `/` | Rooted at repo root |
| **Top-level** | `about`, `structure`, `ecosystem` | `pages/institute/`, `pages/participate/` (folder is optional) | `/<slug>/` | Any slug not in other categories |
| **Program subpage** | `fellowship`, `internship`, `mentorship`, `partnership`, `philanthropy` | `pages/programs/<slug>.json` | `/programs/<slug>/` | Must be registered in `url-taxonomy.json → programSubpageSlugs` |
| **Project** | `project-aicacp`, `project-geo-infer` | `pages/projects/project-<name>.json` | `/projects/<name>/` | Slug starts with `project-`; prefix stripped in URL |
| **Collection** | `projects`, `programs`, `resources` | `pages/<slug>.json` or any subfolder | `/<slug>/` | Special meta-pages listing all items in a category |

---

## Slug → URL Mapping (`url-taxonomy.mjs`)

The `baseDirForSlug()` function (single source of truth) applies:

```
index                  → ""                    (/index.html → /)
project-*              → projects/<name>/      (/projects/<name>/index.html)
program subpage slug   → programs/<slug>/      (/programs/<slug>/index.html)
any other slug         → <slug>/               (/<slug>/index.html)
```

**Folder nesting is ignored**: a page at `src/content/pages/institute/about.json` with slug `"about"` routes to `/about/`, not `/institute/about/`.

---

## Source Folder Organization (Maintainer-Facing)

Folder grouping is **organizational only** — the build walks the tree recursively and ignores folder nesting. Current structure:

| Folder | Contains | Count |
| --- | --- | --- |
| `pages/institute/` | About, structure, governance, ecosystem, domain knowledge (active-inference-and-*) pages | 19 |
| `pages/participate/` | Participation pathways: get-involved, volunteer, grants, learning, prepare | 5 |
| `pages/programs/` | Structured participation programs: fellowship, internship, mentorship, partnership, philanthropy, eduactive, reinference | 8 |
| `pages/projects/` | Per-project pages (all prefixed `project-`) | 51 |
| `pages/` (root) | `projects.json` (collection meta-page) | 1 |

Total: **84 page JSON files**.

---

## Top-Level Registries (`src/content/*.json`)

All registries are loaded at build time and merged into the rendered pages and special surfaces.

### `site.json`
- **Purpose**: Site identity and metadata
- **Structure**: Single object with `name`, `shortName`, `tagline`, `description`, `email`, `baseUrl` (canonical URL), `repository`, `resourcePolicy`
- **Size**: ~10 lines
- **Used by**: Page layout, meta tags, contact info

### `navigation.json`
- **Purpose**: Header navigation menus
- **Structure**: Array of menu groups `[{ label: string, items: [{label, slug, anchor?}] }]`
- **Size**: 5 menu groups (Institute, Learn, Participate, Projects, Resources)
- **Used by**: Header menu rendering; `slug` values resolve through `url-taxonomy.mjs`

### `live-sources.json`
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
- **Size**: ~130 entries
- **Rule**: **All external links MUST use sourceId**, verified here before publication

### `official-pages.json`
- **Purpose**: Official Institute website pages and branded shortlinks
- **Structure**: Object with `description`, `checkedAt`, `pages[]` array where each page has:
  - `sourceId` (unique identifier)
  - `title`, `type` ("official")
  - `group` (institute category), `category` (resource category)
  - `audience` (newcomer, learner, researcher, developer, etc.)
  - `tags[]`, `summary`, `relatedSlugs[]`
  - `priority`, `promoted` (bool)
- **Size**: ~50+ official pages
- **Used by**: Resources directory, breadcrumb navigation

### `resources.json`
- **Purpose**: Curated public learning and research resources
- **Structure**: Object with:
  - `types[]` (community, learning, media, official, repository, research, social, support)
  - `categories[]` (each with id, label, description, relatedSlugs)
  - `audiences[]` (newcomer, learner, researcher, developer, contributor)
  - `popularTags[]` (strings like "active-inference", "python", "ontology")
  - `resources[]` array (each resource has sourceId, type, category, audience, tags, summary, priority, featured)
- **Size**: ~200 resource entries
- **Used by**: Resources page, resource filtering

### `repositories.json`
- **Purpose**: Public GitHub repositories in the `ActiveInferenceInstitute` namespace (auto-refreshed from GitHub API)
- **Structure**: Object with `description`, `checkedAt`, `count`, `repositories[]` array where each has:
  - `sourceId` (repo-<name>)
  - `name`, `fullName`, `url`
  - `type` ("repository"), `category` (projects, etc.)
  - `audience`, `tags[]`, `summary`
  - `language`, `stars`, `updatedAt`, `archived`
  - `projectFamily`, `repoType`, `docsUrl`, `docsSourceId`
  - `priority`, `promoted`
- **Size**: 52 public repos
- **Used by**: Resources page, projects listing

### `social.json`
- **Purpose**: Ordered social channel shortcuts
- **Structure**: Array of `[{ label, sourceId }]` pairs resolved through `live-sources.json`
- **Size**: 7 channels (Discord, YouTube, X, Bluesky, Podbean, Facebook, LinkedIn)
- **Used by**: Footer and get-involved pages

### `metrics.json`
- **Purpose**: Headline stat cards for the home page
- **Structure**: Array of `{ value, label }` objects
- **Size**: 5 metrics (nonprofit status, link count, repo count, community size, recordings)
- **Used by**: Home page hero section

### `audience-pathways.json`
- **Purpose**: Audience-specific entry points and resource curation
- **Structure**: Object with `description` and `pathways[]` array where each pathway has:
  - `id` (newcomer, learner, researcher, developer, contributor, partner-supporter)
  - `label`, `summary`
  - `primaryHref` (recommended starting page)
  - `links[]` (labeled resourceId or sourceId shortcuts)
- **Size**: 6 pathways
- **Used by**: Home page, audience-targeting

### `ontology-terms.json`
- **Purpose**: Active Inference Ontology v5 (May 2023) — term definitions and connections
- **Structure**: Object with:
  - `description`, `source` (GitHub URL), `version`
  - `tags[]` (category tags like "Action", "Perception", "Systems")
  - `terms[]` array where each term has:
    - `id` (term-<slug>)
    - `term` (label), `tag` (category)
    - `definition`, `definition2` (optional alt definition)
    - `examples`, `connections` (text)
- **Size**: ~150 terms
- **Used by**: Knowledge base surfaces, term cross-referencing

---

## instituteos/ — Sync-Generated Public Data

`src/content/instituteos/` holds public-safe JSON produced by `scripts/sync_instituteos_public_data.py`. These are **build-time inputs**, never served directly.

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

---

## Concrete Annotated Example Page JSON

**File**: `src/content/pages/projects/project-aicacp.json`

```json
{
  "slug": "project-aicacp",
  "title": "AICACP",
  "subtitle": "The AI Capabilities & Alignment Consensus Project — reshaping the conversation around AI capabilities, alignment, and regulation.",
  "audience": "Researchers, practitioners, and policy-oriented contributors interested in AI capabilities, alignment, world models, and agency.",
  "lede": "AICACP — the AI Capabilities & Alignment Consensus Project — is a multi-year initiative designed to reshape the conversation around AI capabilities, alignment, and regulation.",
  
  // Non-empty primary actions; at least one uses sourceId
  "primaryActions": [
    { "label": "Project document", "sourceId": "aicacp-project-doc" },
    { "label": "ReInference Unit", "href": "/reinference/" }
  ],
  
  // Body sections: heading + prose + optional links
  "sections": [
    {
      "heading": "Survival and Flourishing Fund grant",
      "body": "In June 2025, the Survival and Flourishing Fund awarded a $270,000 grant…",
      "links": [{ "sourceId": "aicacp-project-doc" }]
    },
    {
      "heading": "About the project",
      "body": "AICACP is a multi-year initiative…",
      "links": [{ "label": "ReInference Unit", "href": "/reinference/" }]
    }
  ],
  
  // Optional card grid
  "cards": [
    {
      "title": "Defined scope",
      "text": "A clear project focus agreed at the start.",
      "links": [{ "sourceId": "aicacp-project-doc" }]
    }
  ],
  
  // Sort order in listings
  "order": 21,
  
  // Cross-links and pager
  "relatedSlugs": ["reinference", "projects", "active-inference"],
  
  // EVERY sourceId used on the page MUST be listed here
  "externalSourceIds": ["aicacp-project-doc", "discord"],
  
  // Resource categories to filter/display resources
  "resourceGroups": ["projects", "research"]
}
```

---

## Complete Inventory of 84 Pages

All pages are loaded recursively from `src/content/pages/` and its subdirectories. Folder location is organizational only; the `slug` determines the URL.

### Institute Pages (19 pages)
Located: `src/content/pages/institute/`

| Filename | Slug | Title | Route |
| --- | --- | --- | --- |
| `2025.json` | `2025` | 2025 Annual Report | `/2025/` |
| `2026.json` | `2026` | 2026 Annual Report | `/2026/` |
| `about.json` | `about` | About the Institute | `/about/` |
| `**active-inference-and-ecology.json**` | `active-inference-and-ecology` | Active Inference and Ecology | `/active-inference-and-ecology/` |
| `**active-inference-and-healthcare.json**` | `active-inference-and-healthcare` | Active Inference and Healthcare | `/active-inference-and-healthcare/` |
| `**active-inference-and-robotics.json**` | `active-inference-and-robotics` | Active Inference and Robotics | `/active-inference-and-robotics/` |
| `active-inference.json` | `active-inference` | Active Inference | `/active-inference/` |
| `activities.json` | `activities` | Activities & Events | `/activities/` |
| `board-of-directors.json` | `board-of-directors` | Board of Directors | `/board-of-directors/` |
| `ecosystem.json` | `ecosystem` | Ecosystem | `/ecosystem/` |
| `history.json` | `history` | History | `/history/` |
| `instituteos.json` | `instituteos` | InstituteOS Interface | `/instituteos/` |
| `measure.json` | `measure` | Measure | `/measure/` |
| `officers.json` | `officers` | Officers | `/officers/` |
| `scientific-advisory-board.json` | `scientific-advisory-board` | Scientific Advisory Board | `/scientific-advisory-board/` |
| `strategy.json` | `strategy` | Strategy | `/strategy/` |
| `structure.json` | `structure` | Structure & Governance | `/structure/` |
| `video.json` | `video` | Video Archive | `/video/` |
| `weekly.json` | `weekly` | Weekly Activities | `/weekly/` |

**Note on active-inference-and-* pages**: These three **domain knowledge pages** are currently in `pages/institute/`. They document the application of Active Inference across specific disciplines (ecology, healthcare, robotics). See **Refactor Notes** below.

### Participate Pages (5 pages)
Located: `src/content/pages/participate/`

| Filename | Slug | Title | Route |
| --- | --- | --- | --- |
| `get-involved.json` | `get-involved` | Get Involved | `/get-involved/` |
| `grants.json` | `grants` | Grants | `/grants/` |
| `learning.json` | `learning` | Learning and Research | `/learning/` |
| `prepare.json` | `prepare` | Project Preparation | `/prepare/` |
| `volunteer.json` | `volunteer` | Volunteer | `/volunteer/` |

### Programs Pages (8 pages)
Located: `src/content/pages/programs/`

| Filename | Slug | Title | Route | Notes |
| --- | --- | --- | --- | --- |
| `eduactive.json` | `eduactive` | EduActive Unit | `/eduactive/` | Program unit (not a structured subpage) |
| `fellowship.json` | `fellowship` | Fellowship | `/programs/fellowship/` | Program subpage (registered in url-taxonomy.json) |
| `internship.json` | `internship` | Internship | `/programs/internship/` | Program subpage |
| `mentorship.json` | `mentorship` | Mentorship | `/programs/mentorship/` | Program subpage |
| `partnership.json` | `partnership` | Partnership | `/programs/partnership/` | Program subpage |
| `philanthropy.json` | `philanthropy` | Philanthropy | `/programs/philanthropy/` | Program subpage |
| `programs.json` | `programs` | Programs | `/programs/` | Collection meta-page |
| `reinference.json` | `reinference` | ReInference Unit | `/reinference/` | Program unit (not a structured subpage) |

**Program Subpage Slugs** (register in `url-taxonomy.json → programSubpageSlugs`): `fellowship`, `internship`, `mentorship`, `partnership`, `philanthropy`

### Projects Pages (51 pages)
Located: `src/content/pages/projects/`

All slug with prefix `project-<name>` route to `/projects/<name>/`.

| Filename | Slug | Title | Domain |
| --- | --- | --- | --- |
| `project-active-blockference.json` | `project-active-blockference` | Active Blockference | Systems |
| `project-active-inferants.json` | `project-active-inferants` | Active InferAnts | Collective Behavior |
| `project-active-inference-journal.json` | `project-active-inference-journal` | Active Inference Journal | Publishing |
| `project-active-inference-ontology.json` | `project-active-inference-ontology` | Active Inference Ontology | Ontology |
| `project-active-inference-social-sciences.json` | `project-active-inference-social-sciences` | Active Inference & Social Sciences | Applications |
| `project-affordances.json` | `project-affordances` | Affordances | Theory |
| `project-aicacp.json` | `project-aicacp` | AICACP | AI Alignment |
| `project-anima.json` | `project-anima` | ANIMA | Learning |
| `project-artificial-sentience.json` | `project-artificial-sentience` | Artificial Sentience | Philosophy |
| `project-audio-visual-production.json` | `project-audio-visual-production` | Audio-Visual Production | Media |
| `project-belief-updating-ptsd.json` | `project-belief-updating-ptsd` | Belief Updating & PTSD | Healthcare |
| `project-brain-metabolism.json` | `project-brain-metabolism` | Brain Metabolism | Neuroscience |
| `project-clinical-waveform.json` | `project-clinical-waveform` | Clinical Waveform | Healthcare |
| `project-cognarn.json` | `project-cognarn` | CogNARN | Robotics |
| `project-cognitive-agent-modeling.json` | `project-cognitive-agent-modeling` | Cognitive Agent Modeling | Modeling |
| `project-collective-foraging.json` | `project-collective-foraging` | Collective Foraging | Ecology |
| `project-creativity-fep.json` | `project-creativity-fep` | Creativity & FEP | Theory |
| `project-cycle-book.json` | `project-cycle-book` | Cycle Book | Education |
| `project-educational-course-development.json` | `project-educational-course-development` | Educational Course Development | Education |
| `project-einstein-model.json` | `project-einstein-model` | Einstein Model | Modeling |
| `project-farmworks.json` | `project-farmworks` | FarmWorks | Ecology |
| `project-froebel.json` | `project-froebel` | Froebel | Education |
| `project-fundamentals-active-inference.json` | `project-fundamentals-active-inference` | Fundamentals of Active Inference | Education |
| `project-geo-infer.json` | `project-geo-infer` | GEO-INFER | Ecology |
| `project-geometric-inquiry.json` | `project-geometric-inquiry` | Geometric Inquiry | Theory |
| `project-gnn.json` | `project-gnn` | Generalized Notation Notation (GNN) | Tools |
| `project-graphical-interface.json` | `project-graphical-interface` | Graphical Interface | Tools |
| `project-graphspeak.json` | `project-graphspeak` | GraphSpeak | Communication |
| `project-humanitys-story.json` | `project-humanitys-story` | Humanity's Story | Narrative |
| `project-knowledge-engineering.json` | `project-knowledge-engineering` | Knowledge Engineering | Tools |
| `project-m-theory-hdpls.json` | `project-m-theory-hdpls` | M-Theory & HDPLS | Theory |
| `project-mathart.json` | `project-mathart` | MathArt | Education |
| `project-model-centric-cognition.json` | `project-model-centric-cognition` | Model-Centric Cognition | Theory |
| `project-neurodivergent-learning.json` | `project-neurodivergent-learning` | Neurodivergent Learning | Education |
| `project-numinia.json` | `project-numinia` | Numinia | Tools |
| `project-physics-course.json` | `project-physics-course` | Physics Course | Education |
| `project-robotic-microscopy.json` | `project-robotic-microscopy` | Robotic Microscopy | Robotics |
| `project-rxinfer-visualization.json` | `project-rxinfer-visualization` | RxInfer Visualization | Tools |
| `project-rxinfer.json` | `project-rxinfer` | RxInfer | Implementation |
| `project-seasonal-school.json` | `project-seasonal-school` | Seasonal School | Education |
| `project-sweet-dogg.json` | `project-sweet-dogg` | Sweet DoggE | Learning |
| `project-symbolic-robotics.json` | `project-symbolic-robotics` | Symbolic Robotics | Robotics |
| `project-symposium.json` | `project-symposium` | Applied Active Inference Symposium | Conference |
| `project-textbook-group.json` | `project-textbook-group` | Textbook Group | Education |
| `project-theoretical-neurobiology.json` | `project-theoretical-neurobiology` | Theoretical Neurobiology | Neuroscience |
| `project-three-mosqueteers.json` | `project-three-mosqueteers` | Three Musketeers | Collaboration |
| `project-tower-of-babel.json` | `project-tower-of-babel` | Tower of Babel | Translation |
| `project-translation-agent.json` | `project-translation-agent` | Translation Agent | Tools |
| `project-universal-basic-income.json` | `project-universal-basic-income` | Universal Basic Income | Economics |
| `project-video-improvement.json` | `project-video-improvement` | Video Improvement | Media |
| `project-wave-hypothesis.json` | `project-wave-hypothesis` | Wave Hypothesis | Theory |

### Root-Level Collection Page (1 page)
Located: `src/content/pages/`

| Filename | Slug | Title | Route |
| --- | --- | --- | --- |
| `projects.json` | `projects` | All Projects | `/projects/` |

---

## Build Process & URL Generation

**Source of Truth**: `src/url-taxonomy.mjs` (`baseDirForSlug()` function)

**Folder nesting is ignored entirely**:
1. `src/data.mjs` recursively walks `src/content/pages/` and all subdirectories
2. Every `.json` file found is loaded; folder structure doesn't affect output
3. Each page's `slug` is looked up in `url-taxonomy.mjs`
4. Output path is determined **solely by slug shape**

**Verification**: The Python contract checker (`scripts/check_site_contract.py`) uses the same `url-taxonomy.json` for validation, ensuring JS build and Python checks align.

---

## Security & Validation Gates

Run before committing:

```bash
node src/build.mjs     # Build HTML
npm run check          # Run all validation gates:
                       #   check:links     — all sourceIds exist, URLs reachable
                       #   check:security  — no raw external hrefs (must use sourceId)
                       #   check:design-system  — design compliance
                       #   check:site      — page schema validation
                       #   check:instituteos   — instituteos/ data contract
```

**Link Rules**:
- Every `sourceId` used on a page must be listed in `externalSourceIds[]`
- External links must use `sourceId` (must exist in `live-sources.json`)
- Internal links can use `{ "label", "href" }` with clean absolute paths only
- `resourceGroups[]` values must be valid live-source category IDs

**Constraints**:
- Strict Content Security Policy: no inline script/style, no `iframe`/`object`/`embed`/`form`
- Page-specific JS belongs in `assets/js/*.js` and is conditionally referenced from `src/render/layout.mjs`
- No client-side fetch; all dynamic behavior pre-rendered or scripted at build time

---

## Page Authoring Workflow

**To Add or Edit a Page**:

1. Create or edit a JSON file under `src/content/pages/<folder>/` (folder is optional for organization)
2. Include all **required fields** (slug, title, subtitle, audience, lede, primaryActions, sections, order, externalSourceIds)
3. For external links: use `{ "sourceId": "..." }` only; ensure the sourceId exists in `live-sources.json`
4. For internal links: use `{ "label": "...", "href": "/clean/path/" }` (no domain, absolute paths)
5. Add every used `sourceId` to `externalSourceIds[]`
6. Run:
   ```bash
   node src/build.mjs
   npm run check
   ```
7. Verify the built page at its output URL (e.g., `/about/index.html` for slug `about`)
8. Commit only the JSON source; built HTML is auto-generated

**Folder Organization Guidance**:
- Use `pages/institute/` for institutional, governance, and domain-knowledge pages
- Use `pages/participate/` for entry points and participation pathways
- Use `pages/programs/` for structured program pages
- Use `pages/projects/` for per-project pages (prefix all slugs with `project-`)

---

## i18n (Internationalization)

Translated content lives in `src/content/i18n/`:
- `_strings.json` — master keys and English values
- Per-locale files (`es.json`, `ja.json`, `zh.json`, etc.) — translated strings

The build renders each page once per locale under a locale-specific prefix (default locale at root; others under `/<code>/`).

---

## Constraints & Non-Negotiables

1. **Slug uniqueness**: Every page slug must be unique across the entire site.
2. **URL immutability**: Once a page's URL is public, never change its slug (breaks links; use redirect middleware instead).
3. **Source-folder irrelevance**: Reorganizing source folders does not change URLs; only slug changes do.
4. **Link security**: Raw `href` to external sites fails the security check; must use `sourceId`.
5. **Build is the source**: Built HTML is committed but is derivative; always edit JSON sources.
