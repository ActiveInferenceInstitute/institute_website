# Indexing, accessibility and visitor-journey follow-up

This source update extends the [released indexing repair](INDEXING_REPAIR_2026-10-25.md).
It preserves honest 404s, deliberate utility noindex, English consolidation of
untranslated archives, exact simulation filename case and independent shortlinks.
Local checks establish source/build behavior; deployment and search-engine
recrawl remain separate evidence.

## Redirects and hosting

HTML aliases load the shared generated redirect runtime synchronously. A
JavaScript-enabled request preserves its query string, repeated query keys and
fragment. The zero-delay static refresh is inside `noscript`, so it cannot race
the script. Without JavaScript, the static fallback reaches the canonical path
but cannot recover the request's dynamic query/fragment. If the script fails to
load, the visible continuation link remains available. These are HTTP 200 HTML
stubs on GitHub Pages, not permanent server redirects.

The [optional Workers adapter](../edge/README.md) supplies a concrete HTTP 308
deployment option using the same generated map and a Static Assets origin.
It is unbound. A provider/zone and apex/www binding migration requires separate
authorization. Keep independent subdomain forwards outside that boundary, retain
GitHub Pages during migration, and verify all redirect headers and rollback
bindings before changing traffic. Apex robots rules cannot repair another
host's availability or downstream form/document crawler policy.

## Simulation and video metadata

The Institute domain, `https://activeinference.institute/`, is the confirmed
canonical home for these demos (decision confirmed October 26, 2026).
The twelve mirrored simulations use their exact-case HTTPS Institute URLs as
canonical, `lang=en` and individual descriptions. Their original provenance at
ActiveInference.org is retained. The original site's metadata is independently
owned; this change does not claim to alter it. Mobile-only presentation patches stack overlapping panels and restore reachable
controls in seven demos. Original model scripts and desktop calculations remain
unchanged. Simulation bodies retain their vendored security behavior, while indexability checks now
require their metadata instead of exempting it.

Video detail pages are transcript/reference archives linking to external watch
pages. Their current public records contain session dates, not verified upload
timestamps. The renderer no longer invents a default upload date, appends a
fabricated timezone, assumes a thumbnail exists, or substitutes a generic social
card into VideoObject metadata. Normal page metadata and English archive
canonicals remain. Restoring rich-result markup requires authentic publication
timestamps, verified representative thumbnails and a deliberate watch-page
experience; metadata alone cannot establish eligibility or Google indexing.

## Current participation information

The [current public Symposium program](https://2026symposium.activeinference.institute/)
confirms November 12–13, 2026. Both streams start at 12:00 UTC; the Day 1 keynote
starts at 13:00 UTC. The registration wording matches those two days. The
presentation call closes at the end of October; no unverified cutoff timezone
is invented. The website's current-edition copy, cards and translation keys are
aligned; historical edition dates remain unchanged. The public calendar is
refreshed from its source feed rather than hand-edited to invent schedule data.

Fellowship's primary action reaches its application requirements, alongside an
email action with the documented subject. Its informational shortlink remains
unchanged. The homepage prioritizes learning, projects, events and audience
pathways; export mechanics remain on the sources/methods page. Interns, fellows, donors
and Symposium participants have explicit next steps. Undated membership and
recording estimates have been replaced by public catalog counts labeled as
indexed resources, repositories, project guides and video sessions. On narrow
screens, the hero no longer reserves empty viewport height above those actions.
The tablet header also wraps its search and controls horizontally, avoiding a
608 px header that previously pushed content below the fold.

## Accessibility and font loading

The footer build stamp uses opaque theme-aware muted text, retaining its
secondary role without the former 0.55 opacity. Real-browser checks calculate
normal-text contrast after each theme transition settles.

Focused menus now keep ARIA state consistent with visible disclosure state.
Escape dismisses a focused menu and restores the disclosure button; focus
alone does not claim expansion. The focus-within CSS fallback is limited to
navigation without JavaScript.

Local fallback font metrics were derived from the shipped Inter Tight and
Fraunces font tables and the corresponding Arial/Times New Roman advances.
Site-only fallback faces leave the canonical design-system export untouched.
Three cold profiles per viewport, with 600 ms font-response delay, reproduced
a desktop layout shift around 0.093 (one 0.168 sample). Measured regular and
bold fallbacks reduced it to about 0.0011; mobile remained below 0.001. These
are controlled local font stress tests, not PageSpeed or field-performance
measurements. There is no claim that a production Lighthouse score or CrUX
population improved before deployment and observation.

## Build identity and deployment custody

`version.json` separates `source_fingerprint` (the institutional export) from
`website_source_fingerprint` (website source, authored assets and vendored demo bytes). The
latter changes for source/CSS changes even when the export is unchanged. The
checker independently recomputes it, including Unicode path ordering. Export
timestamps remain reproducible; no build clock is fabricated as page `lastmod`.

`data/public-html-files.json` records the generated HTML and retained demos.
[Public artifact staging](../scripts/stage_public_assets.py) accepts only that
inventory, public assets and explicit crawler/data outputs. It refuses stale
source identity, unsafe paths, symlinks, source-tree output locations and an
existing destination. Source, documentation, audit evidence and credentials
are not deployment artifacts.

The [manual Pages workflow](../.github/workflows/pages-manual.yml) is a prepared
owned-workflow option. It does not run on pushes. It builds and checks source,
requires unchanged committed output, stages a public artifact and writes
`deployment.json` containing the actual workflow commit/run and source
fingerprints. Adoption requires selecting Actions as the Pages source and
retiring concurrent branch publishing. It has not been dispatched here.
Managed-workflow runtime warnings are distinct from a deployment failure.

## Reproduce

```bash
npm run build
npm run check
CHROME_BIN=/path/to/chrome npm run check:browser
CHROME_BIN=/path/to/chrome WEBSITE_AUDIT_OUTPUT=/private/evidence npm run check:audit-browser
python3 scripts/stage_public_assets.py --output /new/public-artifact
```

The browser check verifies actual viewport dimensions, URL-tail redirects,
no-JS/script-failure behavior, themes, keyboard disclosure, resource and search
surfaces, RTL navigation, audio stop state and simulation controls. Preserve
its receipts and original failures. It is scoped acceptance, not a blanket
WCAG conformance or scientific-validation claim. Google validation/indexing
requests must follow verified deployment and target only repaired categories.
