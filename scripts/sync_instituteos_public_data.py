#!/usr/bin/env python3
"""Sync public-safe InstituteOS registry slices into the website content tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _resolve_instituteos_root() -> Path:
    """Locate the InstituteOS source checkout that provides public-safe data.

    Honors the ``INSTITUTEOS_ROOT`` env var first, then auto-detects common
    layouts: a parent checkout that embeds this site as a submodule, or a sibling
    clone (``../instituteos``). Only a candidate that actually contains
    ``library/registries`` is accepted; otherwise the sibling path is returned.
    """
    env = os.environ.get("INSTITUTEOS_ROOT")
    if env:
        return Path(env)
    for candidate in (PROJECT_ROOT.parents[1], PROJECT_ROOT.parent / "instituteos"):
        if (candidate / "library" / "registries").is_dir():
            return candidate
    return PROJECT_ROOT.parent / "instituteos"


# The InstituteOS source checkout that provides public-safe concept-graph data.
DEFAULT_INSTITUTEOS_ROOT = _resolve_instituteos_root()
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
REQUIRED_PUBLIC_JSON_FILES = (
    "people.json",
    "projects.json",
    "ideas.json",
    "ontology.json",
    "entities.json",
    "processes.json",
    "communications.json",
    "policies.json",
    "assets.json",
)
OPTIONAL_PUBLIC_JSON_FILES = ("calendar.json",)
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
# Strict-union forbidden substrings. ``/users/`` (an absolute local path) was
# previously only caught by the in-repo graph gate; it is added here so the
# public sync gate matches the unified PublicGate's substring set.
FORBIDDEN_SUBSTRINGS = (
    "coda.io",
    "/users/",
    "workspace",
    "source atlas",
    "source manifest",
    "aii.pdf",
)
# Generic email-address pattern. The historical sync gate relied solely on the
# ``"email"`` key scan; this catches an address that leaks into any *value*.
EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.IGNORECASE)
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
        "PDF": "document",
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


def record_is_public_safe(record: dict[str, Any]) -> bool:
    """Return False if a single record would trip validate_public_payload.

    Mirrors validate_public_payload's checks without raising. Used to drop the
    rare entity whose own public identity collides with a private-channel token —
    e.g. a technology-provider organization literally named "Discord" — so the
    surviving payload passes the shared public-safety gate untouched.
    """
    serialized = json.dumps(record, ensure_ascii=False).lower()
    for blocked in PRIVATE_KEYS:
        if f'"{blocked}"' in serialized:
            return False
    for blocked in FORBIDDEN_SUBSTRINGS:
        if blocked in serialized:
            return False
    if EMAIL_RE.search(serialized):
        return False
    return True


def sanitize_entities(entities_data: dict[str, Any]) -> dict[str, Any]:
    people = []
    organizations = []
    for entity in entities_data.get("entities", []):
        entity_type = entity.get("entity_type")
        # Public-release gate: contacts imported from the private CRM roster
        # (tagged "roster-import") are directory contacts, not public governance
        # members — withhold them from the public knowledge page.
        if "roster-import" in (entity.get("tags") or []):
            continue
        if entity_type == "person":
            policy_roles = [
                {
                    "policyId": link.get("policy_id"),
                    "role": public_text(link.get("role")),
                }
                for link in entity.get("policy_links", [])
            ]
            record = {
                "id": entity.get("id"),
                "name": public_text(entity.get("name")),
                "title": public_text(entity.get("title")),
                "roles": [public_text(role) for role in entity.get("roles", [])],
                "orgId": entity.get("org_id"),
                "active": entity.get("active"),
                "tags": [public_text(tag) for tag in entity.get("tags", []) if public_text(tag)],
                "policyRoles": policy_roles,
            }
            if record_is_public_safe(record):
                people.append(record)
        elif entity_type == "organization":
            record = {
                "id": entity.get("id"),
                "name": public_text(entity.get("name")),
                "type": public_text(entity.get("type")),
                "description": public_text(entity.get("description")),
                "url": entity.get("url"),
                "tags": [public_text(tag) for tag in entity.get("tags", []) if public_text(tag)],
                "memberIds": list(entity.get("people", [])),
                "parentId": entity.get("parent_id"),
            }
            if record_is_public_safe(record):
                organizations.append(record)
    people.sort(key=lambda item: item["name"].lower())
    organizations.sort(key=lambda item: item["name"].lower())
    return {
        "description": "Public-safe people and organizations derived from InstituteOS entities.",
        "source": "instituteos/library/registries/entities.json",
        "people": people,
        "organizations": organizations,
    }


def sanitize_processes(processes_data: dict[str, Any]) -> dict[str, Any]:
    records = []
    for process in processes_data.get("processes", []):
        sla = process.get("sla") or {}
        steps = process.get("steps", [])
        records.append(
            {
                "id": process.get("id"),
                "title": public_text(process.get("title")),
                "description": public_text(process.get("description")),
                "category": public_text(process.get("category")),
                "version": process.get("version"),
                "status": public_text(process.get("status")),
                "triggers": [public_text(trigger) for trigger in process.get("triggers", [])],
                "slaDays": sla.get("total_days"),
                "linkedPolicies": list(process.get("linked_policies", [])),
                "stepCount": len(steps),
                "steps": [
                    {
                        "order": step.get("order"),
                        "name": public_text(step.get("name")),
                        "description": public_text(step.get("description")),
                    }
                    for step in steps
                ],
            }
        )
    records.sort(key=lambda item: item["title"].lower())
    return {
        "description": "Public-safe governance process summaries derived from InstituteOS processes.",
        "source": "instituteos/library/registries/processes.json",
        "records": records,
    }


def sanitize_communications(comms_data: dict[str, Any]) -> dict[str, Any]:
    records = []
    for comm in comms_data.get("communications", []):
        if comm.get("review_status") != "approved":
            continue
        records.append(
            {
                "id": comm.get("id"),
                "type": public_text(comm.get("type")),
                "title": public_text(comm.get("title")),
                "author": public_text(comm.get("author")),
                "date": comm.get("date"),
                "referenceNumber": comm.get("reference_number"),
                "language": comm.get("language"),
            }
        )
    records.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
    return {
        "description": "Public-safe approved communications derived from InstituteOS communications.",
        "source": "instituteos/library/registries/communications.json",
        "records": records,
    }


def sanitize_policies(policies_data: dict[str, Any]) -> dict[str, Any]:
    records = []
    for policy in policies_data.get("policies", []):
        # Public-release gate: only policies marked visibility="public" sync to the
        # website knowledge page; all others (default "internal") are withheld.
        if (policy.get("visibility") or "internal") != "public":
            continue
        current_version = ""
        for version in policy.get("versions", []):
            if version.get("is_current") is True:
                current_version = version.get("version") or ""
                break
        records.append(
            {
                "id": policy.get("id"),
                "title": public_text(policy.get("title")),
                "category": public_text(policy.get("category")),
                "description": public_text(policy.get("description")),
                "status": public_text(policy.get("status")),
                "tags": [public_text(tag) for tag in policy.get("tags", []) if public_text(tag)],
                "currentVersion": current_version,
            }
        )
    records.sort(key=lambda item: (item["category"].lower(), item["title"].lower()))
    return {
        "description": "Public-safe policy registry rows derived from InstituteOS policies.",
        "source": "instituteos/library/registries/policies.json",
        "records": records,
    }


# Event URLs are kept only when their host is on this public allowlist. Anything
# else (Coda canvases, Drive docs, internal links) is dropped so the public
# calendar export never leaks a private destination through an event location.
SAFE_URL_HOST_SUFFIXES = (
    "youtube.com",
    "youtu.be",
    "activeinference.institute",
    "github.com",
    "zoom.us",
    "meet.google.com",
    "twitch.tv",
    "odysee.com",
)


def _safe_event_url(value: str | None) -> str:
    raw = normalize_text(value)
    if not raw.startswith(("http://", "https://")):
        return ""
    host = raw.split("/", 3)[2].split("@")[-1].split(":")[0].lower() if "//" in raw else ""
    if any(host == suffix or host.endswith(f".{suffix}") for suffix in SAFE_URL_HOST_SUFFIXES):
        return raw
    return ""


def sanitize_calendar(calendar_data: dict[str, Any]) -> dict[str, Any]:
    """Public-safe projection of the InstituteOS calendar registry.

    Drops descriptions (the primary leak vector for Coda/Drive/internal links),
    replaces ``...@google.com`` UIDs with opaque hashes (so no value matches the
    email gate), and keeps event URLs only when their host is publicly safe.
    """
    records = []
    for event in calendar_data.get("events", []):
        uid = str(event.get("uid") or "")
        record = {
            "id": hashlib.sha1(uid.encode("utf-8")).hexdigest()[:16] if uid else "",
            "title": public_text(event.get("summary")),
            "start": event.get("start") or "",
            "end": event.get("end") or "",
            "allDay": bool(event.get("allDay")),
            "status": public_text(event.get("status")) or "CONFIRMED",
            "timeZone": public_text(event.get("timeZone")),
            "url": _safe_event_url(event.get("url") or event.get("location")),
        }
        if not record["id"] or not record["start"]:
            continue
        if not record_is_public_safe(record):
            # Last-resort guard: drop the URL and re-check before discarding the row.
            record["url"] = ""
            if not record_is_public_safe(record):
                continue
        records.append(record)
    records.sort(key=lambda item: (item["start"], item["title"].lower()))
    # @-encode any literal '@' so calendar URLs never match the email gate.
    ics_url = str(calendar_data.get("sourceUrl") or "").replace("@", "%40")
    embed_url = str(calendar_data.get("embedUrl") or "").replace("@", "%40")
    return {
        "description": "Public-safe upcoming/past events from the Institute's public Google Calendar.",
        "source": "instituteos/library/registries/calendar.json",
        "calendarName": public_text(calendar_data.get("calendarName")),
        "icsUrl": ics_url,
        "embedUrl": embed_url,
        "records": records,
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
    for blocked in FORBIDDEN_SUBSTRINGS:
        if blocked in serialized:
            raise ValueError(f"{path} contains blocked public term {blocked!r}")
    found_emails = sorted(set(EMAIL_RE.findall(serialized)))
    if found_emails:
        raise ValueError(f"{path} contains blocked email address(es) {found_emails!r}")


def build_results(instituteos_root: Path) -> list[SyncResult]:
    repositories_data = load_json(PROJECT_ROOT / "src" / "content" / "repositories.json")
    tech_tree_data = load_json(instituteos_root / "library" / "registries" / "tech_trees.json")

    registries_dir = instituteos_root / "library" / "registries"
    entities_path = registries_dir / "entities.json"
    processes_path = registries_dir / "processes.json"
    communications_path = registries_dir / "communications.json"
    policies_path = registries_dir / "policies.json"
    for required_path in (entities_path, processes_path, communications_path, policies_path):
        if not required_path.exists():
            raise SystemExit(f"required InstituteOS registry not found: {required_path}")

    entities_data = load_json(entities_path)
    processes_data = load_json(processes_path)
    communications_data = load_json(communications_path)
    policies_data = load_json(policies_path)

    payloads = {
        "people.json": sanitize_people(),
        "projects.json": sanitize_projects(repositories_data),
        "ideas.json": sanitize_ideas(tech_tree_data),
        "ontology.json": sanitize_ontology(tech_tree_data),
        "entities.json": sanitize_entities(entities_data),
        "processes.json": sanitize_processes(processes_data),
        "communications.json": sanitize_communications(communications_data),
        "policies.json": sanitize_policies(policies_data),
    }
    # Calendar is optional: only synced when the InstituteOS pull has been run.
    calendar_path = registries_dir / "calendar.json"
    if calendar_path.exists():
        payloads["calendar.json"] = sanitize_calendar(load_json(calendar_path))
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


def check_committed_public_payloads() -> int:
    errors = []
    json_files = [CONTENT_OUT / name for name in REQUIRED_PUBLIC_JSON_FILES]
    json_files.extend(CONTENT_OUT / name for name in OPTIONAL_PUBLIC_JSON_FILES if (CONTENT_OUT / name).exists())

    for path in json_files:
        if not path.exists():
            errors.append(f"missing {path.relative_to(PROJECT_ROOT)}")
            continue
        try:
            validate_public_payload(load_json(path), path.name)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            errors.append(f"{path.relative_to(PROJECT_ROOT)} failed public-safety validation: {exc}")

    for filename in BRAND_ASSETS:
        path = ASSET_OUT / filename
        if not path.exists() or path.stat().st_size == 0:
            errors.append(f"missing or empty {path.relative_to(PROJECT_ROOT)}")

    if errors:
        print("InstituteOS committed public data check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "InstituteOS registry source not available; validated committed public "
        f"payloads ({len(json_files)} JSON files, {len(BRAND_ASSETS)} brand assets)."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--instituteos-root", type=Path, default=DEFAULT_INSTITUTEOS_ROOT)
    parser.add_argument("--check", action="store_true", help="verify generated files are current without writing")
    args = parser.parse_args()

    instituteos_root = args.instituteos_root.expanduser().resolve()
    if not (instituteos_root / "library" / "registries").exists():
        explicit_root = os.environ.get("INSTITUTEOS_ROOT") or any(
            arg == "--instituteos-root" or arg.startswith("--instituteos-root=") for arg in sys.argv[1:]
        )
        if args.check and not explicit_root:
            return check_committed_public_payloads()
        raise SystemExit(f"InstituteOS registry directory not found: {instituteos_root}")

    results = build_results(instituteos_root)
    if args.check:
        return check_results(results)

    write_results(results)
    print(f"Synced {len(results)} InstituteOS public data files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
