#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
SCHEMA = json.loads((ROOT / "copy-placement-plan.schema.json").read_text(encoding="utf-8"))

spec = importlib.util.spec_from_file_location("copy_placement_plan", ROOT / "copy_placement_plan.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

MAIN = "2a0fbd4d67e9db4913658da825336d2c4a8c2888"
TREE = "db02276c32a374eb80bae1ed3701762a9dda7c92"


class CopyPlacementPlanTests(unittest.TestCase):
    def validate(self, plan):
        Draft202012Validator(SCHEMA).validate(plan)
        mod.verify_plan(plan)

    def test_generated_plan_is_schema_valid(self):
        plan = mod.build_plan(MAIN, TREE)
        self.validate(plan)

    def test_same_frontier_is_deterministic(self):
        a = mod.build_plan(MAIN, TREE)
        b = mod.build_plan(MAIN, TREE)
        self.assertEqual(a, b)
        self.assertEqual(
            json.dumps(a, sort_keys=True, separators=(",", ":")),
            json.dumps(b, sort_keys=True, separators=(",", ":")),
        )

    def test_frontier_change_changes_digest(self):
        a = mod.build_plan(MAIN, TREE)
        b = mod.build_plan("0" * 40, TREE)
        self.assertNotEqual(a["plan_digest_sha256"], b["plan_digest_sha256"])

    def test_plan_objects_are_isolated(self):
        a = mod.build_plan(MAIN, TREE)
        a["copy_roles"][0]["role"] = "tampered"
        b = mod.build_plan(MAIN, TREE)
        self.assertEqual(b["copy_roles"][0]["role"], "active-local-copy")
        self.validate(b)

    def test_exact_three_copy_roles(self):
        plan = mod.build_plan(MAIN, TREE)
        self.assertEqual([x["slot_id"] for x in plan["copy_roles"]], ["copy-a", "copy-b", "copy-c"])

    def test_offline_role_is_mandatory(self):
        plan = mod.build_plan(MAIN, TREE)
        offline = [x for x in plan["copy_roles"] if x["offline_required"]]
        self.assertEqual(len(offline), 1)
        self.assertEqual(offline[0]["role"], "sealed-offline-copy")

    def test_two_explicit_custodian_roles_exist(self):
        plan = mod.build_plan(MAIN, TREE)
        roles = {x["custodian_role"] for x in plan["copy_roles"]}
        self.assertIn("custodian-role-a", roles)
        self.assertIn("custodian-role-b", roles)

    def test_all_three_pairs_require_evidence(self):
        plan = mod.build_plan(MAIN, TREE)
        pairs = {tuple(sorted((x["copy_a"], x["copy_b"]))) for x in plan["pairwise_independence_checks"]}
        self.assertEqual(
            pairs,
            {("copy-a", "copy-b"), ("copy-a", "copy-c"), ("copy-b", "copy-c")},
        )
        self.assertTrue(all(x["evidence_required"] for x in plan["pairwise_independence_checks"]))
        self.assertTrue(all(not x["independence_claimed_proven"] for x in plan["pairwise_independence_checks"]))

    def test_plan_never_claims_copy_presence(self):
        plan = mod.build_plan(MAIN, TREE)
        self.assertFalse(plan["boundary"]["copies_claimed_present"])
        self.assertTrue(all(not x["copy_claimed_present"] for x in plan["copy_roles"]))

    def test_authority_and_kontur_boundaries_are_false(self):
        plan = mod.build_plan(MAIN, TREE)
        for field in (
            "provider_mutation_authorized",
            "external_execution_authorized",
            "authority_transferred",
            "rescue_authorized",
            "failover_authorized",
            "canonical_successor_claimed",
            "kontur_activation_authorized",
        ):
            self.assertFalse(plan["boundary"][field])

    def test_human_completion_required(self):
        plan = mod.build_plan(MAIN, TREE)
        self.assertTrue(plan["boundary"]["human_completion_required"])
        self.assertEqual(plan["boundary"]["strongest_safe_effect"], "prepare_operator_copy_placement_only")

    def test_digest_tamper_fails_closed(self):
        plan = mod.build_plan(MAIN, TREE)
        plan["source_frontier"]["main_sha"] = "0" * 40
        with self.assertRaises(mod.PlanError):
            mod.verify_plan(plan)

    def test_topology_tamper_with_recomputed_digest_still_fails(self):
        plan = mod.build_plan(MAIN, TREE)
        plan["copy_roles"][0]["custodian_role"] = "custodian-role-b"
        unsigned = copy.deepcopy(plan)
        unsigned.pop("plan_digest_sha256")
        plan["plan_digest_sha256"] = mod.compute_digest(unsigned)
        with self.assertRaises(mod.PlanError):
            mod.verify_plan(plan)

    def test_policy_weakening_with_recomputed_digest_still_fails(self):
        plan = mod.build_plan(MAIN, TREE)
        plan["policy_binding"]["minimum_independent_copies"] = 2
        unsigned = copy.deepcopy(plan)
        unsigned.pop("plan_digest_sha256")
        plan["plan_digest_sha256"] = mod.compute_digest(unsigned)
        with self.assertRaises(mod.PlanError):
            mod.verify_plan(plan)

    def test_uppercase_sha_rejected(self):
        with self.assertRaises(mod.PlanError):
            mod.build_plan(MAIN.upper(), TREE)

    def test_short_sha_rejected(self):
        with self.assertRaises(mod.PlanError):
            mod.build_plan("abcd", TREE)

    def test_operator_evidence_fields_do_not_request_secret_material(self):
        plan = mod.build_plan(MAIN, TREE)
        forbidden = {"password", "token", "secret", "private_key", "totp", "passkey", "recovery_code", "session"}
        for field in plan["operator_evidence_fields"]:
            lowered = field.lower()
            self.assertFalse(any(word in lowered for word in forbidden), field)


if __name__ == "__main__":
    unittest.main()
