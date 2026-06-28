# Domain Cutover (Squarespace → GitHub Pages)

Workflow for moving `activeinference.institute` off Squarespace onto this static
site without breaking existing links. The full runbook is
[`../../../../MIGRATION.md`](../../../../MIGRATION.md); this is the agent-facing
summary. Almost everything here is repo work you can do and verify; the **only
human-only step is DNS plus enabling the custom domain** (you cannot touch the
registrar or GitHub settings).

## What's automatic (don't re-engineer it)

- **Legacy URL redirects** are handled by
  [`../../../../assets/js/redirects.js`](../../../../assets/js/redirects.js),
  loaded **only** on [`../../../../404.html`](../../../../404.html). GitHub Pages
  serves `404.html` for any unbuilt path, so every stale Squarespace path runs
  the script and `location.replace()`s to the new page. To add a mapping, edit
  the `MAP` object — no rebuild needed for that file alone, but run
  `npm run check`.
- **Base awareness.** The redirect script and the build are base-path aware, so
  redirects work correctly on both `/institute_website/` (project page) and `/`
  (apex) bases. The `baseUrl` flip below only changes canonical, `hreflang`,
  sitemap, Open Graph URLs, and the absolute script path — not redirect behavior.
- **Subdomain shortlinks** (`<name>.activeinference.institute`) are registrar DNS
  forwards, independent of hosting. Leave them alone during cutover; repoint at
  your own pace per MIGRATION.md §2.

## Repo steps (agent does these, then verify)

1. **Add the `CNAME` file** at the repo root containing exactly:

   ```
   activeinference.institute
   ```

2. **Set the apex base URL** in
   [`../../../../src/content/site.json`](../../../../src/content/site.json):

   ```json
   "baseUrl": "https://activeinference.institute/"
   ```

   Never write the old `activeinferenceinstitute.github.io/institute_website`
   URL as the canonical base.

3. **Rebuild and gate.** The build reads JSON under `src/content/` and writes
   HTML to the repo root (built output is committed):

   ```bash
   node src/build.mjs
   npm run check   # check:links, check:instituteos, check:design-system,
                   # check:site, check:security  (python + node, no network)
   ```

   Commit both `src/content/site.json` and the regenerated `*/index.html`. Edit
   source only — never hand-edit built `*/index.html`.

## Human-only steps (flag these; you cannot do them)

These move actual traffic and live outside the repo — surface them to the human:

4. **Point apex DNS at GitHub Pages** at the registrar that holds the Squarespace
   forwards: four `A` records `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`, plus a `www` `CNAME` to
   `activeinferenceinstitute.github.io`. This is the only step that actually
   moves traffic off Squarespace.
5. **Enable the custom domain in GitHub Pages settings** and turn on **Enforce
   HTTPS** once the certificate provisions.

Order matters only for the human steps: the repo can be fully prepared and gated
before any DNS change, since redirects already work at both bases.

> See [`../../../../MIGRATION.md`](../../../../MIGRATION.md) §3 for the canonical
> step list and §4 for the per-page content still needed to fully retire Coda.
