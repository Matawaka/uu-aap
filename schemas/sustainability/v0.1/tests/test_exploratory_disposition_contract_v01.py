#!/usr/bin/env python3

import copy
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "exploratory-disposition-contract.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "exploratory-disposition-contract.example.json"
sys.path.insert(0, str(ROOT))

import exploratory_disposition_assessor as assessor
import jsonschema


class ExploratoryDispositionContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        cls.validator = jsonschema.Draft202012Validator(cls.schema)

    def validate(self, payload):
        self.validator.validate(payload)
        return assessor.assess(payload)

    def assert_schema_invalid(self, payload):
        with self.assertRaises(jsonschema.ValidationError):
            self.validator.validate(payload)

    def assert_semantic_invalid(self, payload):
        self.validator.validate(payload)
        with self.assertRaises(ValueError):
            assessor.assess(payload)

    def test_reference_example_validates(self):
        result = self.validate(self.example)
        self.assertEqual(result["mode"], "selective-adoption")
        self.assertEqual(result["safe_effect"], "prepare-bounded-adoption-only")
        self.assertEqual(result["selected_artifact_count"], 1)
        self.assertFalse(result["integration_authorized"])

    def test_selective_adoption_requires_fresh_overlap_review(self):
        mutated = copy.deepcopy(self.example)
        mutated["review"]["fresh_overlap_review"] = False
        self.assert_semantic_invalid(mutated)

    def test_selective_adoption_requires_selected_artifact(self):
        mutated = copy.deepcopy(self.example)
        mutated["disposition"]["selected_artifacts"] = []
        self.assert_semantic_invalid(mutated)

    def test_wrong_safe_effect_rejected(self):
        mutated = copy.deepcopy(self.example)
        mutated["disposition"]["safe_effect"] = "archive-only"
        self.assert_semantic_invalid(mutated)

    def test_duplicate_source_path_rejected(self):
        mutated = copy.deepcopy(self.example)
        duplicate = copy.deepcopy(mutated["disposition"]["selected_artifacts"][0])
        duplicate["intended_target_path"] = "docs/other.md"
        duplicate["source_blob_sha"] = "3333333333333333333333333333333333333333"
        mutated["disposition"]["selected_artifacts"].append(duplicate)
        self.assert_semantic_invalid(mutated)

    def test_duplicate_target_path_rejected(self):
        mutated = copy.deepcopy(self.example)
        duplicate = copy.deepcopy(mutated["disposition"]["selected_artifacts"][0])
        duplicate["source_path"] = "docs/other.md"
        duplicate["source_blob_sha"] = "3333333333333333333333333333333333333333"
        mutated["disposition"]["selected_artifacts"].append(duplicate)
        self.assert_semantic_invalid(mutated)

    def test_non_adoption_modes_require_empty_selected_set(self):
        effects = {
            "preserve-isolated": "preserve-isolated-only",
            "archive": "archive-only",
            "reject": "preserve-provenance-only",
            "supersede": "preserve-provenance-only",
        }
        for mode, effect in effects.items():
            mutated = copy.deepcopy(self.example)
            mutated["disposition"]["mode"] = mode
            mutated["disposition"]["safe_effect"] = effect
            self.assert_semantic_invalid(mutated)

    def test_all_non_adoption_modes_validate_when_selection_empty(self):
        effects = {
            "preserve-isolated": "preserve-isolated-only",
            "archive": "archive-only",
            "reject": "preserve-provenance-only",
            "supersede": "preserve-provenance-only",
        }
        for mode, effect in effects.items():
            mutated = copy.deepcopy(self.example)
            mutated["disposition"]["mode"] = mode
            mutated["disposition"]["safe_effect"] = effect
            mutated["disposition"]["selected_artifacts"] = []
            result = self.validate(mutated)
            self.assertEqual(result["safe_effect"], effect)
            self.assertEqual(result["selected_artifact_count"], 0)

    def test_source_head_cannot_be_current_main(self):
        mutated = copy.deepcopy(self.example)
        mutated["source"]["source_head_sha"] = mutated["review"]["current_main_sha"]
        self.assert_semantic_invalid(mutated)

    def test_whole_branch_merge_entitlement_forbidden(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["whole_branch_merge_entitled"] = True
        self.assert_schema_invalid(mutated)

    def test_age_cannot_create_entitlement(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["exploratory_age_creates_entitlement"] = True
        self.assert_schema_invalid(mutated)

    def test_effort_cannot_create_entitlement(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["effort_creates_entitlement"] = True
        self.assert_schema_invalid(mutated)

    def test_historical_priority_cannot_create_entitlement(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["historical_priority_creates_entitlement"] = True
        self.assert_schema_invalid(mutated)

    def test_archive_cannot_be_execution_queue(self):
        mutated = copy.deepcopy(self.example)
        mutated["provenance_policy"]["archive_is_execution_queue"] = True
        self.assert_schema_invalid(mutated)

    def test_rejection_cannot_erase_history(self):
        mutated = copy.deepcopy(self.example)
        mutated["provenance_policy"]["rejection_erases_history"] = True
        self.assert_schema_invalid(mutated)

    def test_source_provenance_must_be_preserved(self):
        mutated = copy.deepcopy(self.example)
        mutated["provenance_policy"]["source_provenance_preserved"] = False
        self.assert_schema_invalid(mutated)

    def test_disposition_reason_must_be_preserved(self):
        mutated = copy.deepcopy(self.example)
        mutated["provenance_policy"]["disposition_reason_preserved"] = False
        self.assert_schema_invalid(mutated)

    def test_selected_artifacts_only_must_remain_true(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["selected_artifacts_only"] = False
        self.assert_schema_invalid(mutated)

    def test_main_dependency_cannot_be_created(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["main_dependency_created"] = True
        self.assert_schema_invalid(mutated)

    def test_contract_cannot_change_canonicality(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["canonicality_changed"] = True
        self.assert_schema_invalid(mutated)

    def test_contract_cannot_activate_kontur(self):
        mutated = copy.deepcopy(self.example)
        mutated["claims"]["kontur_activated"] = True
        self.assert_schema_invalid(mutated)

    def test_contract_has_no_authority_effect(self):
        mutated = copy.deepcopy(self.example)
        mutated["authority_effect"] = "integration"
        self.assert_schema_invalid(mutated)

    def test_contract_cannot_authorize_external_execution(self):
        mutated = copy.deepcopy(self.example)
        mutated["external_execution_authorized"] = True
        self.assert_schema_invalid(mutated)


if __name__ == "__main__":
    unittest.main()
