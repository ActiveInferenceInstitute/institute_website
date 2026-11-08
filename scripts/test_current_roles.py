"""Current public memberships use canonical positions without exposing role history."""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from sync_instituteos_public_data import sanitize_entities, sanitize_fellows


class CurrentMembershipProjectionTests(unittest.TestCase):
    def person(self, **fields):
        return {
            "id": "public-person",
            "name": "Public Person",
            "entity_type": "person",
            "active": True,
            **fields,
        }

    def project(self, person):
        return sanitize_entities({"entities": [person]})["people"][0]

    def test_current_positions_map_to_existing_public_labels_and_deduplicate(self):
        person = self.person(
            roles=["Director", "Scientific Advisor", "Secretary"],
            institute_roles=[
                "Board of Directors", "Scientific Advisory Board", "Fellow", "Officer",
                "Intern", "Member", "Partner", "Registered Agent", "Board of Directors",
            ],
        )
        self.assertEqual(self.project(person)["roles"], [
            "Board of Directors", "SAB membership", "Fellow", "Officer",
            "Intern", "Member", "Partner", "Registered Agent",
        ])

    def test_missing_empty_or_null_current_roles_never_borrow_internal_history(self):
        for current in ({}, {"institute_roles": []}, {"institute_roles": None}):
            with self.subTest(current=current):
                person = self.person(roles=["Director", "Officer", "Scientific Advisor"], **current)
                self.assertEqual(self.project(person)["roles"], [])

    def test_preserved_aliases_cannot_restore_current_membership(self):
        person = self.person(institute_roles=[
            "Board Member", "Director", "Scientific Advisor", "Research Fellow", "BoD", "SAB", "President",
        ])
        self.assertEqual(self.project(person)["roles"], [])
        person["institute_roles"] += ["Board of Directors", "Scientific Advisory Board", "Fellow"]
        self.assertEqual(self.project(person)["roles"], ["Board of Directors", "SAB membership", "Fellow"])

    def test_malformed_current_roles_refuse_instead_of_creating_membership(self):
        invalid = [
            {"Officer": False}, {}, "Officer", "", 0, False, True, 2.5,
            ["Officer", None], ["Officer", False], ["Officer", 1],
            ["Officer", {"Fellow": True}], ["Officer", ["Fellow"]],
        ]
        for value in invalid:
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "institute_roles must be a list of strings"):
                    self.project(self.person(institute_roles=value))

    def test_malformed_registry_cannot_partially_overwrite_committed_public_files(self):
        with tempfile.TemporaryDirectory(prefix="public-role-refusal-") as directory:
            root = Path(directory)
            website = root / "website"
            scripts = Path(__file__).resolve().parent
            shutil.copytree(scripts, website / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
            content = website / "src/content"
            output = content / "instituteos"
            output.mkdir(parents=True)
            for name, payload in {"repositories": {"repositories": []}, "live-sources": {"sources": []}}.items():
                (content / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")
            prior = output / "entities.json"
            prior.write_bytes(b'{"preserve":"original-public-bytes"}\n')
            before = {p.relative_to(output).as_posix(): p.read_bytes() for p in output.rglob("*") if p.is_file()}
            registry = root / "private/library/registries"
            registry.mkdir(parents=True)
            for name, payload in {
                "tech_trees": {"tech_trees": []},
                "entities": {"entities": [
                    self.person(id="valid-before-failure", institute_roles=["Officer"]),
                    self.person(id="invalid-current-role", institute_roles={"Officer": False}),
                ]},
                "policies": {"policies": []}, "sab_cohorts": {"cohorts": []},
            }.items():
                (registry / f"{name}.json").write_text(json.dumps(payload), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, "-B", str(website / "scripts/sync_instituteos_public_data.py"),
                 "--instituteos-root", str(root / "private")],
                stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=15, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("institute_roles must be a list of strings", result.stderr)
            after = {p.relative_to(output).as_posix(): p.read_bytes() for p in output.rglob("*") if p.is_file()}
            self.assertEqual(after, before)

    def test_current_roles_do_not_unwithhold_private_imports_or_placeholders(self):
        entities = [
            self.person(id="private-import", tags=["roster-import"], institute_roles=["Board of Directors"]),
            self.person(id="role-slot", role_placeholder=True, institute_roles=["Officer"]),
        ]
        self.assertEqual(sanitize_entities({"entities": entities})["people"], [])

    def test_approved_board_appointments_reuse_public_directory_entries(self):
        aliases = [
            self.person(id="alianna-maren", name="Alianna Maren", title="Board Member"),
            self.person(id="ed-ober", name="Ed Ober", title="Board Member"),
            self.person(id="bleu-knight", name="Virginia Bleu Knight",
                        institute_roles=["Board of Directors", "Member"]),
        ]
        donors = [
            self.person(id="alianna-j-maren", name="Alianna J. Maren", tags=["roster-import"],
                        institute_roles=["Board of Directors", "Officer"], title="PRIVATE-TITLE",
                        contacts=[{"method": "website", "value": "https://private.example"}]),
            self.person(id="edward-ober", name="Edward Ober", tags=["roster-import"],
                        institute_roles=["Board of Directors"]),
        ]
        people = sanitize_entities({"entities": [*aliases, *donors]})["people"]
        self.assertEqual([(p["id"], p["name"], p["roles"]) for p in people], [
            ("alianna-maren", "Alianna J. Maren", ["Board of Directors"]),
            ("ed-ober", "Edward Ober", ["Board of Directors"]),
            ("bleu-knight", "V. Bleu Knight", ["Board of Directors", "Member"]),
        ])
        self.assertEqual(people[0]["title"], "Board Member")
        self.assertEqual(people[0]["website"], "")
        self.assertEqual(people[0]["tags"], [])

        for change in ({"active": False}, {"institute_roles": ["Director"]}, {"name": "Different Person"}):
            with self.subTest(change=change):
                result = sanitize_entities({"entities": [aliases[0], {**donors[0], **change}]})["people"]
                self.assertEqual(result, [self.project(aliases[0])])

    def test_active_state_curated_title_and_private_field_exclusions_are_preserved(self):
        person = self.person(
            active=False, title="Research Lead", institute_roles=["Fellow"],
            roles=["Internal Chair"], email="PRIVATE-CONTACT-CANARY",
            contacts=[{"method": "email", "value": "PRIVATE-CONTACT-CANARY"}],
            notes="PRIVATE-NOTE-CANARY",
        )
        projected = self.project(person)
        self.assertIs(projected["active"], False)
        self.assertEqual(projected["title"], "Research Lead")
        self.assertEqual(projected["roles"], ["Fellow"])
        serialized = json.dumps(projected)
        self.assertNotIn("Internal Chair", serialized)
        self.assertNotIn("PRIVATE-CONTACT-CANARY", serialized)
        self.assertNotIn("PRIVATE-NOTE-CANARY", serialized)
        self.assertNotIn("contacts", projected)
        self.assertNotIn("email", projected)

    def test_fellowship_appointments_keep_their_published_history(self):
        entities = [
            self.person(id="current-appointment", institute_roles=["Fellow"],
                        fellowship={"position": "Research Fellow", "status": "current", "start": "01/2026"}),
            self.person(id="past-appointment", institute_roles=[],
                        fellowship={"position": "Research Fellow", "status": "past", "start": "01/2025"}),
        ]
        self.assertEqual(
            {row["id"]: row["status"] for row in sanitize_fellows({"entities": entities})["fellows"]},
            {"current-appointment": "current", "past-appointment": "past"},
        )

    def test_projection_keeps_the_registry_and_unrelated_organization_data_intact(self):
        source = {"entities": [
            self.person(roles=["Internal Chair"], institute_roles=["Officer"]),
            {"id": "public-organization", "name": "Public Organization", "entity_type": "organization",
             "type": "research", "tags": [], "people": ["public-person"]},
        ]}
        before = deepcopy(source)
        projected = sanitize_entities(source)
        self.assertEqual(source, before)
        self.assertEqual(projected["organizations"][0]["memberIds"], ["public-person"])


if __name__ == "__main__":
    unittest.main()
