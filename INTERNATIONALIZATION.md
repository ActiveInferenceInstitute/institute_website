# Internationalization (i18n)

> **Canonical guide:** [`docs/INTERNATIONALIZATION.md`](docs/INTERNATIONALIZATION.md)
> (the full conceptual + operational reference — locale registry, `tr()`, build
> loop, translate-CLI runbook, add-a-locale steps, RTL). This root file is a short
> orientation stub.

The site is fully multilingual. English is the canonical source; every other
language is **pre-rendered at build time** into its own URL subtree (`/<code>/…`),
with a CSP-safe language switcher on every page. Untranslated keys fall back to
English, so the site is always buildable and usable.

## Why build-time, not a live translation widget

Every page ships a strict CSP — `default-src 'self'; script-src 'self'; connect-src 'none'` —
enforced by `scripts/check_static_security.py`. `connect-src 'none'` forbids any
client-side network request, so a Google-Translate-style widget is impossible by
design. Pre-rendering also gives real per-language pages (proper `hreflang` / `<html lang>`
SEO), works offline, costs nothing per visitor, and keeps the build pure and
deterministic. The only place a translation model runs is the **offline** script
`scripts/i18n_translate.mjs`, invoked deliberately — never the build.

## Quick commands

```bash
npm run build                       # render every locale subtree from committed catalogs
npm run i18n:extract                # re-extract source strings after UI/content changes
npm run i18n:translate -- --locale es   # translate one locale (Ollama default)
npm run i18n:translate -- --all         # translate every non-default locale
```

Full options (hosted-API providers, per-locale model defaults, add-a-locale,
writing translatable strings, RTL): see
[`docs/INTERNATIONALIZATION.md`](docs/INTERNATIONALIZATION.md).
