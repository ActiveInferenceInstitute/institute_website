# `assets/` — self-origin CSS, JavaScript, and images

Static assets for the Active Inference Institute website. The site enforces a
strict CSP (`script-src 'self'`, `connect-src 'none'`, no inline script/style, no
iframes/forms), so every behavior ships as an external, same-origin file under
`js/` and reads data from `localStorage`, the DOM, the CSSOM, browser APIs, or
build-baked JSON — never the network.

These files are committed source. Edit them here, never in the generated
`*/index.html` output; after a data-dependent change, rebuild
(`node ../src/build.mjs`) and run `npm run check`.

The detailed file-by-file contract lives in [`AGENTS.md`](AGENTS.md); this file is
a short orientation only.

## What is inside

- [`css/`](css/) — [`styles.css`](css/styles.css) (site theme on the design-system
  tokens), [`instituteos-ds.css`](css/instituteos-ds.css) (byte-pinned token
  export — do not hand-edit), [`graphs.css`](css/graphs.css), and `fonts/`.
- [`js/`](js/) — authored behavior: [`site.js`](js/site.js), [`theme.js`](js/theme.js),
  [`accent.js`](js/accent.js), [`tts.js`](js/tts.js), [`search.js`](js/search.js),
  [`search-page.js`](js/search-page.js), [`video-table.js`](js/video-table.js),
  [`newsletter.js`](js/newsletter.js), [`graphs.js`](js/graphs.js).
  [`search-data.js`](js/search-data.js) and [`redirects.js`](js/redirects.js) are
  **build-generated** — edit their sources and rebuild.
- `img/` — favicons, app icons, social cards, and cover art.

## Run it

```bash
node ../src/build.mjs   # rebuild generated assets + HTML
npm run check           # includes check:design-system, check:site, check:security
```

Design-system contract: [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
