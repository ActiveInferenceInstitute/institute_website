# `assets/` — Static Site Assets

Self-origin CSS, JavaScript, and images for the Active Inference Institute
website. The site enforces a **strict CSP**: no inline `<script>`/`<style>`, no
iframe/object/embed/form, and `connect-src 'none'` (no client-side `fetch`).
Therefore **every behavior ships as an external, same-origin file under
`assets/js/`** referenced conditionally from [`../src/render/layout.mjs`](../src/render/layout.mjs).
JS reads data from `localStorage`, the DOM, the CSSOM, browser-native APIs
(`speechSynthesis`), or build-baked `<script type="application/json">` blocks —
never the network.

These files are committed source. Edit them here, **never** in built
`*/index.html` output. After changing data-dependent assets, rebuild with
`node ../src/build.mjs` and run `npm run check` (gates: `check:design-system`,
`check:site`, `check:security`, …).

## `css/`

| File | Role |
| --- | --- |
| `instituteos-ds.css` | Canonical design-system token export. **Byte-pinned** and verified by `check:design-system` — do not hand-edit. Defines the token surface (`--ds-red`, `--ds-red-light`, `--ds-red-dark`, `--ds-primary`, `--ds-accent`, light-theme block keyed on `html.theme-light`, …). |
| `styles.css` | Site CSS (layout, components, nav, cards) built on the DS tokens. |
| `graphs.css` | Styling for the `graphs.js` node-link renderer (all graph styling lives here — the renderer emits no inline styles). |
| `fonts/` | Self-hosted web fonts. |

Re-tinting and theming flow through DS tokens, so `accent.js`/`theme.js` can
override on `<html>` without touching the pinned `instituteos-ds.css`.

## `js/`

All files are IIFE, `"use strict"`, no dependencies, no `fetch`.

| File | Role |
| --- | --- |
| `site.js` | Core page behavior: sticky-header scroll state, accessible nav-group dropdowns (`aria-expanded` synced to focus), back-to-top button (respects `prefers-reduced-motion`), and client-side filtering/sorting for resource cards, repositories, knowledge tables, and the calendar — all driven by `data-*` attributes baked into the HTML. |
| `theme.js` | Light/dark/system theme toggle via `localStorage` + `classList` on `<html>`. |
| `accent.js` | Highlight-color picker; overrides the three DS red tokens on `<html>` to re-tint the brand. |
| `tts.js` | Read-aloud using the Web Speech API (`window.speechSynthesis`); progressive enhancement — control stays hidden where unsupported. |
| `search.js` | Global inline search; reads `window.__SEARCH_INDEX__` and renders ranked results. |
| `search-page.js` | Dedicated `/search/` page renderer; reads the same index, shows the full result set, prefills from `?q=`. |
| `search-data.js` | **BUILD-GENERATED** by `../src/build.mjs`. Defines `window.__SEARCH_INDEX__`, `window.__SEARCH_PAGE_URL__`, and `window.__SEARCH_SYNONYMS__`. Do not hand-edit; regenerate via the build. |
| `graphs.js` | Deterministic (seeded) node-link graph renderer reading build-baked JSON `<script>` blocks. Contract must match `build.mjs` output (`.graph-mount[data-graph-source]` + `#graph-data-<NAME>`). |
| `redirects.js` | Legacy Squarespace-URL → clean-URL map. Loaded **only** on `404.html` (GitHub Pages serves it for unresolved paths). Reads `data-base` and calls `location.replace()`; no network. See [`../docs/MIGRATION_AND_REDIRECTS.md`](../docs/MIGRATION_AND_REDIRECTS.md). |

`search-data.js` is the only generated JS asset; the rest are authored source.

## `img/`

Site imagery: favicons and app icons (`favicon-32.png`, `icon-180.png`,
`icon-192.png`, `icon-512.png`, `icon.svg`), social cards
(`social-card.png`/`.svg`), `cards/` (per-page card art), and `instituteos/`
(brand/logo assets, light + dark variants).
