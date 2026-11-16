# Website roadmap & coordination

Open work reviewed against `main` at `ae74478729` on 2026-11-15.
See [CHANGELOG.md](CHANGELOG.md) for shipped work and [the previous
roadmap](https://github.com/ActiveInferenceInstitute/institute_website/blob/ae74478729ee9f61695002e09b29f20a53a5c0d6/TODO.md)
for the dated review history. Run local checks using [the run guide](docs/RUN_GUIDE.md).

## Major

- [ ] **Complete the indexing and forwarding follow-up.** Establish current
  coverage for the legacy 404 cohort and validate the sitemap in Search Console.
  All 50 supplied historical examples now reach their expected redirect
  stubs. The larger 163-URL cohort still needs current property evidence.
  The site owner supplies Search Console readback. The domain administrator
  reviews alias-domain HTTP forwards and robots-blocked external destinations.
  Accept when the priority cohorts have verified status, canonical targets and
  an owner disposition for unresolved URLs. Observe live redirects and crawl
  results before changing routes or resubmitting the sitemap.
  See [indexing follow-up](docs/INDEXING_FOLLOWUP.md) and
  [migration and redirects](docs/MIGRATION_AND_REDIRECTS.md).

## Medium

- [ ] **Repair existing translations.** Re-extract the current source keys,
  use the locale audit's 38 missing keys per locale, and review multiline
  paragraph preservation, numeric labels and accent-swatch accessibility
  names in all 11 catalogs. Review proposed changes
  with source and locale evidence. Inventory obsolete keys (including
  `Repositories (52)`) before any pruning. Accept with catalog checks and
  rendered desktop/mobile language controls. See
  [internationalization](INTERNATIONALIZATION.md).
- [ ] **Reconcile release metadata after maintainer approval.** Identify the
  exact source for the missing historical tags and the next version. The
  historical 4.0.1 candidate has inconsistent package and lock versions.
  The live 4.0.4 release at `ae74478729` has consistent version metadata. Review
  the annotated tags, GitHub release records, package/lockfile versions,
  `version.json` and `CITATION.cff` together. Accept when each new tag
  resolves to its qualified commit and the live version matches the release.
  See [RELEASING.md](RELEASING.md).
- [ ] **Resolve upstream public-content gaps.** Obtain approved destinations
  for archived dead hosts and former document hubs, replace the concluded Symposium's
  presenter call with an approved recap or next-cycle interest link and
  confirm sponsorship copy, repair or rephrase the two newsletter “here” calls to
  action (August and November 2025), and register eligible communications
  through the source owner. Accept with reviewed public copy, sanctioned
  export, passing link and feed checks, and no draft material in output.
  Owner: communications and source owners. See
  [content authoring](docs/CONTENT_AUTHORING.md) and [GATING.md](GATING.md).

## Minor

- [ ] **Remove remaining reference drift during the next related docs edit.**
  Check the root docs map against [docs/README.md](docs/README.md) when adding a
  root guide. Use [the run guide](docs/RUN_GUIDE.md) for the runtime matrix.
  Accept with `./run.sh docs`.
- [ ] **Document the forwarding evidence consistently.** At the next
  [redirect guide](docs/MIGRATION_AND_REDIRECTS.md) revision, review whether
  the historical resolved workspace URL is still needed in the explanation.
  Keep the verified chain understandable and the rendered site free of the URL.
- [ ] **Review duplicated external-anchor validation when the policy changes.**
  Share only the behavior that is meant to be common between
  [site validation](scripts/check_site_contract.py) and
  [security validation](scripts/check_static_security.py). Accept with the
  existing negative controls and the same independent gate coverage.

## Deferred

- **Per-page sitemap `lastmod`.** Wait for independent per-page source
  provenance. Require stable bytes across two builds and a test that a change
  to one page updates only its date.
- **README and AGENTS overlap.** Revisit alongside a shared contract change.
  Keep the human overview and operator instructions consistent.
