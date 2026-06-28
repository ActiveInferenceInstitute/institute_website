# Add a Project Page

Use this to add a new project page that routes to `/projects/<name>/`. You edit
source JSON only; the build writes the HTML.

## 1. Pick the slug

The slug **must** start with `project-`. `src/url-taxonomy.mjs`
(`baseDirForSlug`) maps `project-<name>` → directory `projects/<name>`, so the
canonical URL is `/projects/<name>/`. The `project-` prefix is the only thing
that routes the page under `/projects/`; folder nesting does **not** matter.

```
slug "project-aicacp"  ->  /projects/aicacp/
slug "project-gnn"     ->  /projects/gnn/
```

## 2. Create the source file

Put the page JSON at:

```
src/content/pages/projects/<slug>.json    e.g. project-foo.json
```

The `projects/` subfolder is convention only — the slug, not the path, decides
the URL. Use [`../../../../src/content/pages/projects/project-aicacp.json`](../../../../src/content/pages/projects/project-aicacp.json)
as a model.

## 3. Skeleton

```json
{
  "slug": "project-foo",
  "title": "Foo",
  "subtitle": "One-line description of the project.",
  "audience": "Who this project is for.",
  "lede": "A paragraph framing the project and its relation to Active Inference.",
  "primaryActions": [
    { "label": "Project page", "sourceId": "official-participation" },
    { "label": "ReInference Unit", "href": "/reinference/" }
  ],
  "sections": [
    {
      "heading": "Overview",
      "body": "What the project does.",
      "links": [{ "sourceId": "github-org" }]
    },
    {
      "heading": "Participation",
      "body": "How to get involved.",
      "links": [{ "sourceId": "discord" }]
    }
  ],
  "order": 22,
  "relatedSlugs": ["reinference", "projects", "active-inference"],
  "externalSourceIds": ["github-org", "discord", "official-participation"],
  "resourceGroups": ["projects", "research"]
}
```

## 4. Link rules

Every link descriptor is **either** `{ "sourceId": "..." }` (a registered live
source) **or** `{ "label": "...", "href": "..." }`. Internal `href`s are
absolute clean paths like `/reinference/`. **External links must use
`sourceId`** referencing an entry in
[`../../../../src/content/live-sources.json`](../../../../src/content/live-sources.json) —
a raw external `href` fails the security gate even for vetted hosts.

For a project's repo / Discord / shortlink, register the source in
`live-sources.json` first (or reuse an existing one such as `github-org`,
`discord`, `aicacp`), then reference it by `sourceId`.

Required for every content page:

- `primaryActions` non-empty, with at least one action backed by a `sourceId`.
- `externalSourceIds` listing every `sourceId` used on the page.

## 5. Wire it into the projects index (optional but expected)

`src/content/pages/projects.json` is the `/projects/` index. Add a `card` and/or
a `links` entry under the relevant unit section so the new page is discoverable.
Internal links use the clean path, e.g.:

```json
{ "label": "Foo", "href": "/projects/foo/" }
```

## 6. Rebuild and gate

```bash
node src/build.mjs     # regenerates projects/<name>/index.html and the rest
npm run check          # check:links, check:instituteos, check:design-system,
                       # check:site, check:security  (no network)
```

Built output is committed (GitHub Pages serves the repo root), so commit both
the source JSON and the regenerated `projects/<name>/index.html`. Never hand-edit
the built `*/index.html`.
