#!/usr/bin/env python3
"""Active Institutional Verification / Bounded Evidence Search v1.1.

Pure policies receive an allowlisted public view. The executor owns response
tapes; only post-hoc evaluation reads the synthetic truth graph. No runtime
authority, surveillance, adverse action, person score, or Stable Core promotion.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any

from run_institutional_epistemics import (
    DEP, NO_DEP, active_evidence, actual_independence, assess,
    connected_source_clusters,
)
from run_scenarios import digest, format_errors, load_json, validator

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT_DIR = ROOT / "active_verification"
CONFIG_SCHEMA = ROOT / "active-verification.config.schema.json"
RECEIPT_SCHEMA = ROOT / "active-verification.receipt.schema.json"
POLICIES = ("passive", "bounded_targeted", "suspicion_expanding")
ACTION_TYPES = (
    "REQUEST_FRESH_ATTESTATION", "REQUEST_SECOND_SOURCE",
    "CHECK_SOURCE_INDEPENDENCE", "REVERIFY_CONTROL_EDGE",
    "RESOLVE_CONTRADICTION", "DISCOVER_SOURCE_CONTROL_ORIGIN",
    "WAIT_FOR_FRESH_EVIDENCE",
)
PUBLIC_KEYS = {
    "cycle", "assessment", "actions", "source_checks", "anomalies",
    "attempts", "eligible_ids", "gate_reasons", "remaining", "lease_expires",
}


def slot(value):
    return value["reviewer"], value["dimension"]


def fresh(item, cycle):
    return item["issued_cycle"] <= cycle < item["issued_cycle"] + item["ttl_cycles"]


def unique(items, key):
    ids = [item[key] for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError(f"duplicate {key}")


def validate_semantics(config):
    """Reject malformed references before any policy or simulated action."""
    s = config["epistemic_scope"]
    nodes, sources = set(s["nodes"]), set(s["source_nodes"])
    if not set(s["reviewers"]) <= nodes or s["beneficiary"] not in nodes:
        raise ValueError("unknown institutional node")
    if s["source_quorum"] > len(sources) or s["review_quorum"] > len(s["reviewers"]):
        raise ValueError("impossible quorum")
    valid_slots = {(r, d) for r in s["reviewers"] for d in s["control_dimensions"]}
    lease = config["search_lease"]
    primary = {slot(x) for x in lease["scope"]}
    extension = {slot(x) for x in lease["extension_scope"]}
    if not primary or not primary <= valid_slots or not extension <= valid_slots:
        raise ValueError("lease scope outside declared assessment universe")
    if primary & extension:
        raise ValueError("extension duplicates primary scope")
    if lease["issued_cycle"] >= lease["expires_cycle"]:
        raise ValueError("empty lease interval")
    if lease["issued_cycle"] != 0:
        raise ValueError("this experiment starts with a cycle-zero lease")
    if config["watchdog_steps"] <= config["budget"]["max_actions"]:
        raise ValueError("watchdog must allow bounded policy to reach its own stop")
    unique(config["actions"], "action_id")
    unique(config["initial_evidence"], "evidence_id")
    unique(config["initial_source_control_edges"], "edge_id")
    unique(config["initial_source_checks"], "source")
    unique(config["anomalies"], "anomaly_id")
    if set(config["response_tape"]) != {a["action_id"] for a in config["actions"]}:
        raise ValueError("response tape must cover exactly the declared actions")
    evidence_by_id = {e["evidence_id"]: e for e in config["initial_evidence"]}

    def check_evidence(e):
        if slot(e) not in valid_slots or e["source"] not in sources:
            raise ValueError("unknown evidence slot or source")

    def check_edge(e, allowed):
        if e["from"] not in allowed or e["to"] not in allowed:
            raise ValueError("unknown edge endpoint")

    for e in config["initial_evidence"]:
        check_evidence(e)
        if e["issued_cycle"] > 0:
            raise ValueError("future initial evidence")
    for e in config["initial_source_control_edges"]:
        check_edge(e, nodes | sources)
    for c in config["initial_source_checks"]:
        if c["source"] not in sources or c["issued_cycle"] > 0:
            raise ValueError("invalid initial source check")
    anomaly_ids = {a["anomaly_id"] for a in config["anomalies"]}
    for a in config["anomalies"]:
        if slot(a) not in valid_slots:
            raise ValueError("anomaly outside assessment universe")
    for a in config["actions"]:
        if slot(a["scope"]) not in valid_slots or a["source"] not in sources:
            raise ValueError("unknown action scope or source")
        if a["anomaly_ref"] and a["anomaly_ref"] not in anomaly_ids:
            raise ValueError("unknown anomaly reference")
        for response in config["response_tape"][a["action_id"]]:
            unique(response["evidence"], "evidence_id")
            unique(response["source_edges"], "edge_id")
            for e in response["evidence"]:
                check_evidence(e)
                if slot(e) != slot(a["scope"]):
                    raise ValueError("response exceeds action scope")
                # Source checks and record aggregation can disclose multiple sources,
                # but one action cannot retract a different author's statement.
                if e["evidence_id"] in evidence_by_id:
                    raise ValueError("reused evidence identity in tape")
                evidence_by_id[e["evidence_id"]] = e
            for e in response["source_edges"]:
                check_edge(e, nodes | sources)
            if response["source_checks"] and a["type"] not in (
                "CHECK_SOURCE_INDEPENDENCE", "DISCOVER_SOURCE_CONTROL_ORIGIN"
            ):
                raise ValueError("attestation cannot self-certify source independence")
            if response["source_edges"] and a["type"] not in (
                "CHECK_SOURCE_INDEPENDENCE", "DISCOVER_SOURCE_CONTROL_ORIGIN"
            ):
                raise ValueError("unexpected source-control disclosure")
            for c in response["source_checks"]:
                if c["source"] not in sources:
                    raise ValueError("unknown checked source")
            for retraction in response["retractions"]:
                old = evidence_by_id.get(retraction["evidence_id"])
                if (
                    not old or a["type"] != "RESOLVE_CONTRADICTION"
                    or retraction["source"] != old["source"]
                    or slot(old) != slot(a["scope"])
                ):
                    raise ValueError("unattributed or out-of-scope retraction")
            if response["outcome"] in ("NOT_FOUND", "UNAVAILABLE") and (
                response["evidence"] or response["retractions"]
                or response["source_edges"] or response["source_checks"]
            ):
                raise ValueError("negative or unavailable search cannot assert independence")
    oracle = config["oracle_only"]
    unique(oracle["initial_control_edges"], "edge_id")
    for e in oracle["initial_control_edges"]:
        check_edge(e, nodes)
    for e in oracle["events"]:
        if e["type"] == "ADD":
            check_edge(e["edge"], nodes)


def epistemic_snapshot(scope, cycle, evidence, edges, checks):
    """Reuse v1.0; additionally require a fresh source-provenance check."""
    current = {key: value for key, value in evidence.items()
               if value["source"] in checks and fresh(checks[value["source"]], cycle)}
    result = assess(scope, cycle, current, edges)
    raw_active = active_evidence(cycle, evidence)
    result["nominal_active_evidence_count"] = len(raw_active)
    result["unvetted_active_evidence_count"] = sum(
        e["source"] not in checks or not fresh(checks[e["source"]], cycle)
        for e in raw_active
    )
    result["independent_support_units"] = sum(
        x["negative_independent_clusters"] + x["positive_independent_clusters"]
        for x in result["slots"]
    )
    result["freshness_remaining_cycles"] = min(
        (e["issued_cycle"] + e["ttl_cycles"] - cycle
         for e in raw_active if e["source"] in current_sources(current, cycle)),
        default=0,
    )
    result["source_check_remaining_cycles"] = min(
        (c["issued_cycle"] + c["ttl_cycles"] - cycle
         for c in checks.values() if fresh(c, cycle)), default=0,
    )
    return result


def current_sources(evidence, cycle):
    return {e["source"] for e in active_evidence(cycle, evidence)}


def gate(action, lease, budget, used, cycle, anomalies, expanded):
    """Independent enforcement. Neither EIV nor uncertainty changes a right."""
    if cycle < lease["issued_cycle"] or cycle >= lease["expires_cycle"]:
        return "LEASE_EXPIRED"
    if action["rights_infringing"]:
        return "PROTECTED_RIGHTS_FLOOR"
    if action["intrusion_cost"] > lease["max_per_action_intrusion"]:
        return "PRIVACY_FLOOR"
    if action["type"] not in lease["allowed_action_types"]:
        return "ACTION_TYPE_NOT_AUTHORIZED"
    if action["authority_requirement"] not in lease["authority_requirements"]:
        return "AUTHORITY_MISSING"
    target = slot(action["scope"])
    primary = {slot(x) for x in lease["scope"]}
    extension = {slot(x) for x in lease["extension_scope"]}
    if target not in primary:
        if action["scope_extension_basis"] == "UNCERTAINTY":
            return "UNCERTAINTY_CANNOT_EXPAND_SCOPE"
        matching = [a for a in anomalies
                    if a["anomaly_id"] == action["anomaly_ref"]
                    and slot(a) == target and fresh(a, cycle)]
        if (
            target not in extension or action["scope_extension_basis"] != "FRESH_ANOMALY"
            or not matching
        ):
            return "SCOPE_NOT_AUTHORIZED"
        if target not in expanded and used["scope_expansions"] >= budget["max_scope_expansions"]:
            return "SCOPE_EXPANSION_BUDGET"
    if cycle < action["not_before_cycle"]:
        return "NOT_YET_AVAILABLE"
    if cycle >= action["expires_cycle"]:
        return "ACTION_EXPIRED"
    if used["actions"] >= budget["max_actions"]:
        return "ACTION_BUDGET"
    if used["cost"] + action["cost"] > budget["max_total_cost"]:
        return "COST_BUDGET"
    if used["intrusion"] + action["intrusion_cost"] > budget["max_intrusion_cost"]:
        return "INTRUSION_BUDGET"
    if cycle + action["duration_cycles"] > budget["max_cycles"]:
        return "TIME_HORIZON"
    # The completion check is deliberately separate: an in-flight action can
    # consume resources but its response cannot be admitted after lease expiry.
    return "ALLOWED"


def policy_decision(policy, view):
    """Pure function: no oracle, response tapes, expected results, or config."""
    if set(view) != PUBLIC_KEYS:
        raise ValueError("unexpected policy-view keys")
    status = view["assessment"]["status"]
    if policy == "passive":
        return {"kind": "STOP", "reason": "PASSIVE"}
    actions = view["actions"]
    if policy == "suspicion_expanding":
        # Bad comparator ignores exhausted permissions and completion. Repeated
        # gaps provoke repeated proposals, even when the executor refuses them.
        if not actions:
            return {"kind": "STOP", "reason": "NO_CANDIDATES"}
        chosen = min(actions, key=lambda a: (
            0 if a["scope_extension_basis"] == "UNCERTAINTY" else 1,
            view["attempts"].get(a["action_id"], 0),
            -a["expected_information_value"], a["action_id"],
        ))
        return {"kind": "ACTION", "action_id": chosen["action_id"]}
    if policy != "bounded_targeted":
        raise ValueError("unknown policy")
    if status == "CAPTURE_SIGNAL":
        return {"kind": "STOP", "reason": "CAPTURE_SIGNAL"}
    if status == "PROVISIONAL_INDEPENDENCE" and not view["anomalies"]:
        return {"kind": "STOP", "reason": "PROVISIONAL_INDEPENDENCE"}
    if view["cycle"] >= view["lease_expires"]:
        return {"kind": "STOP", "reason": "LEASE_EXPIRED"}
    gaps = {slot(s) for s in view["assessment"]["slots"]
            if s["status"] in ("INSUFFICIENT", "CONTRADICTED")}
    gaps |= {slot(a) for a in view["anomalies"]}
    relevant = [
        a for a in actions
        if a["action_id"] in view["eligible_ids"]
        and view["attempts"].get(a["action_id"], 0) == 0
        and slot(a["scope"]) in gaps
        and a["availability_permille"] > 0
        and a["expected_information_value"] > 0
    ]
    if not relevant:
        reasons = set(view["gate_reasons"].values())
        if any(r in reasons for r in ("ACTION_BUDGET", "COST_BUDGET", "TIME_HORIZON")):
            reason = "BUDGET_EXHAUSTED"
        else:
            reason = "AUTHORIZED_CORRIDOR_EXHAUSTED"
        return {"kind": "STOP", "reason": reason}
    contradictions = {slot(s) for s in view["assessment"]["slots"]
                      if s["status"] == "CONTRADICTED"}
    def rank(a):
        targeted = a["type"] == "RESOLVE_CONTRADICTION" and slot(a["scope"]) in contradictions
        provenance = a["type"] in (
            "CHECK_SOURCE_INDEPENDENCE", "DISCOVER_SOURCE_CONTROL_ORIGIN"
        )
        # A bounded query-priority heuristic, never a social/moral score.
        value = Fraction(a["expected_information_value"] * a["availability_permille"],
                         1000 * (1 + a["cost"] + a["intrusion_cost"]))
        return (-int(targeted), -int(provenance), -value, a["action_id"])
    chosen = min(relevant, key=rank)
    return {"kind": "ACTION", "action_id": chosen["action_id"]}


def run_policy(config, policy):
    """Executor has response tapes; it never reads oracle_only or expected."""
    scope = config["epistemic_scope"]
    lease, budget = copy.deepcopy(config["search_lease"]), config["budget"]
    evidence = {e["evidence_id"]: copy.deepcopy(e) for e in config["initial_evidence"]}
    edges = {e["edge_id"]: copy.deepcopy(e) for e in config["initial_source_control_edges"]}
    checks = {e["source"]: copy.deepcopy(e) for e in config["initial_source_checks"]}
    actions = {a["action_id"]: copy.deepcopy(a) for a in config["actions"]}
    attempts, expanded, handled_anomalies = {}, set(), set()
    used = {"actions": 0, "cost": 0, "intrusion": 0, "scope_expansions": 0}
    blocked, patterns, receipts, decisions, snapshots = {}, set(), [], [], []
    cycle, negative_count, nominal_gained, correlation_discoveries = 0, 0, 0, 0
    contradiction_rechecks, resolutions, expired_responses = 0, 0, 0
    seen_fingerprints = {}
    initial = epistemic_snapshot(scope, cycle, evidence, edges, checks)
    snapshots.append({"cycle": cycle, "assessment": copy.deepcopy(initial)})
    reason = "HARNESS_WATCHDOG"
    for step in range(config["watchdog_steps"]):
        state = epistemic_snapshot(scope, cycle, evidence, edges, checks)
        anomalies = [a for a in config["anomalies"]
                     if fresh(a, cycle) and a["anomaly_id"] not in handled_anomalies]
        reasons = {
            key: gate(a, lease, budget, used, cycle, anomalies, expanded)
            for key, a in sorted(actions.items())
        }
        # Record actual gate rejections once per candidate+reason, even if the
        # good policy excludes the candidate before ranking.
        for key, why in reasons.items():
            if why not in ("ALLOWED", "NOT_YET_AVAILABLE"):
                blocked[(key, why)] = True
        view = {
            "cycle": cycle, "assessment": state,
            "actions": list(actions.values()),
            "source_checks": sorted(k for k, c in checks.items() if fresh(c, cycle)),
            "anomalies": copy.deepcopy(anomalies),
            "attempts": copy.deepcopy(attempts),
            "eligible_ids": sorted(k for k, v in reasons.items() if v == "ALLOWED"),
            "gate_reasons": reasons,
            "remaining": {
                "actions": max(0, budget["max_actions"] - used["actions"]),
                "cost": max(0, budget["max_total_cost"] - used["cost"]),
                "intrusion": max(0, budget["max_intrusion_cost"] - used["intrusion"]),
            },
            "lease_expires": lease["expires_cycle"],
        }
        decision = policy_decision(policy, copy.deepcopy(view))
        record = {
            "step": step, "cycle": cycle, "view_digest": digest(view),
            "decision": decision, "gate_reason": "NOT_APPLICABLE",
        }
        if decision["kind"] == "STOP":
            reason = decision["reason"]
            decisions.append(record)
            break
        action = actions[decision["action_id"]]
        key = action["action_id"]
        why = reasons[key]
        record["gate_reason"] = why
        decisions.append(record)
        fingerprint = (key, state["status"], state["independent_support_units"], why)
        seen_fingerprints[fingerprint] = seen_fingerprints.get(fingerprint, 0) + 1
        if seen_fingerprints[fingerprint] >= 3:
            patterns.add("UNBOUNDED_VERIFICATION_LOOP")
        if why != "ALLOWED":
            # Denied proposals consume no lease/cost/evidence authority.
            # The external watchdog is not the comparator's own stop rule.
            attempts[key] = attempts.get(key, 0) + 1
            cycle += 1
            snapshots.append({
                "cycle": cycle,
                "assessment": epistemic_snapshot(scope, cycle, evidence, edges, checks),
            })
            continue
        before = copy.deepcopy(state)
        old_clusters = len(connected_source_clusters(set(scope["source_nodes"]), list(edges.values())))
        target = slot(action["scope"])
        if target not in {slot(x) for x in lease["scope"]} and target not in expanded:
            expanded.add(target)
            used["scope_expansions"] += 1
        attempt = attempts.get(key, 0)
        tape = config["response_tape"][key]
        response = copy.deepcopy(tape[min(attempt, len(tape) - 1)])
        attempts[key] = attempt + 1
        used["actions"] += 1
        used["cost"] += action["cost"]
        used["intrusion"] += action["intrusion_cost"]
        started = cycle
        cycle += action["duration_cycles"]
        admitted = cycle < lease["expires_cycle"] and cycle < action["expires_cycle"]
        if target not in {slot(x) for x in lease["scope"]}:
            # A fresh anomaly narrows the pre-authorized extension interval;
            # starting inside it cannot create authority after it ends.
            admitted = admitted and any(
                a["anomaly_id"] == action["anomaly_ref"] and fresh(a, cycle)
                for a in anomalies
            )
        new_ids, retracted = [], []
        if not admitted:
            expired_responses += 1
            patterns.add("LEASE_OR_ACTION_EXPIRY_REJECTS_RESPONSE")
        else:
            for e in response["source_edges"]:
                previous = edges.get(e["edge_id"])
                if previous is not None and previous != e:
                    raise ValueError("source edge identity cannot be rewritten")
                edges[e["edge_id"]] = e
            for c in response["source_checks"]:
                c["issued_cycle"] = cycle
                checks[c["source"]] = c
            for r in response["retractions"]:
                old = evidence.get(r["evidence_id"])
                if old is not None:
                    # Semantic validation binds the correction to its original
                    # source. Archive remains in config and the receipt.
                    if old["source"] != r["source"] or slot(old) != target:
                        raise ValueError("unattributed response retraction")
                    del evidence[r["evidence_id"]]
                    retracted.append(r["evidence_id"])
            for e in response["evidence"]:
                # Repeated responses are nominal events, never new sources.
                e["evidence_id"] = f"{e['evidence_id']}@{key}:{attempt}"
                e["issued_cycle"] = cycle
                if e["evidence_id"] in evidence:
                    raise ValueError("duplicate response evidence")
                evidence[e["evidence_id"]] = e
                new_ids.append(e["evidence_id"])
            nominal_gained += len(new_ids)
            if response["outcome"] == "NOT_FOUND":
                negative_count += 1
                patterns.add("FAILURE_TO_DISCOVER_NOT_PROOF_OF_ABSENCE")
            if action["anomaly_ref"] and response["outcome"] == "EVIDENCE":
                handled_anomalies.add(action["anomaly_ref"])
        after = epistemic_snapshot(scope, cycle, evidence, edges, checks)
        new_clusters = len(connected_source_clusters(set(scope["source_nodes"]), list(edges.values())))
        correlation_discoveries += max(0, old_clusters - new_clusters)
        if new_clusters < old_clusters:
            patterns.add("SOURCE_CORRELATION_DISCOVERED")
        if new_ids and after["independent_support_units"] <= before["independent_support_units"]:
            patterns.add("MORE_EVIDENCE_WITHOUT_MORE_INDEPENDENCE")
        if before["active_evidence_count"] > 0 and (
            after["active_evidence_count"] < before["active_evidence_count"] + len(new_ids) - len(retracted)
        ):
            patterns.add("EVIDENCE_STALES_DURING_SEARCH")
        if before["status"] == "INDETERMINATE_CONTRADICTION":
            if action["type"] == "RESOLVE_CONTRADICTION":
                contradiction_rechecks += 1
            if after["status"] != "INDETERMINATE_CONTRADICTION":
                resolutions += 1
                patterns.add("TARGETED_CONTRADICTION_RESOLVED")
        if (
            after["status"] == "PROVISIONAL_INDEPENDENCE"
            and before["status"] != "PROVISIONAL_INDEPENDENCE"
        ):
            patterns.add("FRESH_EVIDENCE_CLOSES_GAP")
        if before["status"] == "PROVISIONAL_INDEPENDENCE" and after["status"] != before["status"]:
            patterns.add("PROVISIONAL_CLAIM_REVOKED")
        receipt_body = {
            "action_id": key, "action_type": action["type"], "search_lease_id": lease["lease_id"],
            "scope": action["scope"], "started_cycle": started, "completed_cycle": cycle,
            "cost": action["cost"], "intrusion_cost": action["intrusion_cost"],
            "admitted": admitted,
            "outcome": response["outcome"] if admitted else "EXPIRED",
            "evidence_ids": new_ids, "retracted_evidence_ids": retracted,
            "negative_search_valid_until": cycle + response["negative_ttl_cycles"]
                if admitted and response["outcome"] == "NOT_FOUND" else None,
            "response_digest": digest(response),
            "decision_authority_created": False,
        }
        receipt_body["receipt_digest"] = digest(receipt_body)
        receipts.append(receipt_body)
        snapshots.append({"cycle": cycle, "assessment": copy.deepcopy(after)})
    else:
        patterns.add("HARNESS_TERMINATED_NONSTOPPING_POLICY")
    final = epistemic_snapshot(scope, cycle, evidence, edges, checks)
    if final["status"] == "INDETERMINATE":
        outcome = "BOUNDED_INDETERMINATE"
        patterns.add("UNKNOWN_NOT_SUSPICIOUS")
    else:
        outcome = final["status"]
    if reason == "HARNESS_WATCHDOG":
        outcome = "NONTERMINATING_POLICY_DETECTED"
    if any(r in {"UNCERTAINTY_CANNOT_EXPAND_SCOPE", "SCOPE_NOT_AUTHORIZED",
                 "SCOPE_EXPANSION_BUDGET"} for _, r in blocked):
        patterns.add("SCOPE_EXPANSION_BLOCKED")
    if any(r in {"PRIVACY_FLOOR", "INTRUSION_BUDGET"} for _, r in blocked):
        patterns.add("INTRUSIVE_ACTION_BLOCKED")
    if any(r == "PROTECTED_RIGHTS_FLOOR" for _, r in blocked):
        patterns.add("PROTECTED_RIGHTS_NOT_OPTIMIZED")
    if final["raw_quorum_but_correlated"]:
        patterns.add("EVIDENCE_QUANTITY_NOT_INDEPENDENCE")
    if outcome == "BOUNDED_INDETERMINATE" and reason != "PASSIVE":
        patterns.add("LEGITIMATE_BOUNDED_STOP")
    initial_units = initial["independent_support_units"]
    independent_gained = final["independent_support_units"] - initial_units
    metrics = {
        "verification_actions_used": used["actions"], "policy_action_proposals": sum(
            d["decision"]["kind"] == "ACTION" for d in decisions),
        "total_search_cost": used["cost"], "intrusion_cost": used["intrusion"],
        "nominal_evidence_gained": nominal_gained,
        "independent_support_units_gained": independent_gained,
        "scope_expansions": used["scope_expansions"],
        "blocked_scope_expansions": sum(r in {
            "UNCERTAINTY_CANNOT_EXPAND_SCOPE", "SCOPE_NOT_AUTHORIZED", "SCOPE_EXPANSION_BUDGET"
        } for _, r in blocked),
        "blocked_intrusive_actions": sum(r in {"PRIVACY_FLOOR", "INTRUSION_BUDGET"} for _, r in blocked),
        "blocked_rights_actions": sum(r == "PROTECTED_RIGHTS_FLOOR" for _, r in blocked),
        "source_correlation_discoveries": correlation_discoveries,
        "negative_search_receipts": negative_count,
        "expired_responses": expired_responses,
        "contradiction_rechecks": contradiction_rechecks,
        "contradictions_resolved": resolutions,
        "contradiction_resolution_rate": resolutions / max(1, contradiction_rechecks),
        "redundant_evidence_ratio": max(0, nominal_gained - max(0, independent_gained)) / max(1, nominal_gained),
        "final_cycle": cycle, "final_epistemic_status": final["status"],
        "final_outcome": outcome, "search_termination_reason": reason,
        "evidence_freshness_at_decision": final["freshness_remaining_cycles"],
        "source_check_freshness_at_decision": final["source_check_remaining_cycles"],
        "verification_loop_length": max(seen_fingerprints.values(), default=0),
        "bounded_indeterminate": outcome == "BOUNDED_INDETERMINATE",
        "lease_state": "EXPIRED" if cycle >= lease["expires_cycle"] else (
            "CONSUMED" if used["actions"] >= budget["max_actions"] else "CLOSED"),
    }
    return {
        "receipt_version": "1.1", "experiment_id": config["experiment_id"], "policy": policy,
        "scope": [{"reviewer": r, "dimension": d} for r in scope["reviewers"]
                  for d in scope["control_dimensions"]],
        "search_lease_scope": copy.deepcopy(lease["scope"]),
        "claim_valid_until_exclusive": min(
            lease["expires_cycle"], cycle + final["freshness_remaining_cycles"],
            cycle + final["source_check_remaining_cycles"],
        ) if final["status"] == "PROVISIONAL_INDEPENDENCE" else None,
        "pattern_ids": sorted(patterns), "metrics": metrics,
        "decisions": decisions, "evidence_receipts": receipts, "snapshots": snapshots,
        "trace_digest": digest({"decisions": decisions, "receipts": receipts, "snapshots": snapshots}),
        "decision_authority_created": False, "runtime_authority_created": False,
    }


def evaluate_oracle(config, receipt):
    """Post-hoc only. Never called by a policy or used in its next view."""
    truth = {e["edge_id"]: copy.deepcopy(e) for e in config["oracle_only"]["initial_control_edges"]}
    events = sorted(config["oracle_only"]["events"], key=lambda x: x["cycle"])
    pos, false_assurance, false_positive, captured, discovered = 0, 0, 0, 0, 0
    scope = config["epistemic_scope"]
    final_actual = None
    for snapshot in receipt["snapshots"]:
        cycle = snapshot["cycle"]
        while pos < len(events) and events[pos]["cycle"] <= cycle:
            event = events[pos]
            if event["type"] == "ADD":
                truth[event["edge"]["edge_id"]] = event["edge"]
            elif event["edge_id"] in truth:
                del truth[event["edge_id"]]
            else:
                raise ValueError("oracle event removes missing edge")
            pos += 1
        actual = actual_independence(scope["reviewers"], scope["beneficiary"],
                                     scope["review_quorum"], list(truth.values()))
        status = snapshot["assessment"]["status"]
        false_assurance += not actual and status == "PROVISIONAL_INDEPENDENCE"
        false_positive += actual and status == "CAPTURE_SIGNAL"
        captured += not actual
        discovered += not actual and status == "CAPTURE_SIGNAL"
        final_actual = actual
    patterns = set(receipt["pattern_ids"])
    if false_assurance:
        patterns.add("FALSE_ASSURANCE_ORACLE_ONLY")
    if false_positive:
        patterns.add("FALSE_POSITIVE_CAPTURE_ORACLE_ONLY")
    if captured and not discovered and receipt["policy"] != "passive":
        patterns.add("SEARCH_EXHAUSTED_WITH_FALSE_ASSURANCE_RISK")
    if discovered:
        patterns.add("HIDDEN_CAPTURE_DISCOVERED_ORACLE_ONLY")
    receipt["pattern_ids"] = sorted(patterns)
    receipt["oracle_evaluation"] = {
        "false_assurance_observations": false_assurance,
        "false_positive_capture_observations": false_positive,
        "captured_observations": captured, "capture_discovery_observations": discovered,
        "capture_discovery_rate": discovered / max(1, captured),
        "final_actual_independent": final_actual,
        "historical_capture": config["oracle_only"]["historical_capture"],
        "observation_count": len(receipt["snapshots"]),
    }
    receipt["config_digest"] = digest(config)
    # Oracle metrics are counts of recorded decision/completion observations,
    # NOT equal-duration calendar cycles or real-world calibrated rates.
    receipt["receipt_digest"] = digest(receipt)
    return receipt


def assert_expectations(config, receipts):
    errors = []
    for policy, expected in config["expected"].items():
        r = receipts[policy]
        for field, value in expected["metrics"].items():
            if r["metrics"].get(field) != value:
                errors.append(f"{policy}.{field}: expected={value} actual={r['metrics'].get(field)}")
        for pattern in expected["required_patterns"]:
            if pattern not in r["pattern_ids"]:
                errors.append(f"{policy}: missing {pattern}")
        for pattern in expected["forbidden_patterns"]:
            if pattern in r["pattern_ids"]:
                errors.append(f"{policy}: forbidden {pattern}")
    return errors


def reference_summary(receipts):
    return {p: {
        "metrics": r["metrics"], "oracle_evaluation": r["oracle_evaluation"],
        "pattern_ids": r["pattern_ids"], "trace_digest": r["trace_digest"],
        "receipt_digest": r["receipt_digest"], "config_digest": r["config_digest"],
    } for p, r in receipts.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment", action="append")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--check-reference", action="store_true")
    args = parser.parse_args()
    paths = sorted(EXPERIMENT_DIR.glob("V*/config.json"))
    if args.experiment:
        paths = [p for p in paths if load_json(p)["experiment_id"] in set(args.experiment)]
    if not paths:
        print("no active verification experiments found", file=sys.stderr)
        return 2
    cs, rs = load_json(CONFIG_SCHEMA), load_json(RECEIPT_SCHEMA)
    protocol = load_json(EXPERIMENT_DIR / "protocol.json")
    followup_protocol = load_json(EXPERIMENT_DIR / "followup-protocol.json")
    reference_path = EXPERIMENT_DIR / "reference-results.json"
    reference = load_json(reference_path) if args.check_reference else {}
    results, failures = {}, 0
    if args.output_dir:
        args.output_dir.mkdir(parents=True, exist_ok=True)
    for path in paths:
        config = load_json(path)
        errors = format_errors(validator(cs).iter_errors(config))
        receipts = {}
        if not errors:
            try:
                validate_semantics(config)
                for policy in POLICIES:
                    first = run_policy(config, policy)
                    # Replay + oracle mutation invariance: compare complete policy
                    # traces, receipts and observed snapshots before oracle scoring.
                    replay = run_policy(config, policy)
                    if first != replay:
                        raise ValueError(f"non-deterministic {policy}")
                    mutant = copy.deepcopy(config)
                    mutant["oracle_only"] = {
                        "initial_control_edges": [], "events": [],
                        "historical_capture": not config["oracle_only"]["historical_capture"],
                    }
                    changed = run_policy(mutant, policy)
                    if any(first[k] != changed[k] for k in (
                        "decisions", "evidence_receipts", "snapshots", "trace_digest", "metrics"
                    )):
                        raise ValueError("oracle leaked into execution")
                    r = evaluate_oracle(config, first)
                    errors.extend(format_errors(validator(rs).iter_errors(r)))
                    receipts[policy] = r
                errors.extend(assert_expectations(config, receipts))
                results[config["experiment_id"]] = reference_summary(receipts)
                if args.check_reference and reference["results"].get(config["experiment_id"]) != results[config["experiment_id"]]:
                    errors.append("reference replay differs")
                if args.output_dir:
                    (args.output_dir / f"{config['experiment_id']}.json").write_text(
                        json.dumps(receipts, ensure_ascii=False, indent=2) + "\n"
                    )
            except Exception as exc:
                errors.append(str(exc))
        print(f"{config['experiment_id']}: {'FAIL' if errors else 'CONFORM'}")
        if receipts:
            for policy, r in receipts.items():
                m = r["metrics"]
                print(f"  {policy}: {m['final_outcome']}; actions={m['verification_actions_used']}; "
                      f"cost={m['total_search_cost']}; intrusion={m['intrusion_cost']}; "
                      f"stop={m['search_termination_reason']}")
        for error in errors:
            print("  -", error)
        failures += bool(errors)
    result = {"version": "1.1", "protocol_digest": digest(protocol),
              "followup_protocol_digest": digest(followup_protocol), "results": results}
    if args.check_reference and reference.get("protocol_digest") != digest(protocol):
        print("protocol differs from frozen reference")
        failures += 1
    if args.check_reference and reference.get("followup_protocol_digest") != digest(followup_protocol):
        print("follow-up protocol differs from frozen reference")
        failures += 1
    if args.output_dir:
        (args.output_dir / "summary.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"\nUU Society active verification v1.1: {len(paths) - failures}/{len(paths)} experiments conform")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

