# Add or Update a Language

Add a new language (or refresh an existing one) for the static site. Translations
are **committed JSON** rendered into per-locale URL subtrees (`/<code>/…`) at
build time. The build never calls a model — `node src/build.mjs` only reads the
committed catalogs, so it stays pure, deterministic, and byte-stable. A model
runs only when you deliberately invoke the offline translator.

See [`../../../../INTERNATIONALIZATION.md`](../../../../INTERNATIONALIZATION.md)
for the full design rationale.

## 1. Register the locale

Add an entry to [`src/i18n/locales.json`](../../../../src/i18n/locales.json)
under `locales`:

```json
{ "code": "nl", "name": "Dutch", "nativeName": "Nederlands", "dir": "ltr", "machine": true }
```

| Field | Meaning |
| --- | --- |
| `code` | BCP-47 / URL prefix and `<html lang>` (e.g. `nl` → `/nl/…`). |
| `name` | English name; also the language the translator prompts toward. |
| `nativeName` | Shown in the language switcher. |
| `dir` | `ltr` or `rtl` (`rtl` sets `<html dir="rtl">`). |
| `machine` | `true` shows the machine-translation provenance notice. Set `false` after human review. |

`en` is `defaultLocale` and renders to the repo root; every other locale renders
under `/<code>/`. The site contract checker reads `locales.json` directly, so no
other registration is needed.

## 2. Extract source strings (if UI/content changed)

```bash
npm run i18n:extract   # rewrites src/content/i18n/_strings.json
```

This runs the build with `I18N_EXTRACT=1`, recording every `tr()` source string
into `src/content/i18n/_strings.json` — the translator's work list. Skip it if no
visible text changed since the last extract.

## 3. Run the offline translator

The translator ([`scripts/i18n_translate.mjs`](../../../../scripts/i18n_translate.mjs))
reads `_strings.json` and writes per-locale catalogs at
`src/content/i18n/<code>.json`. It is **incremental and resumable**: only keys
missing from the catalog are translated (unless `--force`), and it checkpoints
every 25 strings.

```bash
npm run i18n:translate -- --locale nl      # one locale
npm run i18n:translate -- --all            # every non-default locale
npm run i18n:translate -- --locale zh --model qwen2.5:3b
npm run i18n:translate -- --locale de --limit 50    # cap, for testing
npm run i18n:translate -- --locale fr --force       # re-translate every key
```

### Ollama (default)

`I18N_PROVIDER` defaults to `ollama` — a local model, free, no API key. Requires
a running `ollama serve` with the model pulled. Per-locale defaults live in
`DEFAULT_MODEL_BY_LOCALE`: CJK locales (`zh`, `ja`, `ko`) use `qwen2.5:3b`,
everything else uses `gemma3:4b`. Pull a larger multilingual model and pass
`--model` for higher quality.

### Hosted OpenAI-compatible API

Set `I18N_PROVIDER=openai` to use any OpenAI-compatible `/chat/completions`
endpoint. Same prompt and output cleanup, so catalog semantics are identical.

```bash
I18N_PROVIDER=openai I18N_API_KEY=sk-... I18N_API_MODEL=gpt-4o-mini \
  npm run i18n:translate -- --all
```

Env vars: `I18N_API_BASE` (default `https://api.openai.com/v1`), `I18N_API_KEY`,
`I18N_API_MODEL` (default `gpt-4o-mini`). Brand terms in `KEEP_VERBATIM` (e.g.
"Active Inference", "InstituteOS") and `{n}`-style placeholders survive
translation.

## 4. Build and verify

```bash
npm run build      # renders every locale subtree from committed catalogs
npm run check      # check:links, check:instituteos, check:design-system, check:site, check:security
```

The site builds at any time — missing keys fall back to English via
[`tr()`](../../../../src/i18n/index.mjs), so a partial language never produces a
broken page. `hreflang` alternates (+ `x-default`), `<html lang dir>`, the
CSP-safe `<details>` language switcher, and the machine-translation provenance
note (for `machine: true` locales) are all emitted automatically by
`src/render/layout.mjs`.

## Writing translatable strings

When you add visible UI text in a renderer, wrap the **English source** in `tr()`
once, at the point the final English string exists:

```js
import { tr } from "../i18n/index.mjs";
`<h2>${escapeHtml(tr("Open Source Map"))}</h2>`
```

- Wrap each visible string once. Helpers `sectionHeading` / `cardGrid` /
  `breadcrumb` / `pageGuide` already translate their inputs — pass raw English.
- Never `tr()` DOM ids, anchors, URLs, slugs, or class names. Anchors derive from
  the English heading so they stay stable across locales.
- Keep a placeholder for interpolated counts so the sentence translates whole:
  `tr("View all {n} public repositories").replace("{n}", count)`.

After adding strings, re-run `npm run i18n:extract` and re-translate.
