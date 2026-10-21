# Public Projection Contract

This website publishes curated public resources and sanitized InstituteOS
projections. It is a visitor-facing resource hub. Canonical sources and the
sanitizing producers determine what may cross into this public repository.

## Public boundary

Exclude nonpublic rosters, contact details, stewardship records, operational
fields, task mechanics, working documents, drafts, input artifacts, generated
traces, demos, recordings and internal screenshots. Publicly named people and
governance bodies may appear; private workflow descriptions may not.

Render registered Institute shortlinks rather than resolved Coda destinations.
Redirect targets are transient network evidence and must never be committed as
`finalUrl`. Public prose may be informed by private research, but raw research
reports, provider responses and working references remain outside the export.

The governance glossary is withheld. A reviewed editorial decision is required
before selecting any of its terms for a new public projection.

## Producers and ownership

- `scripts/sync_instituteos_public_data.py` projects field-allowlisted registry
  slices and brand assets. Its `REQUIRED_PUBLIC_JSON_FILES` declaration owns the
  sync inventory.
- The guarded InstituteOS CLI prepares SDK graph, narrative, newsletter, program,
  citation, calendar, video, project and domain-page projections. Its
  `data/export-manifest.json` owns the export inventory.

Each public file has one producer. Unknown slices and overlapping ownership
fail validation. Edit canonical sources or generators, then regenerate;
`src/content/instituteos/*.json` is generated data.

An approved `previousUrls` entry may replace a historical roster URL with its
current registered destination. Both URLs must pass the source URL rules, the
destination must have `ok: true`, and ambiguous replacements fail before probing
or writing. Public slices contain the current destination; historical source
records remain unchanged.

Source selection is explicit CLI selection, then `INSTITUTEOS_ROOT`, then the
nearest ancestor containing `library/registries`, then the supported sibling
checkout. Invalid explicit selections fail. Automatic discovery without a
source permits standalone validation of committed payloads, which establishes
consistency and safety but cannot establish upstream freshness.

## Data and manifest gates

`npm run check:instituteos` validates both producers in every layout. With a
source checkout it also compares regenerated registry bytes. Export validation
runs before sync writes.

The manifest accepts its closed versioned envelope and entry fields. Target
paths must be unique, normalized, flat, regular files without symlinks. Required
slices, the project catalog, domain pages and newsletter images must be covered.
Hashes, record counts and the aggregate fingerprint must match exact bytes.
The fingerprint is the first 12 hexadecimal digits of SHA-256 over the
newline-joined sorted artifact hashes.

Newsletter assets permit PNG, WebP, JPEG and GIF with matching raster signatures.
SVG, disguised images, nested files and unsupported output types fail. The
maintained public-data README is the non-JSON content-directory exception.

Field allowlists are the primary privacy boundary. Strict registry checks and
prose checks also reject private keys, email addresses, phone-like content,
Coda destinations and local paths. Key matching covers camel-case, delimiters
and contact/address aliases. The prose gate permits public platform labels and
the common word “workspace”; newsletter prose permits numeric public Authorea
profile URLs while continuing to reject unrelated local paths. Formatted phone
numbers and explicit phone/tel contexts are blocked; unlabeled numeric
identifiers are not classified as phone numbers solely by length.
Denylist matching cannot infer the meaning of arbitrary innocuously named prose.

## Research identity and links

Citation metadata comes from the canonical bibliography. Paper links reference
registered, reachable sources. DOI labels link only to the exact DOI resolver
URL. A registered alternative paper landing page needs an explicit matching DOI
and a source ID bound to that citation; it links the title while the DOI remains
plain text. General journals and paper collections cannot stand in for an
individual DOI. Unavailable work links are visibly labeled.

The application exporter rejects unresolved or duplicate citation identities
before projection. Archived research references are candidate sources for
editorial reconciliation, not automatic publication authority.

`npm run check:sources:offline` validates every registered source's shape and
URL without network access. `npm run check:sources` independently probes live
HTTP, bounded redirects and HTML fragment targets. Transport failures,
unresolved redirects, missing anchors and incomplete checks fail. Bot responses
are counted as unverified and retain their prior evidence dates. Non-HTML fragments
are explicitly unverifiable. `--report PATH` records source IDs, registered
URLs, statuses and outcomes without resolved redirect URLs or response bodies.
`--write` updates evidence only after a successful run and never refreshes
unverified bot records.

## Independent checks

`npm run check` runs source-control regressions, citation identity tests,
manifest/privacy checks, generated-site contracts, local links, feeds, security,
design-system parity, locales and standalone validation. It is offline.
`npm run check:links` validates canonical-origin absolute URLs as local routes,
including fragments. External targets belong to the network gate.

The rendered security gate independently enforces CSP, vetted external anchors,
safe link attributes, local scripts/styles/assets and public contact rules.
Passing HTML checks does not establish source JSON safety, or the reverse.
Real local HTTP and disposable-file negative controls demonstrate that broken
anchors, deadline overruns, unsafe payloads and mismatched paper links fail.
