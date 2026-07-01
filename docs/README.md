# Institute Website — Documentation

A curated, task-oriented guide to the Active Inference Institute website
(`repos/institute_website`): a **static, zero-dependency Node build** that renders
JSON content into clean-URL HTML for GitHub Pages, under a strict CSP + link +
public-safety contract.

This `docs/` folder is the **conceptual / navigation view**. The authoritative,
enforced contracts live in each folder's `AGENTS.md` — this set cross-references them
rather than duplicating them. `docs/` is **not** built into the published site.

## Start here

| If you want to… | Read |
| --- | --- |
| Get the site building locally | [GETTING_STARTED.md](GETTING_STARTED.md) |
| Understand how the build works | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Know how a page becomes a URL (**load-bearing**) | [SLUG_AND_URL_TAXONOMY.md](SLUG_AND_URL_TAXONOMY.md) |
| Add or edit a content page | [CONTENT_AUTHORING.md](CONTENT_AUTHORING.md) |
| Add or update a language | [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md) |
| Pass `npm run check` | [GATES_AND_VALIDATION.md](GATES_AND_VALIDATION.md) |
| Use the design system / tokens | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| Change a URL or legacy redirect | [MIGRATION_AND_REDIRECTS.md](MIGRATION_AND_REDIRECTS.md) |
| Look up a top-level registry schema (`site.json`, `live-sources.json`, …) | [REGISTRIES.md](REGISTRIES.md) |
| Fix a cryptic build/gate error | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Reorganize source folders vs. change a public URL | [SLUG_AND_URL_TAXONOMY.md § Two independent axes](SLUG_AND_URL_TAXONOMY.md#two-independent-axes-source-organization-vs-output-url) |

## The one rule that explains everything

> **The output URL is derived from a page's `slug`, never from its source file path.**
> Folder nesting under `src/content/pages/` is maintainer-facing only; the root-level
> output folders (`/about/`, `/de/`, `/active-inference/robotics/`) **are** the
> public URLs.

See [SLUG_AND_URL_TAXONOMY.md](SLUG_AND_URL_TAXONOMY.md) for the full mechanism. The
practical consequence: **regrouping source folders is free; changing output URLs is a
breaking change** that needs redirects (see
[MIGRATION_AND_REDIRECTS.md](MIGRATION_AND_REDIRECTS.md)).

## Authoritative per-folder contracts (`AGENTS.md`)

This conceptual set defers to the implementation contracts that live with the code:

- [`AGENTS.md`](../AGENTS.md) — root agent guide & deployment checklist
- [`src/AGENTS.md`](../src/AGENTS.md) — build entry, data load, URL taxonomy
- [`src/render/AGENTS.md`](../src/render/AGENTS.md) — HTML rendering modules
- [`src/lib/AGENTS.md`](../src/lib/AGENTS.md) — pure helpers
- [`src/content/AGENTS.md`](../src/content/AGENTS.md) — JSON registries
- [`src/content/pages/AGENTS.md`](../src/content/pages/AGENTS.md) — page content + schema
- [`src/pages/AGENTS.md`](../src/pages/AGENTS.md) — registry-derived page renderers (directory, resources, knowledge, ecosystem, calendar, search, simulations, sitemap)
- [`scripts/AGENTS.md`](../scripts/AGENTS.md) — gates, sync, i18n
- [`assets/AGENTS.md`](../assets/AGENTS.md) — CSS, JS, images, redirects

Canonical longform references at the repo root: [INDEX.md](../INDEX.md) (top-level
repo map), [README.md](../README.md), [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md),
[INTERNATIONALIZATION.md](../INTERNATIONALIZATION.md), [MIGRATION.md](../MIGRATION.md),
[SWITCHOVER.md](../SWITCHOVER.md), [GATING.md](../GATING.md) (public-projection
gating contract), [RELEASING.md](../RELEASING.md), [CONTRIBUTING.md](../CONTRIBUTING.md),
[CHANGELOG.md](../CHANGELOG.md), [TODO.md](../TODO.md). The
`.claude/skills/institute-website/` skill and its `Workflows/` are the step-by-step
task runbooks.

## Quick command reference

```bash
npm run build      # render JSON content -> HTML into the repo root
npm run check      # run all gates (links, site contract, security, design system, instituteos sync)
npm run i18n:translate   # update locale catalogs
```
