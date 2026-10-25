# Indexing repair and browser-agent handoff — 2026-10-25

The source changes are prepared for review, not deployed. Search Console work
was explicitly deferred to a browser agent because the available profile could
not access the domain property. No indexing validation or indexing request was
submitted. Google recrawl and indexing outcomes remain pending.

## Reproduced and repaired

The website is a static Node build, published from committed root HTML on
GitHub Pages. Its canonical origin is `https://activeinference.institute/`.
The domain registrar's public subdomain forwards are a separate system.

- URL normalization produced `/ru/es/about/` from an explicitly Spanish URL
  and prefixed shared files with the current locale. Normalization now preserves
  explicit locales and shared files, localizes known page routes, and resolves
  known legacy aliases directly to their current page.
- Legacy participation aliases were built only in English. The generator now
  expands the existing reviewed mapping across published locales. Redirect stubs
  increase from 450 to 780; the 330 additions have real localized destinations.
- The 404 fallback invented destinations for unknown `active-inference-and-*`
  names. Recovery now uses only the generated finite mapping and retains query
  strings and fragments. Unknown paths retain their honest 404 behavior.
- English newsletter/video bodies inside localized navigation now explicitly
  declare `lang="en" dir="ltr"`. They retain English canonicals and no hreflang.
  Translated pages retain their own language, canonical and reciprocal alternates.
- The translated newsletter **collection** was accidentally excluded from XML
  sitemap alternates by the detail-page prefix test. Its 11 locale alternatives
  are now included. Untranslated individual issues remain consolidated.
- The global data-export timestamp was presented as every page's `lastmod`.
  The sitemap now omits this optional field until per-page modification evidence
  exists. Date validation still rejects duplicate and invalid dates if supplied.

The new `check:indexability` gate checks all built HTML policies, canonical
targets, robots rules, noindex, hreflang reciprocity and language, sitemap
membership including alternates, filename case, and recognizable error shells.
Negative controls use real files; the live probe tests use a real local HTTP
server and curl, including a redirect loop and `X-Robots-Tag` capture.

## HTTP redirect boundary

Pages cannot execute configurable HTTP path redirects. Its generated legacy
stubs are HTTP 200 HTML redirects, not 301/308. This limitation is not represented
as a completed server-side repair.

[`src/http-redirects.mjs`](../src/http-redirects.mjs) supplies a tested,
Fetch-compatible HTTP 308 handler for integration ahead of Pages. Construct it
with the generated [`data/redirects.json`](../data/redirects.json) and the
canonical origin. Invoke the resulting function with the incoming `Request`;
serve the existing origin when it returns `null`. It resolves known legacy paths
before host/scheme normalization, preserves queries, rejects unsafe maps and
chains, and leaves independent subdomain shortlinks and non-GET/HEAD requests
to their existing owners. Tests cover all 780 mappings across both schemes,
apex/www and GET/HEAD, and ensure each destination terminates after one hop.

No edge provider, DNS, proxy, Pages setting, or registrar rule has been changed.
An operator must choose and bind an HTTP-capable deployment boundary before this
handler can supply production 308 responses. Keep all other subdomains outside
that binding. Do not add a catch-all redirect to the homepage.

## Measurements

Raw HTTP GETs ran on 2026-10-25 with six concurrent curl workers, an 8 s connect
limit, 20 s per-request limit, five maximum HTTP redirects and no retries. HTML
refreshes were recorded separately from HTTP hops. No forms or payments were
submitted. These measurements are point-in-time observations.

| Scope | Observation |
| --- | --- |
| Handoff's 50 explicit historical 404 examples | All now reach HTTP 200 HTML redirect stubs. This does not reconcile the full 163 examples or prove Google's current classification. |
| Published XML sitemap union of loc + language alternates | 2,527 distinct URLs; all HTTP 200, self-canonical, no robots meta exclusion, no X-Robots-Tag and no redirect stub in the captured final responses. |
| Complete initial HTTP audit | 2,602 URLs. Nine non-successes comprise four intentional unknown-path 404 controls, four host/scheme variants of the missing localized `/ru/internship/` alias, and one exploratory unregistered `internship` subdomain DNS failure. The registered shortlink is `intern`, not `internship`. |
| Registered shortlinks and principal journey destinations | Follow-up set of 48 distinct requests, including all 33 registry forwards and selected external actions: no HTTP/DNS failures. This proves response availability, not form usability or conversion. Donation forwarding reaches PayPal. |
| Built output | 11,605 HTML URLs: 2,538 public canonical pages; 8,250 untranslated archive duplicates; 780 HTML redirects; 24 excluded utility pages; 12 shared simulations; one error page. |
| Built sitemap | 899 loc entries; after repair, 2,538 unique loc/alternate destinations. Utility pages, redirects and localized untranslated archive duplicates remain excluded. |
| Built semantics | One h1 on every first-party generated page; no images without alt attributes in the parsed HTML. The 12 vendored simulations lack meta descriptions; retained as a documented metadata exception. Attribute presence is not an accessibility quality judgment. |
| Browser runtime | Calendar filters/counts pass in all 12 locales; the original injected ReferenceError is rejected by the negative control. |
| Export boundary | 52 focused application export-contract/guard tests pass. No private source or registry changes are needed for this repair. |
| Design system | Export matches the available source when checked with its explicit source binding; token checks pass. |
| Source-bound export freshness | FAIL on both untouched website main and this branch: `stale src/content/instituteos/sab_cohorts.json`. The file is byte-identical to main and was not regenerated into this SEO change. This pre-existing source/export reconciliation remains a separate release gate. |

The initial live audit intentionally exits nonzero for its nine recorded
non-successes. Its raw failures are retained, not swallowed. The initial probe
of an unregistered subdomain is exploratory evidence, not a new broken-shortlink
claim. The second set uses the actual forward registry.
The maintained seed file now uses the registered `intern` shortlink and labels
unknown-route controls with expected HTTP 404. The audit still retains every raw
non-success, but exits nonzero only for unexpected status or transport results.

## Explicit indexability matrix

| Template | Intended policy | Discovery |
| --- | --- | --- |
| English content and genuine translated content | Crawlable, self-canonical, indexable | XML loc or reciprocal alternates; internal navigation |
| Localized archive with English body | Crawlable; canonical to matching English archive; English body language | Internal navigation; no hreflang or XML alternate advertisement |
| Search and human sitemap, all locales | Crawlable noindex, retained utility | Internal navigation; excluded from XML sitemap/hreflang |
| Legacy alias | HTML redirect + noindex until an HTTP boundary is bound | Not in XML sitemap; internal links use final targets |
| Root simulation files | Shared English asset, original case preserved | Localized collections link to root files |
| Unknown path / error page | Honest HTTP 404 at the origin | No sitemap advertisement; no invented destination |

The generated CSV inventories provide a disposition for every built HTML URL.
They explicitly label HTTP and Google-selected canonical fields untested or
unavailable when the evidence is only on disk. Private content still requires
access control; public SEO settings are not a confidentiality mechanism.

## Historical GSC categories and remaining dispositions

The handoff records the report dated **2026-10-15**, inspected **2026-10-25**,
with **All known pages** selected. The nine nonzero excluded categories total
582. The eight indexed-but-blocked URLs belong to the indexed population.
None of these historical counts is presented as freshly exported data.

| ID | Historical count | Disposition pending browser evidence |
| --- | ---: | --- |
| IDX-01 404 | 163 | Reconcile the complete export. All 50 supplied examples currently serve stubs; additional locale aliases are repaired locally. Retain intentional removals individually. |
| IDX-02 indexed but robots-blocked | 8 | Export and inspect every URL and template; resolve conflicting intent. Current public robots.txt permits crawling, but that does not identify the eight URLs. |
| IDX-03 robots-blocked exclusions | 6 | Export each URL; retain legitimate exclusions or repair accidental blocks. |
| IDX-04 noindex | 42 | Compare each export row with the template matrix. The 24 utility pages and redirect stubs are deliberately noindex; do not assume they account for these 42. |
| IDX-05 duplicate without chosen canonical | 6 | Inspect exact competing URLs and Google-selected canonical; compare with live captures. |
| IDX-06 Google chose another canonical | 6 | Same per-URL inspection; no blanket canonical rewrite. |
| IDX-07 crawled, not indexed | 41 | Review content/rendering and discovery per URL, then diagnose or monitor. Eligibility does not guarantee indexing. |
| IDX-08 discovered, not indexed | 26 | Compare exported URLs with current sitemap, internal references and live fetch evidence. |
| IDX-09 proper canonical alternate | 254 | Usually retain consolidation; inspect examples and destinations before changing policy. |
| IDX-10 redirect exclusions | 38 | Usually retain useful redirects; remove stale discovery references where found. Distinguish HTTP and HTML redirects. |
| IDX-11 server errors | 0 | Historical baseline; not a continuous availability claim. |

## Reproduce and retain evidence

Run the build, `npm run check`, `npm run check:browser` with `CHROME_BIN` set,
and the explicit source-bound design-system check before handoff. The full
offline suite includes the new gate and adversarial tests.

To capture the generated URL inventory without network access:

```bash
python3 scripts/check_indexability.py --inventory "$AUDIT_DIR/generated.csv" --summary "$AUDIT_DIR/generated.json"
```

To collect fresh public HTTP evidence (the output directory must not exist):

```bash
python3 scripts/audit_live_urls.py --include-sitemap --output-dir "$AUDIT_DIR/live"
```

The supplied seed file labels historical examples separately from developer
controls. A browser agent can import a GSC CSV without pretending the examples
are exhaustive:

```bash
python3 scripts/audit_live_urls.py --gsc-csv "$GSC_CSV" --gsc-reason "Not found (404)" --report-date 2026-10-15 --expected-count 163 --output-dir "$AUDIT_DIR/gsc-404"
```

Use the **actual** export report date and category total. The receipt records
the row count and difference from the category count, raw headers and bodies,
HTTP hops, canonical/robots/hreflang metadata and transport errors. Do not
publish authenticated Google exports or operational records into this public
repository. Keep before/after generated CSVs, HTTP captures and command logs
with the review evidence, outside published output.

## Browser-agent work, explicitly not completed here

1. Export every indexing issue's URL examples and the eight indexed warnings.
   Preserve dates/filter, reconcile examples against each report count, and join
   with the generated/live inventories. Inspect Google-selected canonical where
   available. Do not infer missing URL identities from aggregate counts.
2. Inspect GSC Sitemaps/fetch status, mobile and desktop Core Web Vitals, HTTPS,
   video indexing, Breadcrumbs/Video enhancements, manual actions, security,
   removals and crawl statistics. Record report date/counts or insufficient data.
3. Test newcomer, learner, researcher, contribution, internship/fellowship,
   donation and current symposium journeys in the browser without submissions.
   HTTP checks here do not establish external form usability or current deadlines.
4. Test menu/search/directories/language/theme/audio, keyboard and visible focus,
   labels/contrast, zoom/reflow/mobile, reduced motion, and all simulations.
   The calendar runtime test and a homepage quick-search/theme interaction are
   scoped evidence, not a full accessibility or visitor-journey acceptance.
5. Run reproducible Lighthouse/PageSpeed with version, device/network settings,
   cache state and repeated-run method; compare field data if available. No
   Lighthouse score or field-performance claim was produced by this work.
6. Review homepage technical export terminology and metrics editorially. The
   linked `activeinference.org` site is presented as a learning/simulation surface;
   its exact editorial relationship remains a content-owner decision. No
   cross-domain canonical defect was established.

## Rollout and rollback

Review source and generated HTML together. Keep this change separate from the
existing research/export PR. Merging to `main` is a production action because
Pages publishes committed root output; this handoff does not authorize it.
Resolve the separately reproduced SAB-cohort source/export drift before claiming
source-bound release readiness; the standalone public safety gate is not proof
of freshness against the available private source.

After an authorized merge/deployment, recheck important aliases, exact simulation
filenames, unknown-path controls, both schemes/hosts, and the sitemap. If an
HTTP boundary is separately authorized, bind and test the 308 handler against
the same mapping and verify that existing public subdomain forwards still work.

Rollback by reverting the reviewed repair commit through a PR, rebuilding,
running the gates and publishing only with release authority. For an optional
edge integration, remove its new binding to restore the unchanged Pages origin;
do not alter registrar shortlinks as part of that rollback.

Only after production evidence shows genuine repairs should the browser agent
start relevant GSC validations or selectively request indexing of important
canonical pages. Record dates and follow recrawls. Local green, HTTP 200 and
validation-started are not claims of Google indexing success.
