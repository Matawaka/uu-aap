#!/usr/bin/env python3
"""Adversarial boundaries and metamorphic checks for active verification."""
from __future__ import annotations

import copy
import unittest

import run_active_verification as av
from run_scenarios import digest, load_json, validator


def case(prefix):
    return load_json(next(av.EXPERIMENT_DIR.glob(f"{prefix}-*/config.json")))


class HiddenFieldsDenied(dict):
    def __getitem__(self, key):
        if key in ("oracle_only", "response_tape", "expected"):
            raise AssertionError(f"policy attempted to read hidden field {key}")
        return super().__getitem__(key)


class ActiveVerificationTests(unittest.TestCase):
    def test_gate_rejects_each_independent_authority_violation(self):
        c = case("V01")
        a, lease, budget = c["actions"][0], c["search_lease"], c["budget"]
        used = {"actions": 0, "cost": 0, "intrusion": 0, "scope_expansions": 0}
        mutations = [
            ("PROTECTED_RIGHTS_FLOOR", "action", {"rights_infringing": True}),
            ("PRIVACY_FLOOR", "action", {"intrusion_cost": 3}),
            ("AUTHORITY_MISSING", "action", {"authority_requirement": "ADMIN"}),
            ("ACTION_TYPE_NOT_AUTHORIZED", "lease", {"allowed_action_types": []}),
            ("UNCERTAINTY_CANNOT_EXPAND_SCOPE", "action",
             {"scope": {"reviewer": "r1", "dimension": "delegates"},
              "scope_extension_basis": "UNCERTAINTY"}),
            ("SCOPE_NOT_AUTHORIZED", "action",
             {"scope": {"reviewer": "r1", "dimension": "delegates"}}),
            ("NOT_YET_AVAILABLE", "action", {"not_before_cycle": 2}),
            ("ACTION_EXPIRED", "action", {"expires_cycle": 0}),
            ("ACTION_BUDGET", "budget", {"max_actions": 0}),
            ("COST_BUDGET", "budget", {"max_total_cost": 0}),
            ("INTRUSION_BUDGET", "used", {"intrusion": 4}),
            ("TIME_HORIZON", "budget", {"max_cycles": 0}),
            ("LEASE_EXPIRED", "lease", {"expires_cycle": 0}),
        ]
        for expected, target, values in mutations:
            with self.subTest(expected=expected):
                parts = dict(action=copy.deepcopy(a), lease=copy.deepcopy(lease),
                             budget=copy.deepcopy(budget), used=copy.deepcopy(used))
                parts[target].update(values)
                # EIV may be arbitrarily tempting without changing any gate.
                parts["action"]["expected_information_value"] = 1000
                actual = av.gate(parts["action"], parts["lease"], parts["budget"],
                                 parts["used"], 0, [], set())
                self.assertEqual(actual, expected)
        self.assertEqual(av.gate(a, lease, budget, used, 0, [], set()), "ALLOWED")

    def test_all_policy_executions_preserve_hard_budgets_and_rights(self):
        for path in sorted(av.EXPERIMENT_DIR.glob("V*/config.json")):
            c = load_json(path)
            for policy in av.POLICIES:
                with self.subTest(case=c["experiment_id"], policy=policy):
                    r = av.run_policy(c, policy)
                    m, b = r["metrics"], c["budget"]
                    self.assertLessEqual(m["verification_actions_used"], b["max_actions"])
                    self.assertLessEqual(m["total_search_cost"], b["max_total_cost"])
                    self.assertLessEqual(m["intrusion_cost"], b["max_intrusion_cost"])
                    self.assertLessEqual(m["scope_expansions"], b["max_scope_expansions"])
                    self.assertFalse(r["runtime_authority_created"])
                    self.assertFalse(r["decision_authority_created"])
                    for receipt in r["evidence_receipts"]:
                        a = next(a for a in c["actions"] if a["action_id"] == receipt["action_id"])
                        self.assertFalse(a["rights_infringing"])
                        self.assertLessEqual(a["intrusion_cost"],
                                             c["search_lease"]["max_per_action_intrusion"])
                        self.assertLess(receipt["started_cycle"], c["search_lease"]["expires_cycle"])
                        self.assertLessEqual(receipt["completed_cycle"], b["max_cycles"])
                        if receipt["admitted"]:
                            self.assertLess(receipt["completed_cycle"], c["search_lease"]["expires_cycle"])
                        child = {k: v for k, v in receipt.items() if k != "receipt_digest"}
                        self.assertEqual(digest(child), receipt["receipt_digest"])
                    if policy == "bounded_targeted":
                        self.assertNotEqual(m["search_termination_reason"], "HARNESS_WATCHDOG")

    def test_oracle_and_hypotheses_cannot_affect_execution(self):
        for prefix in ("V01", "V08", "V09", "V12", "V17", "V29"):
            c = case(prefix)
            mutant = copy.deepcopy(c)
            mutant["oracle_only"] = {"initial_control_edges": [], "events": [],
                                     "historical_capture": not c["oracle_only"]["historical_capture"]}
            mutant["expected"] = {"do_not_read": True}
            mutant["title_en"] = "Metadata cannot guide a decision"
            for policy in av.POLICIES:
                with self.subTest(case=prefix, policy=policy):
                    self.assertEqual(av.run_policy(c, policy), av.run_policy(mutant, policy))
                    # Executor is also callable without truth or expectations.
                    partial = {k: v for k, v in c.items() if k not in ("oracle_only", "expected")}
                    self.assertEqual(av.run_policy(c, policy), av.run_policy(partial, policy))

    def test_response_outcome_cannot_guide_first_query(self):
        c = case("V01")
        opposite = copy.deepcopy(c)
        for e in opposite["response_tape"]["a"][0]["evidence"]:
            e["assertion"] = av.DEP
        for policy in av.POLICIES:
            a, b = av.run_policy(c, policy), av.run_policy(opposite, policy)
            self.assertEqual(a["decisions"][0], b["decisions"][0])

    def test_policy_input_is_an_allowlist(self):
        c = case("V01")
        captured = []
        original = av.policy_decision
        def inspect(policy, view):
            self.assertEqual(set(view), av.PUBLIC_KEYS)
            self.assertNotIn("oracle_only", str(view))
            self.assertNotIn("response_tape", str(view))
            captured.append(copy.deepcopy(view))
            return original(policy, HiddenFieldsDenied(view))
        try:
            av.policy_decision = inspect
            av.run_policy(c, "bounded_targeted")
        finally:
            av.policy_decision = original
        view = captured[0]
        view["oracle_only"] = {}
        with self.assertRaisesRegex(ValueError, "unexpected policy-view"):
            original("bounded_targeted", view)

    def test_schema_rejects_unbounded_and_negative_budgets(self):
        schema = validator(load_json(av.CONFIG_SCHEMA))
        for field, value in (("max_actions", -1), ("max_total_cost", None),
                             ("max_intrusion_cost", 0.5), ("max_cycles", 1000000)):
            c = case("V01")
            c["budget"][field] = value
            with self.subTest(field=field):
                self.assertTrue(list(schema.iter_errors(c)))

    def test_semantics_reject_forged_and_out_of_scope_receipts(self):
        for mutation in ("retraction", "scope", "source", "duplicate", "negative", "unavailable",
                         "self_certification", "watchdog"):
            c = case("V03" if mutation == "retraction" else "V01")
            response = c["response_tape"]["a"][0]
            if mutation == "retraction":
                response["retractions"][0]["source"] = "s2"
            elif mutation == "scope":
                response["evidence"][0]["dimension"] = "delegates"
            elif mutation == "source":
                response["evidence"][0]["source"] = "unknown"
            elif mutation == "duplicate":
                c["actions"].append(copy.deepcopy(c["actions"][0]))
            elif mutation == "negative":
                response["outcome"] = "NOT_FOUND"
            elif mutation == "unavailable":
                response["outcome"] = "UNAVAILABLE"
            elif mutation == "self_certification":
                response["source_checks"] = copy.deepcopy(c["initial_source_checks"])
            elif mutation == "watchdog":
                c["watchdog_steps"] = c["budget"]["max_actions"]
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                av.validate_semantics(c)

    def test_same_source_repetition_is_not_independent_corroboration(self):
        r = av.run_policy(case("V10"), "bounded_targeted")
        self.assertEqual(r["metrics"]["nominal_evidence_gained"], 3)
        self.assertEqual(r["metrics"]["independent_support_units_gained"], 0)
        self.assertEqual(r["metrics"]["final_outcome"], "BOUNDED_INDETERMINATE")

    def test_negative_search_receipt_has_scope_and_ttl_without_clearance(self):
        r = av.run_policy(case("V09"), "bounded_targeted")
        e = r["evidence_receipts"][0]
        self.assertEqual(e["outcome"], "NOT_FOUND")
        self.assertEqual(e["scope"], {"reviewer": "r1", "dimension": "funds"})
        self.assertEqual(e["negative_search_valid_until"], e["completed_cycle"] + 2)
        self.assertEqual(e["evidence_ids"], [])
        self.assertEqual(r["metrics"]["independent_support_units_gained"], 0)
        self.assertEqual(r["metrics"]["final_epistemic_status"], "INDETERMINATE")

    def test_anomaly_cannot_self_renew_or_authorize_scope(self):
        c = case("V22")
        for mutation in ("no_anomaly", "no_extension", "uncertainty", "no_budget", "stale"):
            changed = copy.deepcopy(c)
            if mutation == "no_anomaly":
                changed["anomalies"] = []
            elif mutation == "no_extension":
                changed["search_lease"]["extension_scope"] = []
            elif mutation == "uncertainty":
                changed["actions"][0]["scope_extension_basis"] = "UNCERTAINTY"
            elif mutation == "no_budget":
                changed["budget"]["max_scope_expansions"] = 0
            elif mutation == "stale":
                changed["anomalies"][0]["issued_cycle"] = 2
            with self.subTest(mutation=mutation):
                r = av.run_policy(changed, "bounded_targeted")
                self.assertEqual(r["metrics"]["verification_actions_used"], 0)
                self.assertEqual(r["metrics"]["scope_expansions"], 0)
        r = av.run_policy(case("V30"), "bounded_targeted")
        self.assertFalse(r["evidence_receipts"][0]["admitted"])
        self.assertEqual(r["metrics"]["expired_responses"], 1)

    def test_expired_sources_do_not_support_a_claim(self):
        for prefix in ("V27", "V28"):
            r = av.run_policy(case(prefix), "bounded_targeted")
            self.assertEqual(r["snapshots"][-1]["assessment"]["unvetted_active_evidence_count"], 1)
            self.assertEqual(r["metrics"]["final_outcome"], "BOUNDED_INDETERMINATE")

    def test_false_positive_and_false_assurance_are_symmetric_and_oracle_only(self):
        for prefix, status, oracle_field in (
            ("V17", "PROVISIONAL_INDEPENDENCE", "false_assurance_observations"),
            ("V29", "CAPTURE_SIGNAL", "false_positive_capture_observations"),
        ):
            c = case(prefix)
            raw = av.run_policy(c, "bounded_targeted")
            self.assertNotIn("oracle_evaluation", raw)
            r = av.evaluate_oracle(c, raw)
            self.assertEqual(r["metrics"]["final_epistemic_status"], status)
            self.assertEqual(r["oracle_evaluation"][oracle_field], 1)
            self.assertFalse(r["decision_authority_created"])
            body = {k: v for k, v in r.items() if k != "receipt_digest"}
            self.assertEqual(digest(body), r["receipt_digest"])

    def test_initial_predictions_remain_frozen(self):
        first = load_json(av.EXPERIMENT_DIR / "initial-run-summary.json")
        for experiment_id, result in first["results"].items():
            c = case(experiment_id[:3])
            self.assertEqual(digest(c), result["bounded_targeted"]["config_digest"])
            now = av.run_policy(c, "bounded_targeted")
            # Follow-ups only clarified receipt scope and in-flight extension
            # admission. They do not change original 24 scenario observations.
            self.assertEqual(now["metrics"], result["bounded_targeted"]["metrics"])
            self.assertEqual(now["trace_digest"], result["bounded_targeted"]["trace_digest"])


if __name__ == "__main__":
    unittest.main()

