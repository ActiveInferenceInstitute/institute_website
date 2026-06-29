# `simulations/` — vendored interactive demos

Browser-based simulations of Active Inference and the Free Energy Principle,
linked from the `/simulations/` index page.

## Provenance & contract

- **`index.html`** is **generated** by [`../src/pages/simulations.mjs`](../src/pages/simulations.mjs)
  (emitted programmatically like the search/directory/sitemap pages — it is *not*
  a curated `src/content/pages/*.json` page). Regenerate via `node src/build.mjs`;
  do not hand-edit it.
- **`<name>.html`** (e.g. `ant_colony.html`, `fep_tutorial.html`, `Ink.html`) are
  **vendored third-party demos**, mirrored from `activeinference.org`. They are
  standalone files, **not** build output, and are committed as-is.

This directory is **intentionally excluded** from the first-party
site/security/link contracts (`scripts/check_*.py`) because the vendored demos do
not follow the site's CSP/token/slug rules. Index card links point to literal
filenames on purpose — routing `Ink.html` through the clean-URL resolver would
mis-parse the filename as a slug.

## To add or update a simulation

1. Drop the standalone demo HTML into this folder.
2. Add it to the list/cards in `src/pages/simulations.mjs`.
3. `node src/build.mjs` to regenerate `/simulations/index.html`.
4. Keep the demo self-contained — it is not held to the first-party gates, but it
   still ships publicly, so it must contain no private content.
