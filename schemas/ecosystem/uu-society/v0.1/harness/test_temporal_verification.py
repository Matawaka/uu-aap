#!/usr/bin/env python3
"""Controlled timing, immutable source clocks and hostile renewal tests."""
import copy
import unittest

import run_temporal_verification as tv
from run_scenarios import digest, load_json, validator


def case(prefix):
    return load_json(next(tv.EXPERIMENT_DIR.glob(f"{prefix}-*/config.json")))


def request(c, state, cycle=1):
    return {
        "request_id": "test-request", "requester_id": c["authority"]["requester_id"],
        "prior_lease_id": c["search_lease"]["lease_id"],
        "scope": copy.deepcopy(c["search_lease"]["scope"]),
        "purpose": "EVIDENCE_SEARCH_ONLY", "assessment_digest": digest(state),
        "requested_cycle": cycle,
    }


def state(c, cycle=1, ttl=3):
    w = c["world"]
    return tv.assessment(c, cycle, {e["evidence_id"]: e for e in w["initial_evidence"]},
                         {e["edge_id"]: e for e in w["source_control_edges"]},
                         {e["source"]: e for e in w["initial_source_checks"]}, ttl)


class TemporalVerificationTests(unittest.TestCase):
    def test_fixed_calendars_and_all_lifetime_bounds(self):
        for path in sorted(tv.EXPERIMENT_DIR.glob("T*/config.json")):
            c = load_json(path)
            before = digest(c)
            for ttl in c["ttl_arms"]:
                for policy in tv.POLICIES:
                    with self.subTest(case=c["experiment_id"], ttl=ttl, policy=policy):
                        r = tv.execute(c, policy, ttl)
                        self.assertEqual(tv.invariants(c, r), [])
                        self.assertEqual([x["cycle"] for x in r["calendar"]], list(range(10)))
                        for e in r["evidence_receipts"]:
                            body = {k: v for k, v in e.items() if k != "receipt_digest"}
                            self.assertEqual(digest(body), e["receipt_digest"])
                        for e in r["reauthorization_receipts"]:
                            body = {k: v for k, v in e.items() if k != "receipt_digest"}
                            self.assertEqual(digest(body), e["receipt_digest"])
            self.assertEqual(digest(c), before, "execution mutated the shared world")

    def test_ordering_changes_coverage_without_changing_tape_or_cost(self):
        c = case("T01")
        baseline = tv.evaluate(c, tv.execute(c, "bounded_targeted", 3))
        deadline = tv.evaluate(c, tv.execute(c, "deadline_aware", 3))
        def queries(r):
            return [x["decision"]["action_id"] for x in r["decisions"] if x["decision"]["kind"] == "ACTION"]
        self.assertEqual(queries(baseline), ["a_short", "b_long"])
        self.assertEqual(queries(deadline), ["b_long", "a_short"])
        self.assertEqual(baseline["metrics"]["outcome_at_search_stop"], "BOUNDED_INDETERMINATE")
        self.assertEqual(deadline["metrics"]["outcome_at_search_stop"], "PROVISIONAL_INDEPENDENCE")
        self.assertEqual(baseline["metrics"]["search_cost"], deadline["metrics"]["search_cost"])
        self.assertEqual(baseline["publication_tape_digest"], deadline["publication_tape_digest"])
        self.assertEqual(baseline["world_digest"], deadline["world_digest"])

    def test_paired_ttl_changes_false_assurance_on_equal_clock(self):
        c = case("T06")
        for policy in tv.POLICIES:
            values = [tv.evaluate(c, tv.execute(c, policy, ttl)) for ttl in (1, 3, 6)]
            self.assertEqual([r["oracle_evaluation"]["false_assurance_cycles"] for r in values], [0, 1, 4])
            self.assertEqual([r["metrics"]["verification_actions_used"] for r in values], [0, 0, 0])
            self.assertEqual(len({r["world_digest"] for r in values}), 1)
            self.assertEqual([len(r["calendar"]) for r in values], [10, 10, 10])

    def test_source_validity_caps_evaluation_ttl(self):
        c = case("T00")
        for e in c["world"]["initial_evidence"]:
            e["ttl_cycles"] = 2
        for policy in tv.POLICIES:
            r = tv.execute(c, policy, 6)
            self.assertEqual(r["metrics"]["provisional_cycles"], 2)

    def test_old_publication_is_not_refreshed_by_fetch(self):
        c = case("T02")
        r = tv.execute(c, "deadline_aware", 3)
        e = r["evidence_receipts"][0]
        self.assertEqual(e["completed_cycle"], 3)
        self.assertEqual(list(e["source_issue_cycles"].values()), [0])
        self.assertEqual(len(e["stale_evidence_ids"]), 1)
        self.assertEqual(e["fresh_evidence_ids"], [])
        self.assertEqual(r["metrics"]["outcome_at_search_stop"], "BOUNDED_INDETERMINATE")
        # Reacquiring the exact initial publication does not create a new item
        # and cannot change its issue time or TTL.
        repeated = copy.deepcopy(c)
        repeated["world"]["response_publications"]["a"][0]["response"]["evidence"] = [
            copy.deepcopy(c["world"]["initial_evidence"][0])]
        r = tv.execute(repeated, "deadline_aware", 3)
        self.assertEqual(r["metrics"]["unique_evidence_gained"], 0)
        self.assertEqual(r["metrics"]["evidence_items_received"], 1)
        self.assertEqual(r["metrics"]["stale_items_received"], 1)

    def test_stopping_does_not_freeze_the_epistemic_claim(self):
        c = case("T00")
        r = tv.execute(c, "deadline_aware", 3)
        self.assertEqual(r["metrics"]["search_stop_cycle"], 0)
        self.assertEqual(r["metrics"]["status_at_search_stop"], "PROVISIONAL_INDEPENDENCE")
        self.assertEqual(r["metrics"]["status_at_horizon"], "INDETERMINATE")
        self.assertEqual(len(r["decisions"]), 1)
        self.assertTrue(all(x["search_stopped"] for x in r["calendar"]))

    def test_oracle_and_claims_are_not_executor_inputs(self):
        for prefix in ("T01", "T06", "T07", "T08", "T15"):
            c = case(prefix)
            stripped = copy.deepcopy(c)
            del stripped["world"]["oracle_only"]
            del stripped["claims"]
            for policy in tv.POLICIES:
                with self.subTest(case=prefix, policy=policy):
                    self.assertEqual(tv.execute(c, policy, 3), tv.execute(stripped, policy, 3))

    def test_future_publications_and_private_latency_do_not_guide_first_query(self):
        c = case("T01")
        changed = copy.deepcopy(c)
        changed["world"]["actual_duration_cycles"]["b_long"] = 5
        for tape in changed["world"]["response_publications"].values():
            for publication in tape:
                for e in publication["response"]["evidence"]:
                    e["assertion"] = tv.av.DEP
        for policy in tv.POLICIES:
            a, b = tv.execute(c, policy, 3), tv.execute(changed, policy, 3)
            self.assertEqual(a["decisions"][0], b["decisions"][0])

    def test_forecast_is_not_a_latency_oracle(self):
        c = case("T04")
        for policy in tv.POLICIES:
            r = tv.execute(c, policy, 3)
            self.assertEqual(r["metrics"]["canceled_queries"], 1)
            self.assertEqual(r["evidence_receipts"][0]["outcome"], "CANCELLED_AT_EXPIRY")
            self.assertFalse(r["evidence_receipts"][0]["admitted"])
            self.assertEqual(r["evidence_receipts"][0]["received_evidence_ids"], [])

    def test_policy_view_rejects_future_and_oracle_fields(self):
        c = case("T03")
        captured = []
        original = tv.choose
        def inspect(policy, view):
            self.assertEqual(set(view), tv.VIEW_KEYS)
            self.assertEqual(set(view["legacy"]), tv.av.PUBLIC_KEYS)
            forbidden = {"oracle_only", "claims", "response_publications", "actual_duration_cycles"}
            def walk(value):
                if isinstance(value, dict):
                    self.assertFalse(set(value) & forbidden)
                    for child in value.values():
                        walk(child)
                elif isinstance(value, list):
                    for child in value:
                        walk(child)
            walk(view)
            captured.append(copy.deepcopy(view))
            return original(policy, view)
        try:
            tv.choose = inspect
            tv.execute(c, "deadline_aware_reauthorized", 3)
        finally:
            tv.choose = original
        captured[0]["oracle_only"] = {}
        with self.assertRaisesRegex(ValueError, "unexpected temporal policy view"):
            original("deadline_aware", captured[0])

    def test_authority_gate_needs_no_oracle_or_response_tape(self):
        c = case("T03")
        initial = state(c)
        req = request(c, initial)
        partial = {
            "experiment_id": c["experiment_id"], "authority": copy.deepcopy(c["authority"]),
            "world": {"epistemic_scope": copy.deepcopy(c["world"]["epistemic_scope"])},
            "horizon_cycles": c["horizon_cycles"],
        }
        expected = tv.renewal_decision(req, c, c["search_lease"], 2, 0, initial, initial)
        actual = tv.renewal_decision(req, partial, c["search_lease"], 2, 0, initial, initial)
        self.assertEqual(actual, expected)
        self.assertEqual(actual[0], "GRANTED")

    def test_independent_renewal_request_binding_is_immutable(self):
        c = case("T03")
        r = tv.execute(c, "deadline_aware_reauthorized", 3)
        renewal = r["reauthorization_receipts"][0]
        requested = renewal["request"]
        self.assertEqual(requested["requested_cycle"], 1)
        self.assertEqual(renewal["decision_cycle"], 2)
        self.assertEqual(requested["assessment_digest"], digest(state(c, 1, 3)))
        self.assertEqual(renewal["decision_assessment_digest"], digest(state(c, 2, 3)))
        self.assertEqual(renewal["lifetime_budget_digest"], digest(c["budget"]))
        self.assertEqual(renewal["new_lease"]["max_per_action_intrusion"],
                         c["search_lease"]["max_per_action_intrusion"])

    def test_malformed_and_hostile_renewal_requests_are_denied(self):
        base = case("T03")
        original = state(base)
        mutations = ("self", "shared_origin", "purpose", "identity", "binding",
                     "scope", "budget_override", "premature", "expired", "limit")
        for mutation in mutations:
            c = copy.deepcopy(base)
            req = request(c, original)
            grants = 0
            if mutation == "self":
                c["authority"]["issuer_id"] = c["authority"]["requester_id"]
            elif mutation == "shared_origin":
                c["authority"]["observed_control_edges"] = [
                    {"edge_id": "i", "from": "origin", "to": "independent-issuer", "kind": "funds"},
                    {"edge_id": "r", "from": "origin", "to": "searcher", "kind": "funds"},
                ]
            elif mutation == "purpose":
                req["purpose"] = "PUNISH"
            elif mutation == "identity":
                req["requester_id"] = "impostor"
            elif mutation == "binding":
                req["assessment_digest"] = "0" * 64
            elif mutation == "scope":
                req["scope"] = [{"reviewer": "r1", "dimension": "delegates"}]
            elif mutation == "budget_override":
                req["reset_budget"] = True
            elif mutation == "premature":
                req["requested_cycle"] = 0
            elif mutation == "expired":
                c["authority"]["expires_cycle"] = 2
            elif mutation == "limit":
                grants = c["authority"]["max_grants"]
            before = copy.deepcopy(req)
            with self.subTest(mutation=mutation):
                reason, lease = tv.renewal_decision(req, c, c["search_lease"], 2, grants, original, original)
                self.assertNotEqual(reason, "GRANTED")
                self.assertIsNone(lease)
                self.assertEqual(req, before)

    def test_issuer_rechecks_current_need_without_rewriting_the_request(self):
        c = case("T03")
        original = state(c)
        req = request(c, original)
        current = copy.deepcopy(original)
        current["status"] = "PROVISIONAL_INDEPENDENCE"
        reason, lease = tv.renewal_decision(req, c, c["search_lease"], 2, 0, current, original)
        self.assertEqual(reason, "NO_UNFINISHED_GAP")
        self.assertIsNone(lease)
        self.assertEqual(req["assessment_digest"], digest(original))

    def test_renewal_cannot_reset_budgets_relax_privacy_or_inflate_scope(self):
        for prefix in ("T11", "T12", "T13"):
            c = case(prefix)
            r = tv.execute(c, "deadline_aware_reauthorized", 3)
            self.assertEqual(r["metrics"]["verification_actions_used"], 0)
            self.assertEqual(r["metrics"]["renewal_grants"], 0)
        r = tv.execute(case("T15"), "deadline_aware_reauthorized", 3)
        self.assertEqual(r["metrics"]["reauthorization_requests"], 2)
        self.assertEqual(r["metrics"]["renewal_grants"], 1)
        self.assertEqual(r["metrics"]["renewal_denials"], 1)
        self.assertEqual(r["metrics"]["authority_review_cost"], 2)
        self.assertEqual(r["metrics"]["verification_actions_used"], 0)
        # An actual renewed query consumes the same cumulative intrusion pool.
        # Renewal does not replenish it for a second query.
        c = case("T03")
        c["budget"]["max_intrusion_cost"] = 1
        for action in c["world"]["actions"]:
            action["intrusion_cost"] = 1
        r = tv.execute(c, "deadline_aware_reauthorized", 3)
        self.assertEqual(r["metrics"]["renewal_grants"], 1)
        self.assertEqual(r["metrics"]["verification_actions_used"], 1)
        self.assertEqual(r["metrics"]["lifetime_intrusion"], 1)
        self.assertEqual(r["metrics"]["outcome_at_search_stop"], "BOUNDED_INDETERMINATE")

    def test_source_checks_have_an_independent_freshness_window(self):
        c = case("T05")
        for ttl in c["ttl_arms"]:
            r = tv.execute(c, "deadline_aware", ttl)
            self.assertEqual(r["metrics"]["outcome_at_search_stop"], "BOUNDED_INDETERMINATE")
            self.assertGreater(r["calendar"][2]["assessment"]["unvetted_active_evidence_count"], 0)

    def test_schema_and_semantics_reject_bad_clocks_and_identity_rewrites(self):
        cs = validator(load_json(tv.CONFIG_SCHEMA))
        for mutation in ("negative_ttl", "future_publication", "identity", "horizon",
                         "source", "duplicate_claim", "self_certification"):
            c = case("T02")
            if mutation == "negative_ttl":
                c["ttl_arms"] = [-1]
                self.assertTrue(list(cs.iter_errors(c)))
                continue
            p = c["world"]["response_publications"]["a"][0]
            if mutation == "future_publication":
                p["response"]["evidence"][0]["issued_cycle"] = 1
            elif mutation == "identity":
                item = copy.deepcopy(c["world"]["initial_evidence"][0])
                item["assertion"] = tv.av.DEP
                p["response"]["evidence"] = [item]
            elif mutation == "horizon":
                c["budget"]["max_cycles"] = c["horizon_cycles"]
            elif mutation == "source":
                p["response"]["evidence"][0]["source"] = "unknown"
            elif mutation == "duplicate_claim":
                c["claims"].append(copy.deepcopy(c["claims"][0]))
            elif mutation == "self_certification":
                p["response"]["source_checks"] = copy.deepcopy(c["world"]["initial_source_checks"])
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                tv.validate_semantics(c)

    def test_claim_refutation_is_retained_as_research_output(self):
        for prefix, claim in (
            ("T01", "deadline-always-verifies"),
            ("T04", "deadlines-prevent-all-cancellations"),
            ("T07", "renewed-evidence-guarantees-truth"),
        ):
            c = case(prefix)
            receipts = {f"{ttl}/{p}": tv.evaluate(c, tv.execute(c, p, ttl))
                        for ttl in c["ttl_arms"] for p in tv.POLICIES}
            result = next(x for x in tv.claim_results(c, receipts) if x["claim_id"] == claim)
            self.assertEqual(result["verdict"], "REFUTED")

    def test_complete_receipt_digest_and_oracle_symmetry(self):
        c = case("T08")
        raw = tv.execute(c, "deadline_aware_reauthorized", 3)
        self.assertNotIn("oracle_evaluation", raw)
        captured = tv.evaluate(c, copy.deepcopy(raw))
        independent = copy.deepcopy(c)
        independent["world"]["oracle_only"]["events"] = []
        false_positive = tv.evaluate(independent, copy.deepcopy(raw))
        self.assertGreater(captured["oracle_evaluation"]["capture_discovery_cycles"], 0)
        self.assertGreater(false_positive["oracle_evaluation"]["false_positive_capture_cycles"], 0)
        for r in (captured, false_positive):
            self.assertFalse(r["decision_authority_created"])
            body = {k: v for k, v in r.items() if k != "receipt_digest"}
            self.assertEqual(digest(body), r["receipt_digest"])
        self.assertEqual(captured["trace_digest"], false_positive["trace_digest"])

    def test_original_experiment_and_claims_remain_frozen(self):
        first = load_json(tv.EXPERIMENT_DIR / "initial-run-summary.json")
        for path in sorted(tv.EXPERIMENT_DIR.glob("T*/config.json")):
            c = load_json(path)
            receipts = {f"ttl-{ttl}/{p}": tv.evaluate(c, tv.execute(c, p, ttl))
                        for ttl in c["ttl_arms"] for p in tv.POLICIES}
            now = {"arms": tv.summary(receipts), "claims": tv.claim_results(c, receipts)}
            self.assertEqual(now, first["results"][c["experiment_id"]])


if __name__ == "__main__":
    unittest.main()

