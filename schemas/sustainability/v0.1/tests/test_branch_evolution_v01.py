"""Local-only validation for branch-evolution sustainability artifacts.

No network access, pushes, merges, ref updates, workflow changes, or external
execution are performed by this module.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover
    Draft202012Validator = None
    FormatChecker = None


ROOT = Path(__file__).resolve().parents[1]

PAIRS = [
    ("stale-state-assessment.schema.json", "examples/stale-state-assessment.example.json"),
    ("cross-context-consistency.schema.json", "examples/cross-context-consistency.example.json"),
    ("duplicate-realization-assessment.schema.json", "examples/duplicate-realization-assessment.example.json"),
    ("parallel-disposition-record.schema.json", "examples/parallel-disposition-record.example.json"),
]


def load_json(relative: str):
    with (ROOT / relative).open("r", encoding="utf-8") as handle:
        return json.load(handle)


@unittest.skipIf(Draft202012Validator is None, "jsonschema is not installed; local validation skipped")
class BranchEvolutionTests(unittest.TestCase):
    def test_examples_validate(self):
        for schema_rel, example_rel in PAIRS:
            with self.subTest(schema=schema_rel, example=example_rel):
                schema = load_json(schema_rel)
                Draft202012Validator.check_schema(schema)
                validator = Draft202012Validator(schema, format_checker=FormatChecker())
                errors = sorted(validator.iter_errors(load_json(example_rel)), key=lambda e: list(e.path))
                self.assertEqual([], errors, "\n".join(error.message for error in errors))

    def test_moved_main_marks_prior_state_stale(self):
        assessment = load_json("examples/stale-state-assessment.example.json")
        self.assertNotEqual(assessment["baseline_main_sha"], assessment["current_main_sha"])
        self.assertTrue(assessment["stale"])
        self.assertIn("main_moved", assessment["stale_reasons"])
        self.assertIs(assessment["execution_authorization_derived"], False)

    def test_cross_context_handoff_does_not_transfer_authority(self):
        assessment = load_json("examples/cross-context-consistency.example.json")
        self.assertTrue(assessment["information_frontier_preserved"])
        self.assertIs(assessment["hidden_memory_required"], False)
        self.assertIs(assessment["authority_transfer"], False)
        self.assertIs(assessment["execution_authorization_derived"], False)

    def test_overlap_detection_cannot_merge_or_replace(self):
        assessment = load_json("examples/duplicate-realization-assessment.example.json")
        self.assertIs(assessment["automatic_replacement_allowed"], False)
        self.assertIs(assessment["automatic_merge_allowed"], False)
        self.assertIs(assessment["explicit_human_disposition_required"], True)
        self.assertEqual("parallel-remains-distinct", assessment["overall_disposition"])

    def test_disposition_preserves_parallel_history(self):
        record = load_json("examples/parallel-disposition-record.example.json")
        self.assertTrue(record["historical_parallel_state_preserved"])
        self.assertIs(record["silent_rewrite_allowed"], False)
        self.assertIs(record["automatic_merge_allowed"], False)
        self.assertEqual("none", record["authority_effect"])


if __name__ == "__main__":
    unittest.main()
