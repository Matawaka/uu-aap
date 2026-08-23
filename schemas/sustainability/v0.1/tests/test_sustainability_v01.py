"""Local-only validation tests for the non-normative sustainability v0.1 drafts.

This module is intentionally not wired into GitHub Actions or any execution path.
It validates static JSON fixtures only and performs no network, repository, or
external-system mutations.
"""

from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover - local environments may omit jsonschema
    Draft202012Validator = None
    FormatChecker = None


ROOT = Path(__file__).resolve().parents[1]
TESTS = Path(__file__).resolve().parent

POSITIVE_PAIRS = [
    ("project-recovery-checkpoint.schema.json", "examples/project-recovery-checkpoint.example.json"),
    ("capability-ceiling.schema.json", "examples/capability-ceiling.example.json"),
    ("recovery-handoff.schema.json", "examples/recovery-handoff.example.json"),
    ("motivation-governor.schema.json", "examples/motivation-governor.example.json"),
    ("human-sustainability-observation.schema.json", "examples/human-sustainability-observation.example.json"),
]


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def apply_pointer_mutation(document, pointer: str, value):
    if not pointer.startswith("/"):
        raise ValueError(f"Only absolute JSON pointers are supported: {pointer}")
    parts = [part.replace("~1", "/").replace("~0", "~") for part in pointer[1:].split("/")]
    target = document
    for part in parts[:-1]:
        if isinstance(target, list):
            target = target[int(part)]
        else:
            target = target[part]
    leaf = parts[-1]
    if isinstance(target, list):
        target[int(leaf)] = value
    else:
        target[leaf] = value


@unittest.skipIf(Draft202012Validator is None, "jsonschema is not installed; local validation skipped")
class SustainabilitySchemaTests(unittest.TestCase):
    def validator_for(self, schema_path: Path):
        schema = load_json(schema_path)
        Draft202012Validator.check_schema(schema)
        return Draft202012Validator(schema, format_checker=FormatChecker())

    def test_positive_examples_validate(self):
        for schema_rel, example_rel in POSITIVE_PAIRS:
            with self.subTest(schema=schema_rel, example=example_rel):
                validator = self.validator_for(ROOT / schema_rel)
                instance = load_json(ROOT / example_rel)
                errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.path))
                self.assertEqual([], errors, "\n".join(error.message for error in errors))

    def test_negative_vectors_fail_closed(self):
        suite = load_json(TESTS / "negative-vectors.json")
        self.assertEqual("uu-aap.sustainability-negative-vectors", suite["document_type"])
        for vector in suite["vectors"]:
            with self.subTest(vector=vector["id"]):
                schema_path = (TESTS / vector["schema"]).resolve()
                example_path = (TESTS / vector["base_example"]).resolve()
                validator = self.validator_for(schema_path)
                instance = copy.deepcopy(load_json(example_path))
                apply_pointer_mutation(
                    instance,
                    vector["mutation"]["pointer"],
                    vector["mutation"]["value"],
                )
                errors = list(validator.iter_errors(instance))
                self.assertEqual("invalid", vector["expected"])
                self.assertTrue(errors, f"Negative vector unexpectedly validated: {vector['id']}")

    def test_handoff_is_information_not_authority(self):
        handoff = load_json(ROOT / "examples/recovery-handoff.example.json")
        self.assertIs(handoff["authority_transfer"], False)
        self.assertIs(handoff["requires_fresh_external_observation"], True)
        self.assertNotEqual("execute", handoff["safe_resume_mode"])

    def test_human_observation_has_no_authority_effect(self):
        observation = load_json(ROOT / "examples/human-sustainability-observation.example.json")
        self.assertEqual("none", observation["authority_effect"])
        self.assertIs(observation["biometric_data_required"], False)
        self.assertIs(observation["medical_data_required"], False)
        self.assertIs(observation["scalar_human_score_allowed"], False)


if __name__ == "__main__":
    unittest.main()
