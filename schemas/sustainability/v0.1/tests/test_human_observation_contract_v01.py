#!/usr/bin/env python3

import copy
import importlib.util
import json
import pathlib
import unittest

import jsonschema

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "human-observation-contract.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "human-observation-contract.example.json"
ASSESSOR_PATH = ROOT / "human_observation_assessor.py"

spec = importlib.util.spec_from_file_location("human_observation_assessor", ASSESSOR_PATH)
assessor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assessor)


class HumanObservationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        cls.validator = jsonschema.Draft202012Validator(cls.schema)

    def validate(self, payload):
        self.validator.validate(payload)

    def assert_schema_invalid(self, payload):
        with self.assertRaises(jsonschema.ValidationError):
            self.validator.validate(payload)

    def assert_assessor_invalid(self, payload):
        with self.assertRaises(ValueError):
            assessor.assess(payload)

    def test_reference_example_validates_and_assesses(self):
        self.validate(self.example)
        self.assertEqual(
            assessor.assess(self.example),
            {"result": "adaptation-suggested", "safe_effect": "reduce-decision-density"},
        )

    def test_empty_signals_are_stable(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = []
        payload["assessment"] = {"result": "stable", "safe_effect": "no-change"}
        self.validate(payload)
        self.assertEqual(assessor.assess(payload)["result"], "stable")

    def test_explicit_pause_has_highest_priority(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["explicit_pause_request", "high_decision_density", "repeated_retries"]
        payload["assessment"] = {"result": "explicit-pause", "safe_effect": "honor-explicit-pause"}
        self.validate(payload)
        self.assertEqual(assessor.assess(payload)["safe_effect"], "honor-explicit-pause")

    def test_explicit_reduce_pace(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["explicit_reduce_pace_request"]
        payload["assessment"] = {"result": "adaptation-suggested", "safe_effect": "reduce-decision-density"}
        self.validate(payload)
        assessor.assess(payload)

    def test_retries_suggest_checkpoint(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["repeated_retries"]
        payload["assessment"] = {"result": "adaptation-suggested", "safe_effect": "suggest-checkpoint"}
        self.validate(payload)
        assessor.assess(payload)

    def test_corrections_suggest_checkpoint(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["repeated_corrections"]
        payload["assessment"] = {"result": "adaptation-suggested", "safe_effect": "suggest-checkpoint"}
        self.validate(payload)
        assessor.assess(payload)

    def test_looping_suggests_checkpoint(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["interaction_looping"]
        payload["assessment"] = {"result": "adaptation-suggested", "safe_effect": "suggest-checkpoint"}
        self.validate(payload)
        assessor.assess(payload)

    def test_window_over_60_minutes_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["observation_window"]["ended_at"] = "2026-08-23T18:01:00Z"
        self.validate(payload)
        self.assert_assessor_invalid(payload)

    def test_window_reverse_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["observation_window"]["ended_at"] = "2026-08-23T16:59:59Z"
        self.validate(payload)
        self.assert_assessor_invalid(payload)

    def test_naive_timestamp_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["observation_window"]["started_at"] = "2026-08-23T17:00:00"
        self.assert_assessor_invalid(payload)

    def test_event_count_over_limit_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["observation_window"]["event_count"] = 101
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_duplicate_signals_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["high_decision_density", "high_decision_density"]
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_unsupported_signal_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["signals"] = ["fatigue"]
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_mismatched_result_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["assessment"]["result"] = "stable"
        self.validate(payload)
        self.assert_assessor_invalid(payload)

    def test_mismatched_effect_rejected(self):
        payload = copy.deepcopy(self.example)
        payload["assessment"]["safe_effect"] = "suggest-checkpoint"
        self.validate(payload)
        self.assert_assessor_invalid(payload)

    def test_provocation_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["provocation_used"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_medical_inference_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["medical_inference"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_biometric_inference_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["biometric_inference"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_hidden_psychological_scoring_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["hidden_psychological_scoring"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_fitness_determination_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["fitness_determination"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_authority_reduction_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["authority_reduction_allowed"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_automatic_external_action_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["automatic_external_action"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_continuous_monitoring_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["observation_window"]["continuous_monitoring"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_policy_continuous_monitoring_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["continuous_monitoring"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_sensitive_health_storage_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["stores_sensitive_health_data"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_hidden_adaptation_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["policy"]["user_visible_adaptation_only"] = False
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_authority_effect_cannot_change(self):
        payload = copy.deepcopy(self.example)
        payload["authority_effect"] = "reduced"
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_capability_effect_cannot_change(self):
        payload = copy.deepcopy(self.example)
        payload["capability_effect"] = "reduced"
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_external_execution_cannot_be_authorized(self):
        payload = copy.deepcopy(self.example)
        payload["external_execution_authorized"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)

    def test_kontur_activation_cannot_be_authorized(self):
        payload = copy.deepcopy(self.example)
        payload["kontur_activation_authorized"] = True
        self.assert_schema_invalid(payload)
        self.assert_assessor_invalid(payload)


if __name__ == "__main__":
    unittest.main()
