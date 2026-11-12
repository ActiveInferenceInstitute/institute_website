# Gate run guide

Start at [the documentation hub](README.md); the [flat index](documentation-index.md)
lists long-lived guides. Run commands from the repository root with Node and Python
available. This is a dependency-free static website, not a typed application or a
manuscript project: no type checker or `manuscript/` render path exists.

## One entry point

[`../run.sh`](../run.sh) delegates to [`../scripts/gates.mjs`](../scripts/gates.mjs).
CI calls the same arms; package commands remain the implementation authority.
`./run.sh --list` prints the actual command arrays. No arguments selects `fast`.

| Arm | Scope | Prerequisite |
| --- | --- | --- |
| `./run.sh lint` | Node/Python syntax (`check:syntax`) | Node, Python |
| `./run.sh fast` | Existing i18n helper/terminology test selection (`check:i18n`) | Node; no build |
| `./run.sh full` | Complete offline `npm run check`, including lint and docs | Build first |
| `./run.sh docs` | Markdown links, flat-index coverage and generated measurement freshness | Git, Python, Node |
| `./run.sh gnn` | Pinned parser, syntax and type conformance | Isolated parser environment; see below |
| `./run.sh build` | Static generation (`npm run build`) | Node |
| `./run.sh browser` | Calendar, newsletter, quick interaction checks, in the original CI order | Build and real `CHROME_BIN` |

The default is a focused smoke check, not release acceptance. `full` keeps the
existing offline contract. Python discovery already covers the indexability and
live-URL regression modules, so `check:indexability` no longer runs them a second
time. Individual `npm run check:*` commands remain available.

```sh
./run.sh build
./run.sh full
CHROME_BIN=/path/to/chrome WEBSITE_AUDIT_OUTPUT=/outside/checkout/evidence ./run.sh browser
```

Keep browser evidence outside this public checkout. Missing prerequisites and
nonzero checks fail explicitly. Do not disable the browser sandbox or remove
scenarios to manufacture a pass. The live external-source network probe remains
separate: `npm run check:sources`.

## GNN pin and local environment

The canonical [pin](../.github/gnn-pin.json) uses schema `gnn-importer-pin/v1`:
`ActiveInferenceInstitute/Generalized_Notation_Notation`, tag `v5.0.3`, revision
`8f293d9ba810e6eda5c09842d9c7ed9ffa5f92c1`. The
[`.github/GNN.md` pointer](../.github/GNN.md) records exactly what is parsed.
The job key is `gnn-conformance`; its display name is `gnn conformance (pinned)`.

Set up once outside the checkout; installation is networked and excluded from
the verification timing:

```sh
python3 -m venv /outside/checkout/gnn-env
/outside/checkout/gnn-env/bin/python scripts/check_gnn_conformance.py --install
GNN_PYTHON=/outside/checkout/gnn-env/bin/python ./run.sh gnn
```

The installer reads the revision from the canonical pin, installs the parser
without its optional extras, and pins the small parser-support dependency set in
the same script. It never changes another repository or the GNN registry.
Conformance parses repository `*.gnn.md` sketches. With none present, it validates
the upstream `input/gnn_files/basics/static_perception.md` at that exact revision;
this is a parser/pin baseline, not evidence of a repository model.
For offline execution, acquire that file before entering the offline runner and
pass `./run.sh gnn --exemplar /outside/checkout/static_perception.md`. The checker
requires a byte-exact SHA-256 match to the reviewed digest for the pin revision;
unknown revisions or unrelated valid models are rejected. A pin update requires
reviewing the new immutable upstream exemplar and recording its digest in the
checker. The default no-sketch path downloads from the pinned revision.

## CI versus deployment

[`ci.yml`](../.github/workflows/ci.yml) owns checks:

- `build-and-check`: one Node/Python environment owns build, full, browser and
  committed-output parity. Lint/docs are already included in full, not run twice.
- `compatibility`: the other existing runtime combinations run lint/fast smoke
  checks, not repeated full builds/browser suites. This deliberately narrows
  cross-runtime validation; full generated-site checks run on the primary pair.
- `gnn-conformance`: an isolated pinned parser environment and the same GNN arm.

The npm environment is shared by each job's arms and governed by the existing
`package-lock.json`; with no packages, redundant no-op npm installs are removed.
These workflows use pinned `actions/setup-python`, not the
`ActiveInferenceInstitute/.github/.github/actions/setup-python-uv` composite.
Do not claim its pinned revision was used here.

[`pages-manual.yml`](../.github/workflows/pages-manual.yml) has `build` call the
reusable CI workflow with artifact staging enabled. Its separate `deploy` job
needs the entire reusable check workflow, is main-only and owns Pages/OIDC
permissions. Checks never deploy. No workflow dispatch or hosting cutover is
part of this change: branch publishing remains the documented current mode.
Actions is billing-locked; local runs are the acceptance evidence, not a claim of
hosted success.

## Reproducible measurement document

Measured wall times and exit statuses live in generated
[GATE_MEASUREMENTS.md](GATE_MEASUREMENTS.md), backed by the sanitized
[observation data](gate-measurements.json). Never hand-edit numbers in prose.
The producer records every arm once, continues after failures and saves raw logs
outside the public checkout. Installation/download time is separate.

```sh
GNN_PYTHON=/outside/checkout/gnn-env/bin/python CHROME_BIN=/path/to/chrome \
  python3 scripts/measure_gates.py --measure --output /outside/checkout/after.json \
  --exemplar /outside/checkout/static_perception.md
# Build can be measured separately because it changes committed generated files:
python3 scripts/measure_gates.py --measure --arms build --output /outside/checkout/build.json
# Merge observation records by arm in an external JSON file, then refresh:
python3 scripts/measure_gates.py --refresh --after /outside/checkout/after.json
./run.sh docs
```

`--before FILE` imports retained baseline observations; it does not rerun old
source. `--check` verifies the generated document, command/test source binding
and flat-index coverage without rerunning measurements. A failed/partial baseline
and a passing full run are not comparable timing samples; no speedup is claimed.
Use the vault's governed execution/leases when working in a managed collection.
