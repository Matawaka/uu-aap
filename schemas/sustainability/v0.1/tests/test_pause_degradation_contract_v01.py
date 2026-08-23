#!/usr/bin/env python3

import copy
import importlib.util
import json
import pathlib
import unittest

import jsonschema

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "pause-degradation-contract.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "pause-degradation-contract.example.json"
ASSESSOR_PATH = ROOT / "pause_degradation_assessor.py"

spec = importlib.util.spec_from_file_location("pause_degradation_assessor", ASSESSOR_PATH)
assessor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assessor)


class PauseDegradationContractTests(unittest.TestCase):
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
        with self.assertRaises(assessor.SemanticError):
            assessor.assess(payload)

    def variant(self, kind, result, effect):
        payload = copy.deepcopy(self.example)
        payload["interruption"]["kind"] = kind
        payload["classification"]["result"] = result
        payload["classification"]["safe_effect"] = effect
        return payload

    def test_reference_human_pause_validates(self):
        self.assertEqual(
            self.validate(self.example),
            {"result": "paused", "safe_effect": "preserve-only"},
        )

    def test_provider_degradation_validates(self):
        payload = self.variant(
            "provider_degradation", "degraded", "observe-and-preserve-only"
        )
        self.validate(payload)

    def test_context_loss_requires_recovery(self):
        payload = self.variant(
            "context_loss", "recovery-required", "invoke-recovery-contract-only"
        )
        self.validate(payload)

    def test_unknown_requires_recovery(self):
        payload = self.variant(
            "unknown", "recovery-required", "invoke-recovery-contract-only"
        )
        self.validate(payload)

    def test_human_pause_cannot_claim_degraded_effect(self):
        payload = self.variant(
            "human_pause", "degraded", "observe-and-preserve-only"
        )
        self.assert_semantic_invalid(payload)

    def test_degradation_cannot_skip_to_preserve_only(self):
        payload = self.variant(
            "provider_degradation", "paused", "preserve-only"
        )
        self.assert_semantic_invalid(payload)

    def test_context_loss_cannot_claim_pause(self):
        payload = self.variant("context_loss", "paused", "preserve-only")
        self.assert_semantic_invalid(payload)

    def test_pause_never_preserves_mutable_authorization(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["mutable_authorization_preserved"] = True
        self.assert_schema_invalid(payload)

    def test_pause_never_becomes_abandonment(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["pause_is_abandonment"] = True
        self.assert_schema_invalid(payload)

    def test_pause_never_becomes_authority_waiver(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["pause_is_authority_waiver"] = True
        self.assert_schema_invalid(payload)

    def test_inactivity_never_becomes_consent(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["inactivity_is_consent"] = True
        self.assert_schema_invalid(payload)

    def test_degradation_cannot_authorize_failover(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["degradation_authorizes_failover"] = True
        self.assert_schema_invalid(payload)

    def test_degradation_cannot_authorize_bypass(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["degradation_authorizes_bypass"] = True
        self.assert_schema_invalid(payload)

    def test_context_loss_cannot_authorize_rescue(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["context_loss_authorizes_rescue"] = True
        self.assert_schema_invalid(payload)

    def test_automatic_resume_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["invariants"]["automatic_resume"] = True
        self.assert_schema_invalid(payload)

    def test_recovery_resume_is_always_required_before_later_preparation(self):
        payload = copy.deepcopy(self.example)
        payload["classification"]["recovery_resume_required_before_later_preparation"] = False
        self.assert_schema_invalid(payload)

    def test_continuous_monitoring_is_forbidden(self):
        payload = copy.deepcopy(self.example)
        payload["interruption"]["continuous_monitoring_used"] = True
        self.assert_schema_invalid(payload)

    def test_contract_cannot_authorize_external_execution(self):
        payload = copy.deepcopy(self.example)
        payload["external_execution_authorized"] = True
        self.assert_schema_invalid(payload)

    def test_contract_has_no_authority_effect(self):
        payload = copy.deepcopy(self.example)
        payload["authority_effect"] = "resume-authorized"
        self.assert_schema_invalid(payload)


if __name__ == "__main__":
    unittest.main()
