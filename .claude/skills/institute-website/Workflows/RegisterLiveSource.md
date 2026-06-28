# Register a Live Source

Workflow for adding an external link to a content page. External URLs cannot be
inlined as raw `href`s on content pages — they must first be registered in
[`src/content/live-sources.json`](../../../../src/content/live-sources.json) and
then referenced from page JSON by `{sourceId}`.

## Why raw external hrefs are rejected

The security gate
([`scripts/check_static_security.py`](../../../../scripts/check_static_security.py))
scans every built `*.html` file. Any anchor to an `http(s)` host must be
*backed*: its href has to match a registered live-source URL
(`href in allowed_live_urls`, or the trailing-slash variants) **or** the host
must be on the hardcoded `VETTED_ANCHOR_HOST_SUFFIXES` allowlist (YouTube,
github.com, zoom.us, etc.). Anything else fails `check:security`, even for
otherwise-reputable hosts. `coda.io` anchors are banned outright. Backed anchors
must also carry `target="_blank"` and `rel="noopener noreferrer"` — the renderer
adds these automatically when it resolves a source, so you get them for free by
going through the registry.

The render side
([`src/render/links.mjs`](../../../../src/render/links.mjs)) only emits a
`{sourceId}` link when the source resolves **and** `source.ok === true`. An entry
with `"ok": false` is silently dropped from the page, so a stale or unreachable
source disappears rather than shipping a dead link.

## Steps

1. Add an entry to the `sources` array in
   [`src/content/live-sources.json`](../../../../src/content/live-sources.json):

   ```json
   {
     "id": "model-stream",
     "label": "Model Stream playlist",
     "category": "Media",
     "url": "https://www.youtube.com/playlist?list=PLNm0u2n1IwdrZbHpBHCdYqQGmbnLAt7nf",
     "sourceBasis": "Public playlist verified directly on YouTube.",
     "finalUrl": "https://www.youtube.com/playlist?list=PLNm0u2n1IwdrZbHpBHCdYqQGmbnLAt7nf",
     "statusCode": 200,
     "ok": true,
     "checkedAt": "2026-06-28T00:00:00Z"
   }
   ```

   - `id` — stable, lowercase-kebab; this is what page JSON references.
   - `url` — the public-facing destination the page links to. This exact string
     (and its `/`-trimmed and `/`-suffixed variants) is what the gate matches
     against. The renderer emits `source.url`, not `finalUrl`.
   - `finalUrl`, `statusCode`, `ok`, `checkedAt` — the reachability snapshot from
     the last link check. Set `ok: true` only when the source actually resolves.
   - `label` — default link text when the page-side descriptor omits one.
   - `sourceBasis` — one sentence on how the URL was verified.

2. Reference it from a page in
   [`src/content/pages/`](../../../../src/content/pages/). Use a `{sourceId}`
   link descriptor anywhere a `links[]` array is accepted (`sections[].links`,
   `cards[].links`, `primaryActions`), and list the id in `externalSourceIds`:

   ```json
   {
     "externalSourceIds": ["model-stream"],
     "sections": [
       {
         "heading": "Watch",
         "body": "Recorded model walkthroughs.",
         "links": [{ "sourceId": "model-stream" }]
       }
     ]
   }
   ```

   Add `"label": "..."` to the descriptor to override the source's default text.

3. Run `npm run check` (`check:links`, `check:site`, `check:security`, ...) and
   rebuild with `node src/build.mjs`. Never edit the built `*/index.html`.

## Picking a category

`category` is free-text shown as link metadata, but reuse an existing value for
consistency. Current categories include: `Activities`, `Community`,
`Institute`, `Learning`, `Media`, `Participate`, `People`, `Projects`,
`Repository`, `Research`, `Social`, `Support`, `Updates`. Pick the closest fit;
add a new one only when none apply.

## The `%40` encoding caveat

The gate compares the rendered anchor href against the registry URL as an exact
string. If a URL contains an `@` (e.g. Google Calendar group addresses), the
rendered form encodes it as `%40` (see
[`scripts/sync_instituteos_public_data.py`](../../../../scripts/sync_instituteos_public_data.py)).
Store the **`%40`-encoded** form in `url` so it matches what ships; a raw `@`
will not back the anchor and the security check will fail.
