"""Public graph identity and membership regressions using the actual producer."""

import copy
import unittest

from check_site_contract import check_idea_ontology_contract
from sync_instituteos_public_data import sanitize_ideas, sanitize_ontology


def shared_node_source():
    return {
        "tech_trees": [
            {
                "id": "A", "title": "Tree A",
                "nodes": [{"id": "a", "label": "Alpha"}, {"id": "x", "label": "Shared"}],
                "edges": [{"id": "a-x", "source_id": "a", "target_id": "x"}],
            },
            {
                "id": "B", "title": "Tree B",
                "nodes": [{"id": "x", "label": "Shared"}, {"id": "b", "label": "Beta"}],
                "edges": [{"id": "x-b", "source_id": "x", "target_id": "b"}],
            },
        ]
    }


class IdeaOntologyContractTests(unittest.TestCase):
    def setUp(self):
        source = shared_node_source()
        self.ideas = sanitize_ideas(source)
        self.ontology = sanitize_ontology(source)

    def errors(self):
        errors = []
        check_idea_ontology_contract(self.ideas, self.ontology, errors)
        return errors

    def assert_rejected(self, message):
        self.assertTrue(any(message in error for error in self.errors()), message)

    def test_shared_node_is_one_idea_with_two_memberships(self):
        self.assertEqual({row["id"] for row in self.ideas["records"]}, {"a", "x", "b"})
        self.assertEqual(sum(len(row["trees"]) for row in self.ideas["records"]), 4)
        self.assertEqual([tree["nodeCount"] for tree in self.ontology["trees"]], [2, 2])
        self.assertEqual(self.errors(), [])

    def test_duplicate_idea_id_is_not_an_additional_unique_idea(self):
        self.ideas["records"].append(copy.deepcopy(self.ideas["records"][0]))
        self.assert_rejected("duplicate idea ID")

    def test_unknown_or_repeated_memberships_are_rejected(self):
        original = copy.deepcopy(self.ideas)
        for labels, diagnostic in [(["Unknown tree"], "unknown membership"),
                                   (["Tree A", "Tree A"], "repeats membership"),
                                   ([], "no tree memberships")]:
            with self.subTest(labels=labels):
                self.ideas = copy.deepcopy(original)
                next(row for row in self.ideas["records"] if row["id"] == "a")["trees"] = labels
                self.assert_rejected(diagnostic)

    def test_membership_swap_cannot_hide_behind_unchanged_counts(self):
        for row in self.ideas["records"]:
            if row["id"] == "a":
                row["trees"] = ["Tree B"]
            elif row["id"] == "b":
                row["trees"] = ["Tree A"]
        self.assert_rejected("is not a member of tree")
        self.assertFalse(any("nodeCount" in error for error in self.errors()))

    def test_wrong_per_tree_node_count_is_rejected(self):
        self.ontology["trees"][0]["nodeCount"] = 3
        self.assert_rejected("declares nodeCount 3, found 2")

    def test_balanced_but_wrong_per_tree_edge_counts_are_rejected(self):
        self.ontology["trees"][0]["edgeCount"] = 2
        self.ontology["trees"][1]["edgeCount"] = 0
        self.assert_rejected("declares edgeCount 2, found 1")
        self.assert_rejected("declares edgeCount 0, found 1")

    def test_missing_edge_is_rejected(self):
        self.ontology["edges"].pop()
        self.assert_rejected("declares edgeCount 1, found 0")

    def test_edge_endpoints_and_tree_must_resolve(self):
        original = copy.deepcopy(self.ontology)
        for field, value, diagnostic in [("sourceId", "missing", "is not a member"),
                                         ("targetId", "b", "is not a member"),
                                         ("treeId", "missing", "unknown tree")]:
            with self.subTest(field=field):
                self.ontology = copy.deepcopy(original)
                self.ontology["edges"][0][field] = value
                self.assert_rejected(diagnostic)

    def test_edge_identity_is_scoped_to_its_tree(self):
        for edge in self.ontology["edges"]:
            edge["id"] = "relationship"
        self.assertEqual(self.errors(), [])
        self.ontology["edges"].append(copy.deepcopy(self.ontology["edges"][0]))
        self.ontology["trees"][0]["edgeCount"] += 1
        self.assert_rejected("duplicate edge ID")

    def test_ambiguous_tree_titles_are_reported_without_changing_schema(self):
        source = shared_node_source()
        source["tech_trees"][1]["title"] = "Tree A"
        self.ideas = sanitize_ideas(source)
        self.ontology = sanitize_ontology(source)
        self.assert_rejected("ambiguous membership label")

    def test_absent_title_uses_the_producers_id_fallback(self):
        source = shared_node_source()
        for tree in source["tech_trees"]:
            del tree["title"]
        self.ideas = sanitize_ideas(source)
        self.ontology = sanitize_ontology(source)
        self.assertEqual(self.errors(), [])

    def test_duplicate_tree_id_and_noninteger_counts_are_rejected(self):
        self.ontology["trees"][1]["id"] = "A"
        self.assert_rejected("duplicate tree ID")
        self.setUp()
        for value in [True, "2", -1]:
            with self.subTest(value=value):
                self.ontology["trees"][0]["nodeCount"] = value
                self.assert_rejected("declares nodeCount")
