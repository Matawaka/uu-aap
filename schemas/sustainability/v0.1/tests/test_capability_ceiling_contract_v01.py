#!/usr/bin/env python3

import copy
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "capability-ceiling-contract.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "capability-ceiling-contract.example.json"

try:
    import jsonschema
except ImportError:  # local-only optional dependency
    jsonschema = None


class CapabilityCeilingContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.example = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))

    def validate(self, payload):
        if jsonschema is None:
            self.skipTest("jsonschema is not installed")
        jsonschema.Draft202012Validator(self.schema).validate(payload)

    def assert_invalid(self, payload):
        if jsonschema is None:
            self.skipTest("jsonschema is not installed")
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.Draft202012Validator(self.schema).validate(payload)

    def test_reference_example_validates(self):
        self.validate(self.example)

    def test_contract_has_no_authority_effect(self):
        self.assertEqual(self.example["authority_effect"], "none")
        self.assertFalse(self.example["external_execution_authorized"])

    def test_unlisted_capability_fails_closed(self):
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

    def test_unknown_or_denied_can_only_have_no_action(self):
        for result in ("unknown", "denied", "requires-fresh-authorization"):
            mutated = copy.deepcopy(self.example)
            mutated["assessment"]["result"] = result
            mutated["assessment"]["safe_effect"] = "no-action"
            self.validate(mutated)


if __name__ == "__main__":
    unittest.main()
