# Design system

The site's visual language is driven by a small token contract so the brand
stays consistent and a single source of truth controls colour, type, spacing,
and motion. This document explains how the CSS is layered, what the fallback
contract is, how theming works, and what `npm run check:design-system` enforces.

## CSS layering

Pages link two stylesheets, in this order:

1. **`assets/css/instituteos-ds.css`** — the **generated** design-system token
   export. It defines the canonical `--ds-*` custom properties (brand red,
   surfaces, text, type scale, spacing, radius, shadow, motion) for both the
   default dark theme and the light theme. **Do not hand-edit this file** — it is
   produced by the upstream design system and committed here so GitHub Pages can
   serve it statically. Regenerate it with `npm run check:design-system` guidance
   rather than editing it in place.
2. **`assets/css/styles.css`** — the **site layer**. It consumes the `--ds-*`
   tokens and adds the page-specific layout and components. This is the file to
   edit for site styling.

`assets/css/graphs.css` is an additional, self-contained stylesheet for the
graph/visualization views.

## The token fallback contract

`styles.css` maps the design-system tokens onto short local aliases, each with a
fallback:

```css
:root {
  --ink:     var(--ds-text, #e5e5e5);
  --paper:   var(--ds-bg, #0a0a0a);
  --surface: var(--ds-surface, #151515);
  --red:     var(--ds-red, #dc2626);
  /* … */
}
```

The fallback (the second argument) is used **only if `instituteos-ds.css` ever
fails to load**. To keep the brand intact in that degraded state, **every
fallback must equal the canonical _dark-theme_ value of the matching `--ds-*`
token**. This invariant is enforced automatically (see below), so the fallbacks
can never silently drift from the source of truth.

When you add a new `var(--ds-x, <fallback>)` reference in `styles.css`, set the
fallback to the token's canonical dark value, or omit the fallback entirely.

## Theming

The site ships a complete light theme in addition to the default dark theme.
`assets/js/theme.js` (a CSP-safe, self-hosted script — no inline handlers, no
fetch) toggles the `theme-light` class on `<html>` and persists the choice in
`localStorage`. `instituteos-ds.css` ships a full light-token block keyed on
`html.theme-light`, so toggling that class re-themes the whole site.

Because the local aliases resolve through the `--ds-*` tokens, **components
inherit theming for free** — as long as a component's text colour and its
background both come from tokens (or token-derived aliases), it stays readable in
both themes. Avoid hardcoded colours: a hardcoded near-black background paired
with token-driven (`--ink`) text renders as dark-on-dark in light mode. Use
`--paper`/`--surface`/`--surface-strong` for backgrounds and `--ink`/`--muted`
for text. White-on-accent surfaces (buttons, the home hero) use
`var(--ds-on-accent)`, which is intentionally white in both themes.

## What the gate enforces

`npm run check:design-system` (`scripts/check_design_system_export.mjs`, part of
`npm run check`) verifies:

- `assets/css/instituteos-ds.css` is **byte-identical** to a fresh export of the
  upstream tokens — i.e. the committed token export is not stale.
- The bundled web fonts under `assets/css/fonts/` match the export.
- Every `var(--ds-*, <fallback>)` fallback in `styles.css` matches the canonical
  token value. A mismatch fails the build with the exact token and both values.

The first two (freshness) checks require the upstream design-system source. In a
**standalone checkout** where that source isn't present (for example this repo's
own CI), the script skips the freshness comparison with a `NOTE` and still runs
the fully self-contained fallback check against the committed `instituteos-ds.css`
— so the brand-consistency invariant is enforced everywhere, while freshness is
enforced wherever the source is available (set `INSTITUTEOS_DS_ROOT` to point at
it explicitly).

If the check reports a stale export, regenerate `instituteos-ds.css` from the
upstream design system and re-run the gate. If it reports a fallback mismatch,
update the offending `:root` fallback in `styles.css` to the canonical value.

## See also

- [`README.md`](README.md) — build model, content sources, and release gates.
- [`AGENTS.md`](AGENTS.md) — the operating contract and design requirements.
