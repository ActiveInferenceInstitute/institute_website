# Page JSON Templates

Copy-paste skeletons for creating a new content page under `src/content/pages/`.
Edit source JSON only — never the built `*/index.html`. The build
(`node src/build.mjs`) reads these files and writes HTML to the repo root.

## Rules that apply to every page

- **Slug drives the URL**, not folder nesting (see [`../../url-taxonomy.mjs`](../../url-taxonomy.mjs)):
  - `"x"` → `/x/`
  - `"project-x"` → `/projects/x/`
  - a program slug → `/programs/x/`
- **Links are one of two shapes:**
  - `{ "sourceId": "..." }` — references a registered source in
    [`../live-sources.json`](../live-sources.json). Required for **all external** links.
  - `{ "label": "...", "href": "/clean/path/" }` — for **internal** absolute paths only.
    A raw external `href` fails `check:security` even for vetted hosts.
- Every page needs a **non-empty `primaryActions`**, an **`externalSourceIds`** array,
  and **at least one `primaryAction` backed by a `sourceId`**.
- Each `sourceId` you use must also be listed in the page's `externalSourceIds`.
- Run `npm run check` before committing (link, instituteos, design-system, site, security gates).

---

## Institute page — slug `"x"` → `/x/`

File: `pages/institute/<name>.json`

```json
{
  "slug": "x",
  "title": "Page Title",
  "subtitle": "One-line description shown under the title.",
  "audience": "Who this page is for.",
  "lede": "Opening paragraph summarizing the page.",
  "primaryActions": [
    { "label": "Internal action", "href": "/structure/" },
    { "label": "External action", "sourceId": "official-activeinference-org" }
  ],
  "sections": [
    {
      "heading": "Section heading",
      "body": "Section prose.",
      "links": [{ "sourceId": "ecosystem" }]
    }
  ],
  "cards": [
    {
      "title": "Card title",
      "text": "Short card text.",
      "links": [{ "label": "Internal", "href": "/x/#section-heading" }]
    }
  ],
  "order": 99,
  "relatedSlugs": ["about", "projects"],
  "externalSourceIds": ["official-activeinference-org", "ecosystem"],
  "resourceGroups": ["institute"]
}
```

## Program page — `programs/` folder, slug → `/programs/x/`

File: `pages/programs/<name>.json`. Same schema; the slug resolves under `/programs/`
**only if** the slug is listed in `src/url-taxonomy.json` → `programSubpageSlugs`.
A program slug not in that set routes to `/<slug>/` instead — add it to the set first.

```json
{
  "slug": "fellowship",
  "title": "Fellowship",
  "subtitle": "One-line description.",
  "audience": "Who should apply or participate.",
  "lede": "What participants do and produce.",
  "primaryActions": [
    { "label": "Pathway", "sourceId": "shortlink-fellows" },
    { "label": "Official page", "sourceId": "official-fellowship" }
  ],
  "sections": [
    { "heading": "What participants do", "body": "Prose.", "links": [{ "sourceId": "weekly" }] }
  ],
  "cards": [
    { "title": "Defined scope", "text": "Short text.", "links": [{ "sourceId": "shortlink-fellows" }] }
  ],
  "order": 14,
  "relatedSlugs": ["programs", "internship", "get-involved"],
  "externalSourceIds": ["shortlink-fellows", "official-fellowship", "weekly"],
  "resourceGroups": ["participation", "projects"]
}
```

## Participate page — slug `"x"` → `/x/`

File: `pages/participate/<name>.json`. Same schema; folder is organizational only.

```json
{
  "slug": "get-involved",
  "title": "Get Involved",
  "subtitle": "One-line description.",
  "audience": "New participants, volunteers, supporters.",
  "lede": "Welcoming opening paragraph.",
  "primaryActions": [
    { "label": "Get started", "sourceId": "official-activeinference-org" },
    { "label": "Join Discord", "sourceId": "discord" }
  ],
  "resourceGroups": ["community", "support", "social"],
  "sections": [
    { "heading": "Join the conversation", "body": "Prose.", "links": [{ "sourceId": "discord" }] }
  ],
  "cards": [
    { "title": "Start with Discord", "text": "Short text.", "links": [{ "sourceId": "discord" }] }
  ],
  "order": 8,
  "relatedSlugs": ["about", "activities", "programs"],
  "externalSourceIds": ["discord", "official-activeinference-org"]
}
```

## Project page — slug `"project-x"` → `/projects/x/`

File: `pages/projects/project-<name>.json`. The `project-` prefix maps the URL under `/projects/`.

```json
{
  "slug": "project-aicacp",
  "title": "AICACP",
  "subtitle": "One-line description.",
  "audience": "Who the project is for.",
  "lede": "What the project is and does.",
  "primaryActions": [
    { "label": "Project page", "sourceId": "official-participation" },
    { "label": "ReInference Unit", "href": "/reinference/" }
  ],
  "sections": [
    { "heading": "Overview", "body": "Prose.", "links": [{ "sourceId": "github-org" }] }
  ],
  "order": 21,
  "relatedSlugs": ["reinference", "projects"],
  "externalSourceIds": ["github-org", "official-participation"],
  "resourceGroups": ["projects", "research"]
}
```

---

## Field reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `slug` | string | yes | Drives the URL via [`../../url-taxonomy.mjs`](../../url-taxonomy.mjs); folder nesting is ignored. |
| `title` | string | yes | Page `<h1>` and nav label. |
| `subtitle` | string | yes | Shown under the title. |
| `audience` | string | yes | Who the page is for. |
| `lede` | string | yes | Opening summary paragraph. |
| `primaryActions[]` | array | yes (non-empty) | Each item is a link descriptor; ≥1 must use `sourceId`. |
| `sections[]` | array | yes | `{ heading, body, links[] }`. |
| `cards[]` | array | optional | `{ title, text, links[] }`. |
| `links[]` item | object | — | `{ sourceId }` (external/registered) **or** `{ label, href }` (internal absolute path). |
| `order` | number | yes | Sort position within nav/listing. |
| `relatedSlugs[]` | array | optional | Slugs of related pages. |
| `externalSourceIds[]` | array | yes | Every `sourceId` used on the page must be listed here; resolve in [`../live-sources.json`](../live-sources.json). |
| `resourceGroups[]` | array | optional | Resource group keys to surface on the page. |

See sibling examples: [`institute/structure.json`](institute/structure.json),
[`programs/fellowship.json`](programs/fellowship.json),
[`participate/get-involved.json`](participate/get-involved.json),
[`projects/project-aicacp.json`](projects/project-aicacp.json).
