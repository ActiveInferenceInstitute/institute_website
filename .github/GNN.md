# GNN conformance

The [`gnn-conformance`](workflows/ci.yml) job has display name
`gnn conformance (pinned)`. It calls `./run.sh gnn`, implemented by
[`scripts/check_gnn_conformance.py`](../scripts/check_gnn_conformance.py).
The canonical [`gnn-pin.json`](gnn-pin.json) has schema `gnn-importer-pin/v1`
and pins `ActiveInferenceInstitute/Generalized_Notation_Notation` at `v5.0.3`
(`8f293d9ba810e6eda5c09842d9c7ed9ffa5f92c1`).

The job verifies the pin and installed parser, parses every `*.gnn.md` sketch
in the repository, and type-checks them. When the repository has no sketch yet,
it parses the pinned upstream `input/gnn_files/basics/static_perception.md`
exemplar; this is a pipeline and pin conformance baseline, not a claim that the
repository already contains a model.

The implementation reads `schema`, `repository`, `revision` and `tag`; `recorded`
is provenance metadata, not a parser argument. It installs by revision, checks
the installed version against the tag and validates syntax plus type conformance.
`--exemplar PATH` accepts previously acquired pinned exemplar bytes for offline
runs; callers must preserve their revision provenance. Without it, the no-sketch
path downloads the exemplar from the pinned revision.

Both workflows use pinned `actions/setup-python`, not the
`ActiveInferenceInstitute/.github/.github/actions/setup-python-uv` composite.
See the [run guide](../docs/RUN_GUIDE.md) for local commands.
