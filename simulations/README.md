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
  standalone files, **not** build output. Institute patches are documented below.

The confirmed canonical home is `https://activeinference.institute/` (October 26,
2026). Their heads carry exact-case HTTPS Institute canonicals, English language
and individual descriptions. These metadata additions preserve the original
provenance and simulation behavior. The indexability gate checks those fields;
the vendored scientific/UI implementation remains outside first-party CSP and
design-system contracts.

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

## Institute presentation patches

Seven demos carry a labeled, mobile-only CSS block to stack overlapping panels,
make controls reachable and keep tutorial canvases visible on small screens.
The original calculations, model scripts and desktop presentation are preserved.
These patches are website presentation maintenance, not scientific validation.
