#!/usr/bin/env python3

import copy
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "capability-ceiling-contract.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "capability-ceiling-contract.example.json"
ASSESSOR_PATH = ROOT / "capability_ceiling_assessor.py"

try:
    import jsonschema
except ImportError as exc:  # fail closed: validation must not silently skip
    raise RuntimeError("jsonschema is required to validate this contract") from exc

spec = importlib.util.spec_from_file_location("capability_ceiling_assessor_v01", ASSESSOR_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load capability ceiling assessor")
ASSESSOR = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ASSESSOR)


class CapabilityCeilingContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
        cls.validator = jsonschema.Draft202012Validator(cls.schema)

    def validate(self, payload):
        self.validator.validate(payload)
        ASSESSOR.validate_semantics(payload)

    def assert_invalid(self, payload):
        with self.assertRaises((jsonschema.ValidationError, ASSESSOR.CapabilityCeilingSemanticError)):
            self.validate(payload)

    def test_reference_example_validates(self):
        self.validate(self.example)

    def test_contract_has_no_authority_effect(self):
        self.assertEqual(self.example["authority_effect"], "none")
        self.assertFalse(self.example["external_execution_authorized"])

    def test_unlisted_policy_fails_closed(self):
        self.assertEqual(
            self.example["capability_set"]["unlisted_policy"],
            "denied-until-fresh-authorization",
        )

    def test_recovery_cannot_expand_capability(self):
        mutated = copy.deepcopy(self.example)
        mutated["expansion_policy"]["recovery_implies_expansion"] = True
        self.assert_invalid(mutated)

    def test_handoff_cannot_transfer_authority(self):
        mutated = copy.deepcopy(self.example)
        mutated["expansion_policy"]["handoff_transfers_authority"] = True
        self.assert_invalid(mutated)

    def test_inactivity_cannot_become_consent(self):
        mutated = copy.deepcopy(self.example)
        mutated["expansion_policy"]["inactivity_is_consent"] = True
        self.assert_invalid(mutated)

    def test_denial_cannot_be_routed_around(self):
        mutated = copy.deepcopy(self.example)
        mutated["expansion_policy"]["denial_may_be_routed_around"] = True
        self.assert_invalid(mutated)

    def test_prior_authorization_cannot_imply_expansion(self):
        mutated = copy.deepcopy(self.example)
        mutated["expansion_policy"]["prior_authorization_implies_expansion"] = True
        self.assert_invalid(mutated)

    def test_fresh_attributable_authorization_is_required(self):
        mutated = copy.deepcopy(self.example)
        mutated["expansion_policy"]["requires_new_attributable_authorization"] = False
        self.assert_invalid(mutated)

    def test_contract_cannot_authorize_execution(self):
        mutated = copy.deepcopy(self.example)
        mutated["external_execution_authorized"] = True
        self.assert_invalid(mutated)

    def test_allowed_capability_maps_to_prepare_only(self):
        self.validate(self.example)
        mutated = copy.deepcopy(self.example)
        mutated["assessment"]["result"] = "denied"
        mutated["assessment"]["safe_effect"] = "no-action"
        self.assert_invalid(mutated)

    def test_denied_capability_maps_to_denied_no_action(self):
        payload = copy.deepcopy(self.example)
        payload["assessment"]["requested_capability"] = "activate-kontur"
        payload["assessment"]["result"] = "denied"
        payload["assessment"]["safe_effect"] = "no-action"
        self.validate(payload)

        payload["assessment"]["result"] = "within-ceiling"
        payload["assessment"]["safe_effect"] = "prepare-only"
        self.assert_invalid(payload)

    def test_unlisted_capability_requires_fresh_authorization(self):
        payload = copy.deepcopy(self.example)
        payload["assessment"]["requested_capability"] = "new-provider-capability"
        payload["assessment"]["result"] = "requires-fresh-authorization"
        payload["assessment"]["safe_effect"] = "no-action"
        self.validate(payload)

        payload["assessment"]["result"] = "within-ceiling"
        payload["assessment"]["safe_effect"] = "prepare-only"
        self.assert_invalid(payload)

    def test_allowed_and_denied_sets_must_be_disjoint(self):
        payload = copy.deepcopy(self.example)
        payload["capability_set"]["denied"].append("prepare-non-executing-artifacts")
        self.assert_invalid(payload)

    def test_unknown_result_is_not_a_valid_v01_state(self):
        payload = copy.deepcopy(self.example)
        payload["assessment"]["result"] = "unknown"
        payload["assessment"]["safe_effect"] = "no-action"
        self.assert_invalid(payload)

    def test_within_ceiling_requires_prepare_only(self):
        payload = copy.deepcopy(self.example)
        payload["assessment"]["safe_effect"] = "no-action"
        self.assert_invalid(payload)


if __name__ == "__main__":
    unittest.main()
