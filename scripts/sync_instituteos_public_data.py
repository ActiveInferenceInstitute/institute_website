#!/usr/bin/env python3
"""Sync public-safe InstituteOS registry slices into the website content tree."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INSTITUTEOS_ROOT = Path("/Users/4d/Documents/GitHub/instituteos")
CONTENT_OUT = PROJECT_ROOT / "src" / "content" / "instituteos"
ASSET_OUT = PROJECT_ROOT / "assets" / "img" / "instituteos"
BRAND_ASSETS = {
    "ActInferServe.png": {
        "id": "act-infer-serve-light",
        "alt": "Active Inference Institute Act Infer Serve mark",
        "theme": "light",
    },
    "Dark_ActInfServe.png": {
        "id": "act-infer-serve-dark",
        "alt": "Active Inference Institute Act Infer Serve dark mark",
        "theme": "dark",
    },
}
PRIVATE_KEYS = {
    "contacts",
    "interactions",
    "address",
    "notes",
    "email",
    "phone",
    "slack",
    "discord",
    "linkedin",
    "primary_contact",
}
PUBLIC_GITHUB_PEOPLE = [
    {
        "id": "github-docxology",
        "name": "Daniel Ari Friedman",
        "login": "docxology",
        "sourceId": "person-docxology",
        "publicRole": "Public GitHub contributor",
        "repositories": ["CEREBRUM", "GeneralizedNotationNotation", "GEO-INFER", "institute_website"],
        "contributionSummary": "Public GitHub profile connected to multiple ActiveInferenceInstitute open-source repositories.",
        "relatedSlugs": ["projects", "learning", "ecosystem"],
    },
    {
        "id": "github-bazookamanph",
        "name": "BazookamanPH",
        "login": "BazookamanPH",
        "sourceId": "person-bazookamanph",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning"],
    },
    {
        "id": "github-hollygrimm",
        "name": "Holly Grimm",
        "login": "hollygrimm",
        "sourceId": "person-hollygrimm",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning", "ecosystem"],
    },
    {
        "id": "github-ana-magdalena",
        "name": "Ana-Magdalena",
        "login": "Ana-Magdalena",
        "sourceId": "person-ana-magdalena",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning"],
    },
    {
        "id": "github-thebuttskie",
        "name": "TheButtskie",
        "login": "TheButtskie",
        "sourceId": "person-thebuttskie",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning"],
    },
    {
        "id": "github-jeffschulman",
        "name": "jeffschulman",
        "login": "jeffschulman",
        "sourceId": "person-jeffschulman",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning"],
    },
    {
        "id": "github-turfus",
        "name": "turfus",
        "login": "turfus",
        "sourceId": "person-turfus",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning"],
    },
    {
        "id": "github-mlflumic",
        "name": "mlflumic",
        "login": "mlflumic",
        "sourceId": "person-mlflumic",
        "publicRole": "Public GitHub contributor",
        "repositories": ["ActiveInferenceJournal"],
        "contributionSummary": "Public GitHub contributor visible on the ActiveInferenceJournal repository.",
        "relatedSlugs": ["projects", "learning"],
    },
]


@dataclass(frozen=True)
class SyncResult:
    path: Path
    content: str | bytes
    binary: bool = False


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").split())


def public_text(value: str | None) -> str:
    text = normalize_text(value)
    replacements = {
        "global workspace": "global cognitive access",
        "Global Workspace": "Global Cognitive Access",
        "global-workspace": "global-access",
        "workspace": "shared space",
        "Workspace": "Shared Space",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def title_case_token(value: str) -> str:
    return public_text(value.replace("_", " ").replace("-", " ")).title()


def related_slugs_for_node(node_type: str, tags: list[str]) -> list[str]:
    tag_set = set(tags)
    if node_type in {"method", "tool"} or {"implementation", "julia", "python"} & tag_set:
        return ["active-inference", "learning", "projects"]
    if node_type in {"value", "organization", "person"}:
        return ["about", "ecosystem"]
    return ["active-inference", "learning", "ecosystem"]


def sanitize_people() -> dict[str, Any]:
    people = sorted(PUBLIC_GITHUB_PEOPLE, key=lambda item: item["login"].lower())
    return {
        "description": "Public GitHub people visible through public ActiveInferenceInstitute repository metadata.",
        "source": "public GitHub profiles and repository contributor listings checked 2026-06-09",
        "records": people,
    }


def sanitize_projects(repositories_data: dict[str, Any]) -> dict[str, Any]:
    projects = []
    for repo in repositories_data.get("repositories", []):
        if repo.get("promoted") is False:
            continue
        projects.append(
            {
                "id": repo.get("sourceId", repo.get("name")),
                "title": public_text(repo.get("name")),
                "fullName": public_text(repo.get("fullName")),
                "sourceId": repo.get("sourceId"),
                "url": repo.get("url"),
                "category": repo.get("category", "projects"),
                "audience": repo.get("audience", "developer"),
                "projectFamily": repo.get("projectFamily") or title_case_token(repo.get("category", "projects")),
                "repoType": repo.get("repoType") or "Open source repository",
                "language": repo.get("language") or "Unspecified",
                "stars": int(repo.get("stars") or 0),
                "updatedAt": repo.get("updatedAt") or "",
                "docsUrl": repo.get("docsUrl") or "",
                "docsSourceId": repo.get("docsSourceId") or "",
                "summary": public_text(repo.get("summary") or repo.get("description")),
                "tags": [public_text(tag) for tag in repo.get("tags", []) if public_text(tag)],
                "relatedSlugs": repo.get("relatedSlugs", ["projects"]),
            }
        )
    projects.sort(key=lambda item: (-item["stars"], item["title"].lower()))
    return {
        "description": "Public open-source project rows derived from ActiveInferenceInstitute repositories.",
        "source": "src/content/repositories.json",
        "records": projects,
    }


def sanitize_ideas(tech_tree_data: dict[str, Any]) -> dict[str, Any]:
    by_id: dict[str, dict[str, Any]] = {}
    for tree in tech_tree_data.get("tech_trees", []):
        for node in tree.get("nodes", []):
            node_id = node.get("id")
            if not node_id:
                continue
            tags = [public_text(tag) for tag in node.get("tags", []) if public_text(tag)]
            current = by_id.setdefault(
                node_id,
                {
                    "id": node_id,
                    "label": public_text(node.get("label")),
                    "nodeType": node.get("node_type", "concept"),
                    "maturity": title_case_token(node.get("maturity", "emerging")),
                    "summary": public_text(node.get("description")),
                    "tags": [],
                    "trees": [],
                    "relatedSlugs": related_slugs_for_node(node.get("node_type", "concept"), tags),
                },
            )
            current["tags"] = sorted(set(current["tags"]) | set(tags))
            current["trees"] = sorted(set(current["trees"]) | {tree.get("title", tree.get("id", ""))})
    ideas = sorted(by_id.values(), key=lambda item: (item["nodeType"], item["label"]))
    return {
        "description": "Deduplicated public concept, method, tool, value, and publication rows from InstituteOS tech trees.",
        "source": "instituteos/library/registries/tech_trees.json",
        "records": ideas,
    }


def sanitize_ontology(tech_tree_data: dict[str, Any]) -> dict[str, Any]:
    trees = []
    edges = []
    for tree in tech_tree_data.get("tech_trees", []):
        node_by_id = {node.get("id"): node for node in tree.get("nodes", [])}
        trees.append(
            {
                "id": tree.get("id"),
                "title": public_text(tree.get("title")),
                "domain": title_case_token(tree.get("domain", "")),
                "status": title_case_token(tree.get("status", "")),
                "summary": public_text(tree.get("description")),
                "nodeCount": len(tree.get("nodes", [])),
                "edgeCount": len(tree.get("edges", [])),
                "linkedProjectCount": len(tree.get("linked_projects", [])),
            }
        )
        for edge in tree.get("edges", []):
            source = node_by_id.get(edge.get("source_id"), {})
            target = node_by_id.get(edge.get("target_id"), {})
            edges.append(
                {
                    "id": edge.get("id"),
                    "treeId": tree.get("id"),
                    "treeTitle": public_text(tree.get("title")),
                    "sourceId": edge.get("source_id"),
                    "sourceLabel": public_text(source.get("label", edge.get("source_id"))),
                    "relationship": public_text(edge.get("label")) or title_case_token(edge.get("edge_type", "")),
                    "edgeType": edge.get("edge_type", ""),
                    "targetId": edge.get("target_id"),
                    "targetLabel": public_text(target.get("label", edge.get("target_id"))),
                    "sourceMaturity": title_case_token(source.get("maturity", "")),
                    "targetMaturity": title_case_token(target.get("maturity", "")),
                }
            )
    trees.sort(key=lambda item: item["title"])
    edges.sort(key=lambda item: (item["treeTitle"], item["sourceLabel"], item["targetLabel"]))
    return {
        "description": "Public-safe ontology tree and relationship rows derived from InstituteOS tech trees.",
        "source": "instituteos/library/registries/tech_trees.json",
        "trees": trees,
        "edges": edges,
    }


def build_asset_records(instituteos_root: Path) -> tuple[dict[str, Any], list[SyncResult]]:
    records = []
    writes: list[SyncResult] = []
    for filename, meta in BRAND_ASSETS.items():
        source = instituteos_root / "library" / "assets" / filename
        if not source.exists():
            raise FileNotFoundError(f"required brand asset missing: {source}")
        target = ASSET_OUT / filename
        records.append(
            {
                "id": meta["id"],
                "filename": filename,
                "path": f"assets/img/instituteos/{filename}",
                "alt": meta["alt"],
                "theme": meta["theme"],
                "source": f"instituteos/library/assets/{filename}",
            }
        )
        writes.append(SyncResult(target, source.read_bytes(), binary=True))
    return (
        {
            "description": "Brand-only assets copied from InstituteOS for the public website.",
            "source": "instituteos/library/assets",
            "records": records,
        },
        writes,
    )


def validate_public_payload(data: Any, path: str) -> None:
    serialized = json.dumps(data, ensure_ascii=False).lower()
    for blocked in PRIVATE_KEYS:
        if f'"{blocked}"' in serialized:
            raise ValueError(f"{path} contains blocked private key {blocked!r}")
    for blocked in ("coda.io", "workspace", "source atlas", "source manifest", "aii.pdf"):
        if blocked in serialized:
            raise ValueError(f"{path} contains blocked public term {blocked!r}")


def build_results(instituteos_root: Path) -> list[SyncResult]:
    repositories_data = load_json(PROJECT_ROOT / "src" / "content" / "repositories.json")
    tech_tree_data = load_json(instituteos_root / "library" / "registries" / "tech_trees.json")

    payloads = {
        "people.json": sanitize_people(),
        "projects.json": sanitize_projects(repositories_data),
        "ideas.json": sanitize_ideas(tech_tree_data),
        "ontology.json": sanitize_ontology(tech_tree_data),
    }
    asset_payload, asset_writes = build_asset_records(instituteos_root)
    payloads["assets.json"] = asset_payload

    results = []
    for filename, payload in payloads.items():
        validate_public_payload(payload, filename)
        results.append(SyncResult(CONTENT_OUT / filename, dump_json(payload)))
    results.extend(asset_writes)
    return results


def write_results(results: list[SyncResult]) -> None:
    for result in results:
        result.path.parent.mkdir(parents=True, exist_ok=True)
        if result.binary:
            result.path.write_bytes(result.content)  # type: ignore[arg-type]
        else:
            result.path.write_text(result.content, encoding="utf-8")  # type: ignore[arg-type]


def check_results(results: list[SyncResult]) -> int:
    stale = []
    for result in results:
        if not result.path.exists():
            stale.append(f"missing {result.path.relative_to(PROJECT_ROOT)}")
            continue
        current = result.path.read_bytes() if result.binary else result.path.read_text(encoding="utf-8")
        if current != result.content:
            stale.append(f"stale {result.path.relative_to(PROJECT_ROOT)}")
    if stale:
        print("InstituteOS public data sync check failed:", file=sys.stderr)
        for item in stale:
            print(f"- {item}", file=sys.stderr)
        return 1
    print("InstituteOS public data sync check passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--instituteos-root", type=Path, default=DEFAULT_INSTITUTEOS_ROOT)
    parser.add_argument("--check", action="store_true", help="verify generated files are current without writing")
    args = parser.parse_args()

    instituteos_root = args.instituteos_root.expanduser().resolve()
    if not (instituteos_root / "library" / "registries").exists():
        raise SystemExit(f"InstituteOS registry directory not found: {instituteos_root}")

    results = build_results(instituteos_root)
    if args.check:
        return check_results(results)

    write_results(results)
    print(f"Synced {len(results)} InstituteOS public data files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
