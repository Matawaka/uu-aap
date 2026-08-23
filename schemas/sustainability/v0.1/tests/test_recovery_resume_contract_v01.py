"""Local-only tests for Sustainability Recovery / Resume Contract v0.1.

No network, Git mutation, workflow activation, CHSP execution, or KONTUR action.
"""

from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover
    Draft202012Validator = None
    FormatChecker = None


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "recovery-resume-contract.schema.json"
EXAMPLE = ROOT / "examples/recovery-resume-contract.example.json"


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@unittest.skipIf(Draft202012Validator is None, "jsonschema is not installed")
class RecoveryResumeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema = load(SCHEMA)
        Draft202012Validator.check_schema(schema)
        cls.validator = Draft202012Validator(schema, format_checker=FormatChecker())

    def assert_valid(self, instance):
        errors = list(self.validator.iter_errors(instance))
        self.assertEqual([], errors, "\n".join(error.message for error in errors))

    def assert_invalid(self, instance):
        self.assertTrue(list(self.validator.iter_errors(instance)))

    def test_positive_example_is_prepare_only(self):
        instance = load(EXAMPLE)
        self.assert_valid(instance)
        self.assertEqual("prepare-only", instance["safe_resume_mode"])
        self.assertIs(instance["authority_transfer"], False)
        self.assertIs(instance["authorization_reuse_allowed"], False)
        self.assertIs(instance["external_execution_authorized"], False)

    def test_unknown_state_blocks_resume(self):
        instance = copy.deepcopy(load(EXAMPLE))
        instance["comparison"] = "unknown"
        self.assert_invalid(instance)

    def test_divergence_blocks_resume(self):
        instance = copy.deepcopy(load(EXAMPLE))
        instance["comparison"] = "diverged"
        self.assert_invalid(instance)

    def test_recovery_cannot_transfer_authority(self):
        instance = copy.deepcopy(load(EXAMPLE))
        instance["authority_transfer"] = True
        self.assert_invalid(instance)

    def test_recovery_cannot_reuse_authorization(self):
        instance = copy.deepcopy(load(EXAMPLE))
        instance["authorization_reuse_allowed"] = True
        self.assert_invalid(instance)

    def test_recovery_cannot_authorize_external_execution(self):
        instance = copy.deepcopy(load(EXAMPLE))
        instance["external_execution_authorized"] = True
        self.assert_invalid(instance)


if __name__ == "__main__":
    unittest.main()
