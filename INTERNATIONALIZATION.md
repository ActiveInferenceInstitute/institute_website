# Internationalization (i18n)

> Canonical authoritative reference. For the expanded conceptual guide and locale
> workflow see [`docs/INTERNATIONALIZATION.md`](docs/INTERNATIONALIZATION.md).

The site is fully multilingual. English is the canonical source; every other
language is **pre-rendered at build time** into its own URL subtree, with a
language switcher on every page.

- English: `https://…/institute_website/about/`
- Spanish: `https://…/institute_website/es/about/`
- Chinese: `https://…/institute_website/zh/about/`
- … one subtree per locale (`/<code>/…`).

## Why build-time, not a live translation widget

The site is a static, CSP-locked GitHub Pages app. Every page ships this policy:

```
default-src 'self'; script-src 'self'; connect-src 'none'
```

`connect-src 'none'` means **the browser may make no network requests at all**.
A Google-Translate-style widget, or any on-the-fly call to a translation API or
to a local model from the page, is therefore impossible without breaking the
security model (enforced by `scripts/check_static_security.py`).

Pre-rendering is also simply the better approach for a static site:

- Real per-language pages → proper SEO (`hreflang` alternates, `<html lang>`).
- Instant, works offline, no per-visitor API cost, no runtime dependency.
- Translations are committed JSON, reviewable in pull requests.
- The build stays pure, deterministic, and byte-stable (no model runs in it).

The only place a translation model runs is the **offline** script
`scripts/i18n_translate.mjs`, which you invoke deliberately — never the build.

## How it works

### 1. One locale-aware routing point

All URL routing flows through `urlDirForSlug()` in
[`src/url-taxonomy.mjs`](src/url-taxonomy.mjs). It prepends the active locale
prefix (`es/`, `zh/`, …) for non-default locales. Because the prefix is applied
to **both** the current page directory and every link target, the existing
relative-link math (`hrefForSlug`) stays correct within a locale automatically,
and asset paths (`relPrefix`) still reach the true site root. The build switches
the active locale once per pass; no per-renderer changes were needed.

Helpers: `localeDirForSlug` / `localeOutputPathForSlug` (a slug's dir/file under
a specific locale), `crossLocaleHref` (the language switcher's cross-locale
links), `stripLocalePrefix` (for code that infers page structure from the dir,
e.g. breadcrumbs).

### 2. The build loop

[`src/build.mjs`](src/build.mjs) renders every routed page once per locale,
writing English to the root and each other language under `/<code>/`.
Root-level singletons (sitemap, feeds, search index, `robots.txt`, `404.html`)
are emitted once. The `404.html` and the search index stay English (a flat
GitHub-Pages requirement / a single shared index).

### 3. The translate accessor `tr()`

[`src/i18n/index.mjs`](src/i18n/index.mjs) exposes `tr(englishString)`. Render
code wraps every user-visible English string in `tr()`. At build time `tr()`
returns the active-locale translation, or falls back to the English source if a
key is missing — so a partially-translated language never produces a broken
page. Component definitions (`sectionHeading`, `cardGrid`, `breadcrumb`,
`pageGuide`) translate their inputs centrally, so each wrapping covers all call
sites.

### 4. Translation catalogs

Per-locale catalogs live at `src/content/i18n/<code>.json` — a flat map of
`{ "English source string": "translation" }`. They are committed and
human-reviewable. `src/content/i18n/_strings.json` is the extracted list of all
translatable source strings (the work list for the translator).

### 5. Page chrome

[`src/render/layout.mjs`](src/render/layout.mjs) sets `<html lang dir>` per
locale, emits `<link rel="alternate" hreflang>` alternates (+ `x-default`),
renders a CSP-safe `<details>`-based language switcher in the header (pure
links, no JS), and adds a machine-translation provenance note on
machine-translated locales linking back to the English original.

## File map

| Path | Role |
| --- | --- |
| [`src/i18n/locales.json`](src/i18n/locales.json) | Locale registry: code, name, native name, `dir`, `machine` flag |
| [`src/i18n/index.mjs`](src/i18n/index.mjs) | `tr()`, active-locale context, catalog loading, extraction |
| [`src/content/i18n/<code>.json`](src/content/i18n/) | Committed translation catalogs |
| [`src/content/i18n/_strings.json`](src/content/i18n/) | Extracted English source strings (work list) |
| [`scripts/i18n_translate.mjs`](scripts/i18n_translate.mjs) | Offline translator (Ollama or hosted API) |
| [`src/url-taxonomy.mjs`](src/url-taxonomy.mjs) | Locale-aware routing (single point) |
| [`scripts/check_site_contract.py`](scripts/check_site_contract.py) | Locale-aware contract checker (reads `locales.json`) |

## Workflows

### Build all languages

```bash
npm run build          # renders every locale subtree from committed catalogs
```

The site builds and is usable at any time; untranslated keys fall back to
English.

### Re-extract after content or UI changes

Whenever you add or change visible text (new pages, new `tr()`-wrapped strings):

```bash
npm run i18n:extract   # rewrites src/content/i18n/_strings.json
```

### Translate (local Ollama — default)

```bash
# one language
npm run i18n:translate -- --locale es

# every non-default language in locales.json
npm run i18n:translate -- --all

# options
npm run i18n:translate -- --locale zh --model qwen2.5:3b   # pick a model
npm run i18n:translate -- --locale de --limit 50           # cap (testing)
npm run i18n:translate -- --locale fr --force              # re-translate all keys
```

The translator is **incremental and resumable**: it only translates keys missing
from the catalog (unless `--force`) and checkpoints every 25 strings, so a
crash or interrupt loses almost nothing. It is safe to run in the background.

Requirements: a running Ollama (`ollama serve`) with the model pulled.

```bash
ollama pull gemma3:4b     # default generalist
ollama pull qwen2.5:3b    # default for CJK (zh, ja, ko)
```

**Per-locale model defaults** live in `DEFAULT_MODEL_BY_LOCALE` in the script:
CJK locales use `qwen2.5:3b`; everything else uses `gemma3:4b`. For higher
quality, pull a larger multilingual model and pass `--model`:

```bash
ollama pull aya-expanse:8b
npm run i18n:translate -- --all --model aya-expanse:8b
```

`aya-expanse:8b` (Cohere's multilingual model) is the recommended quality tier
for a local run — it fixes mistranslations the 3–4B defaults make (e.g. CJK
"Institute" → "instructor"). To re-translate from scratch with it, add
`--force`:

```bash
ollama pull aya-expanse:8b
npm run i18n:translate -- --all --force --model aya-expanse:8b
```

### Why output stays clean (prompt design)

Verbose instruct models (aya included) tend to *answer* a short label instead of
translating it, or wrap output in markdown/quotes. The translator defends against
this in two layers, so any reasonable model produces usable catalogs:

1. **Delimiter-framed prompt** — each source string is sent wrapped in
   `«guillemets»` with an engine-style instruction to translate only the wrapped
   text. This stops short labels from being expanded into essays.
2. **Output sanitization** (`cleanTranslation`) — cuts at the first line break
   (every source string is single-line, verified), strips any echoed wrapping
   (guillemets, CJK brackets, smart/ASCII quotes, `**bold**`, stray `#`), and
   removes leaked `English:`/`<Language>:` labels. Internal punctuation (e.g.
   legitimate Spanish « » around a quoted title) is preserved.

Both layers apply to the Ollama and hosted-API backends identically.

### Translate (hosted API — for higher quality later)

The translator has a pluggable provider. Set `I18N_PROVIDER=openai` to use any
**OpenAI-compatible** `/chat/completions` endpoint (OpenAI, OpenRouter,
Together, Groq, a local vLLM, …). Same prompt and output cleanup as Ollama, so
catalog semantics are identical.

| Env var | Default | Meaning |
| --- | --- | --- |
| `I18N_PROVIDER` | `ollama` | `ollama` or `openai` |
| `I18N_API_BASE` | `https://api.openai.com/v1` | API base URL |
| `I18N_API_KEY` | — | API key (required for `openai`) |
| `I18N_API_MODEL` | `gpt-4o-mini` | model id |

```bash
# OpenAI
I18N_PROVIDER=openai I18N_API_KEY=sk-... I18N_API_MODEL=gpt-4o-mini \
  npm run i18n:translate -- --all

# OpenRouter (e.g. Claude)
I18N_PROVIDER=openai \
  I18N_API_BASE=https://openrouter.ai/api/v1 \
  I18N_API_KEY=$OPENROUTER_KEY \
  I18N_API_MODEL=anthropic/claude-3.5-sonnet \
  npm run i18n:translate -- --all
```

To add a non-OpenAI-shaped backend, implement one function next to
`openaiTranslate()` and add a branch in `translateString()` — that is the only
dispatch point.

### Add a new language

1. Add an entry to [`src/i18n/locales.json`](src/i18n/locales.json):

   ```json
   { "code": "nl", "name": "Dutch", "nativeName": "Nederlands", "dir": "ltr", "machine": true }
   ```

   - `code` — BCP-47 / URL prefix (and `<html lang>`).
   - `dir` — `ltr` or `rtl`.
   - `machine` — `true` shows the machine-translation notice; set `false` once a
     language is human-reviewed.

2. Translate and rebuild:

   ```bash
   npm run i18n:extract            # if strings changed
   npm run i18n:translate -- --locale nl
   npm run build
   ```

The contract checker reads `locales.json` directly, so new locales are handled
with no other changes.

## Writing translatable strings (for contributors)

When you add visible UI text in a renderer, wrap the **English source** in
`tr()` exactly once, at the point the final English text exists:

```js
import { tr } from "../i18n/index.mjs";
`<h2>${escapeHtml(tr("Open Source Map"))}</h2>`
```

Rules:

- Wrap each visible string once. Helpers `sectionHeading`/`cardGrid`/
  `breadcrumb`/`pageGuide` already translate their inputs — pass them raw
  English.
- Do **not** translate DOM ids, anchors, URLs, slugs, or class names. Anchors
  derive from the English heading (`slugifyAnchor`) so they stay stable across
  locales.
- For interpolated counts, keep a placeholder so the sentence translates as a
  whole: `tr("View all {n} public repositories").replace("{n}", count)`.
- Proper nouns ("Active Inference", "InstituteOS", …) are preserved by the
  translator's `KEEP_VERBATIM` list.

After adding strings, run `npm run i18n:extract` and re-translate.

## Right-to-left (RTL)

A locale with `"dir": "rtl"` (e.g. Arabic) renders `<html lang dir="rtl">`, and
the machine-translation notice uses logical CSS properties so its accent border
mirrors correctly. Full visual RTL polish of every component is a follow-up; the
direction and content are correct, layout mirroring is best-effort.

## Limitations & notes

- **Machine-translated** locales are flagged on-page with a link to the English
  original. Set `"machine": false` per locale after human review.
- **Search** uses a single English index (shared `search-data.js`). Localized
  search is a future enhancement.
- **Coverage** is highest on the home page, curated content pages, and global
  chrome (nav, footer, buttons, breadcrumbs). Some specialized pages
  (directory, knowledge, resources tables) still contain English strings not yet
  wrapped in `tr()`; they fall back gracefully and can be wrapped incrementally.
- The build, the static-security gate, the internal-link gate, and the site
  contract gate all pass with the full multilingual output (`npm run check`).
