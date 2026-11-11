# `scripts/` — gates, sync, and i18n tooling

Validation, public-data sync, and offline translation for the Active Inference
Institute website. The build itself lives in [`../src/build.mjs`](../src/build.mjs);
these scripts check and maintain its source. Everything here is offline except
`check_live_sources.py` (`npm run check:sources`), which probes the network and is
deliberately outside `npm run check`.

The enforced contract and full command table for this folder are in
[`AGENTS.md`](AGENTS.md); this file is a short orientation only.

## What is inside

- **Link/contract gates (Python)** — [`check_internal_links.py`](check_internal_links.py),
  [`check_site_contract.py`](check_site_contract.py),
  [`check_static_security.py`](check_static_security.py),
  [`check_redirects.py`](check_redirects.py),
  [`check_indexability.py`](check_indexability.py),
  [`check_feeds.py`](check_feeds.py),
  [`check_project_discoverability.py`](check_project_discoverability.py),
  [`check_standalone_payloads.py`](check_standalone_payloads.py).
- **Markdown gate** — [`check_markdown_links.py`](check_markdown_links.py)
  (`npm run check:md-links`) resolves every relative link in tracked `*.md`,
  including the per-folder guides.
- **Node gates** — [`check_design_system_export.mjs`](check_design_system_export.mjs),
  [`check_project_catalog_coverage.mjs`](check_project_catalog_coverage.mjs),
  [`check_export_manifest.py`](check_export_manifest.py), and the `test_*.mjs`
  controls.
- **Networked** — [`check_live_sources.py`](check_live_sources.py)
  (`npm run check:sources` / `--offline`) verifies the external-link registry.
- **Sync** — [`sync_instituteos_public_data.py`](sync_instituteos_public_data.py),
  [`sync_video_transcripts.py`](sync_video_transcripts.py),
  [`generate_bibliography.py`](generate_bibliography.py).
- **i18n** — [`i18n_translate.mjs`](i18n_translate.mjs),
  [`i18n_check_terminology.mjs`](i18n_check_terminology.mjs).
- **Generators (not gates)** — [`generate-project-pages.mjs`](generate-project-pages.mjs),
  [`generate-cards.mjs`](generate-cards.mjs), [`generate-icons.sh`](generate-icons.sh).
- **Browser checks** — `check_*browser*.mjs` / `browser_*.mjs` need a real
  Chrome via `CHROME_BIN` and run outside `npm run check`.

## Run it

```bash
npm run check            # all 17 offline sub-gates (see ../docs/GATES_AND_VALIDATION.md)
npm run check:md-links   # just the relative-link gate over tracked Markdown
```

Gate reference with failure messages and fixes:
[`../docs/GATES_AND_VALIDATION.md`](../docs/GATES_AND_VALIDATION.md).
