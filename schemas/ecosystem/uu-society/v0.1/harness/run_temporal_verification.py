#!/usr/bin/env python3
"""Paired Temporal Verification / Independent Search Reauthorization v1.2.

Publication clocks and private response latency are shared across arms. Policies
see only acquired evidence and public contracts. Oracle scoring occurs afterward
on the same discrete calendar, including passive observation after search stops.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from fractions import Fraction
from pathlib import Path

import run_active_verification as av
from run_institutional_epistemics import ancestors
from run_scenarios import digest, format_errors, load_json, validator

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT_DIR = ROOT / "temporal_verification"
CONFIG_SCHEMA = ROOT / "temporal-verification.config.schema.json"
RECEIPT_SCHEMA = ROOT / "temporal-verification.receipt.schema.json"
POLICIES = ("bounded_targeted", "deadline_aware", "deadline_aware_reauthorized")
VIEW_KEYS = {"legacy", "known_evidence", "known_checks", "ttl_cycles",
             "horizon_cycles", "reauthorization_available"}
REQUEST_KEYS = {"request_id", "requester_id", "prior_lease_id", "scope",
                "purpose", "assessment_digest", "requested_cycle"}


def validate_semantics(c):
    w, s = c["world"], c["world"]["epistemic_scope"]
    nodes, sources = set(s["nodes"]), set(s["source_nodes"])
    slots = {(r, d) for r in s["reviewers"] for d in s["control_dimensions"]}
    if not set(s["reviewers"]) <= nodes or s["beneficiary"] not in nodes:
        raise ValueError("unknown institutional node")
    if s["review_quorum"] > len(s["reviewers"]) or s["source_quorum"] > len(sources):
        raise ValueError("impossible quorum")
    lease, authority = c["search_lease"], c["authority"]
    if lease["extension_scope"]:
        raise ValueError("v1.2 narrows or preserves search scope; no contingent expansions")
    if not {av.slot(x) for x in lease["scope"]} <= slots or not lease["scope"]:
        raise ValueError("unknown lease scope")
    if lease["issued_cycle"] != 0 or lease["expires_cycle"] > c["horizon_cycles"]:
        raise ValueError("lease outside calendar")
    if c["budget"]["max_cycles"] != c["horizon_cycles"] - 1:
        raise ValueError("budget horizon must equal final observed cycle")
    if not 0 < lease["expires_cycle"]:
        raise ValueError("empty lease")
    for field, metric in (("max_actions", "actions"), ("max_total_cost", "cost"),
                          ("max_intrusion_cost", "intrusion"), ("max_scope_expansions", "scope_expansions")):
        if c["prior_usage"][metric] > c["budget"][field]:
            raise ValueError("prior usage exceeds lifetime budget")
    av.unique(w["actions"], "action_id")
    av.unique(w["initial_evidence"], "evidence_id")
    av.unique(w["initial_source_checks"], "source")
    av.unique(w["source_control_edges"], "edge_id")
    av.unique(c["claims"], "claim_id")
    ids = {a["action_id"] for a in w["actions"]}
    if set(w["response_publications"]) != ids or set(w["actual_duration_cycles"]) != ids:
        raise ValueError("world must cover exactly the action catalogue")
    all_items = {}
    def evidence(e):
        if av.slot(e) not in slots or e["source"] not in sources:
            raise ValueError("unknown evidence source or scope")
        old = all_items.get(e["evidence_id"])
        if old is not None and old != e:
            raise ValueError("publication identity rewritten")
        all_items[e["evidence_id"]] = e
    def check_edge(e, allowed):
        if e["from"] not in allowed or e["to"] not in allowed:
            raise ValueError("unknown control endpoint")
    for e in w["initial_evidence"]:
        evidence(e)
        if e["issued_cycle"] > 0:
            raise ValueError("future initial evidence")
    for e in w["source_control_edges"]:
        check_edge(e, nodes | sources)
    for item in w["initial_source_checks"]:
        if item["source"] not in sources or item["issued_cycle"] > 0:
            raise ValueError("invalid source check")
    for a in w["actions"]:
        if av.slot(a["scope"]) not in slots or a["source"] not in sources:
            raise ValueError("invalid action target")
        if a["scope_extension_basis"] != "NONE" or a["anomaly_ref"]:
            raise ValueError("temporal actions cannot mint anomaly scope")
        seen_cycles = set()
        for p in w["response_publications"][a["action_id"]]:
            if p["available_cycle"] in seen_cycles:
                raise ValueError("ambiguous publication order")
            seen_cycles.add(p["available_cycle"])
            response = p["response"]
            for e in response["evidence"]:
                evidence(e)
                if av.slot(e) != av.slot(a["scope"]) or e["issued_cycle"] > p["available_cycle"]:
                    raise ValueError("future or out-of-scope publication")
            if response["outcome"] in ("NOT_FOUND", "UNAVAILABLE") and any(
                response[k] for k in ("evidence", "source_edges", "source_checks", "retractions")
            ):
                raise ValueError("negative response cannot carry an assertion")
            if response["source_edges"] or response["source_checks"]:
                if a["type"] not in ("CHECK_SOURCE_INDEPENDENCE", "DISCOVER_SOURCE_CONTROL_ORIGIN"):
                    raise ValueError("source attestation cannot self-certify independence")
            for e in response["source_edges"]:
                check_edge(e, nodes | sources)
            for check in response["source_checks"]:
                if check["source"] not in sources or check["issued_cycle"] > p["available_cycle"]:
                    raise ValueError("invalid published source check")
    for a in w["actions"]:
        for p in w["response_publications"][a["action_id"]]:
            for r in p["response"]["retractions"]:
                old = all_items.get(r["evidence_id"])
                if (not old or old["source"] != r["source"]
                    or av.slot(old) != av.slot(a["scope"]) or a["type"] != "RESOLVE_CONTRADICTION"):
                    raise ValueError("forged retraction")
    if not {av.slot(x) for x in authority["delegated_scope"] + authority["grant_scope"]} <= slots:
        raise ValueError("authority scope outside assessment universe")
    authority_nodes = set(authority["nodes"])
    required = {authority["issuer_id"], authority["requester_id"], s["beneficiary"], *s["reviewers"]}
    if not required <= authority_nodes:
        raise ValueError("unknown authority actor")
    for e in authority["observed_control_edges"]:
        check_edge(e, authority_nodes)
    for e in w["oracle_only"]["initial_control_edges"]:
        check_edge(e, nodes)
    for e in w["oracle_only"]["events"]:
        if e["type"] == "ADD":
            check_edge(e["edge"], nodes)
    if len(set(c["ttl_arms"])) != len(c["ttl_arms"]):
        raise ValueError("duplicate TTL arm")


def assessment(c, cycle, evidence, edges, checks, ttl):
    bounded = copy.deepcopy(evidence)
    for e in bounded.values():
        # Fetching never resets source issuance or exceeds source validity.
        e["ttl_cycles"] = min(ttl, e["ttl_cycles"])
    return av.epistemic_snapshot(c["world"]["epistemic_scope"], cycle, bounded, edges, checks)


def choose(policy, view):
    if set(view) != VIEW_KEYS:
        raise ValueError("unexpected temporal policy view")
    v = view["legacy"]
    if policy == "bounded_targeted":
        return av.policy_decision("bounded_targeted", v)
    if policy not in POLICIES:
        raise ValueError("unknown temporal policy")
    status, cycle = v["assessment"]["status"], v["cycle"]
    if status in ("CAPTURE_SIGNAL", "PROVISIONAL_INDEPENDENCE"):
        return {"kind": "STOP", "reason": status}
    gaps = {av.slot(x) for x in v["assessment"]["slots"] if x["status"] in ("INSUFFICIENT", "CONTRADICTED")}
    candidates = [
        a for a in v["actions"]
        if a["action_id"] in v["eligible_ids"]
        and v["attempts"].get(a["action_id"], 0) == 0
        and av.slot(a["scope"]) in gaps
        and a["availability_permille"] > 0 and a["expected_information_value"] > 0
        and cycle + a["duration_cycles"] < min(v["lease_expires"], a["expires_cycle"], view["horizon_cycles"])
    ]
    if candidates:
        deadlines = [
            e["issued_cycle"] + min(e["ttl_cycles"], view["ttl_cycles"])
            for e in view["known_evidence"] if av.fresh(
                {**e, "ttl_cycles": min(e["ttl_cycles"], view["ttl_cycles"])}, cycle)
        ]
        deadlines += [x["issued_cycle"] + x["ttl_cycles"] for x in view["known_checks"] if av.fresh(x, cycle)]
        contradicted = {av.slot(x) for x in v["assessment"]["slots"] if x["status"] == "CONTRADICTED"}
        def rank(a):
            completion = cycle + a["duration_cycles"]
            losses = sum(cycle < deadline <= completion for deadline in deadlines)
            correction = a["type"] == "RESOLVE_CONTRADICTION" and av.slot(a["scope"]) in contradicted
            provenance = a["type"] in ("CHECK_SOURCE_INDEPENDENCE", "DISCOVER_SOURCE_CONTROL_ORIGIN")
            eiv = Fraction(a["expected_information_value"] * a["availability_permille"],
                           1000 * (1 + a["cost"] + a["intrusion_cost"]))
            # Protect observed anchors first; otherwise do long acquisitions
            # before collecting short-lived corroboration. No future replies.
            return (-int(correction), -int(provenance), losses, -a["duration_cycles"], -eiv, a["action_id"])
        return {"kind": "ACTION", "action_id": min(candidates, key=rank)["action_id"]}
    if policy == "deadline_aware_reauthorized" and view["reauthorization_available"]:
        if cycle < v["lease_expires"]:
            return {"kind": "WAIT", "reason": "WAIT_FOR_LEASE_EXPIRY"}
        return {"kind": "REQUEST_REAUTHORIZATION"}
    baseline = av.policy_decision("bounded_targeted", v)
    if baseline["kind"] == "ACTION":
        return {"kind": "STOP", "reason": "FORECAST_DEADLINE"}
    return baseline


def renewal_decision(request, c, lease, cycle, grants, current_assessment, request_assessment):
    """Independent authority gate. No truth graph, response tapes or EIV."""
    a = c["authority"]
    reason = "GRANTED"
    if set(request) != REQUEST_KEYS:
        reason = "MALFORMED_REQUEST"
    elif request["requester_id"] != a["requester_id"] or request["prior_lease_id"] != lease["lease_id"]:
        reason = "IDENTITY_OR_LEASE_BINDING"
    elif request["purpose"] != "EVIDENCE_SEARCH_ONLY":
        reason = "PURPOSE_MISMATCH"
    elif request["assessment_digest"] != digest(request_assessment):
        reason = "STALE_ASSESSMENT_BINDING"
    elif not lease["expires_cycle"] <= request["requested_cycle"] < cycle:
        reason = "INVALID_REQUEST_INTERVAL"
    elif not a["enabled"] or cycle >= a["expires_cycle"]:
        reason = "AUTHORITY_UNAVAILABLE"
    elif a["issuer_id"] == a["requester_id"]:
        reason = "SELF_ISSUANCE"
    elif grants >= a["max_grants"]:
        reason = "RENEWAL_LIMIT"
    elif current_assessment["status"] not in ("INDETERMINATE", "INDETERMINATE_CONTRADICTION"):
        reason = "NO_UNFINISHED_GAP"
    else:
        issuer = ancestors(a["issuer_id"], a["observed_control_edges"])
        protected = {a["requester_id"], c["world"]["epistemic_scope"]["beneficiary"],
                     *c["world"]["epistemic_scope"]["reviewers"]}
        if any(issuer & ancestors(x, a["observed_control_edges"]) for x in protected):
            reason = "STRUCTURAL_AUTHORITY_CONFLICT"
        primary = {av.slot(x) for x in lease["scope"]}
        delegated = {av.slot(x) for x in a["delegated_scope"]}
        proposed = {av.slot(x) for x in a["grant_scope"]}
        requested = {av.slot(x) for x in request["scope"]}
        if reason == "GRANTED" and (not requested or not proposed
                or not requested <= primary & delegated or not requested <= proposed
                or not proposed <= primary & delegated):
            reason = "SCOPE_INFLATION"
    if reason == "GRANTED" and cycle >= c["horizon_cycles"] - 1:
        reason = "REVIEW_EXCEEDS_HORIZON"
    new_lease = None
    if reason == "GRANTED":
        new_lease = copy.deepcopy(lease)
        new_lease.update({
            "lease_id": f"{c['experiment_id']}:renewal:{grants + 1}",
            "issued_cycle": cycle,
            "expires_cycle": min(cycle + a["grant_duration_cycles"], a["expires_cycle"], c["horizon_cycles"]),
            "scope": copy.deepcopy(a["grant_scope"]),
        })
        if new_lease["expires_cycle"] <= cycle:
            reason, new_lease = "EMPTY_RENEWAL", None
    return reason, new_lease


def publication_response(world, action_id, cycle):
    available = [p for p in world["response_publications"][action_id] if p["available_cycle"] <= cycle]
    if not available:
        return {"outcome": "UNAVAILABLE", "evidence": [], "source_edges": [],
                "source_checks": [], "retractions": [], "negative_ttl_cycles": 1}
    return copy.deepcopy(max(available, key=lambda x: x["available_cycle"])["response"])


def execute(c, policy, ttl):
    """Run observations and acquisition without interpreting any oracle field."""
    w, horizon = c["world"], c["horizon_cycles"]
    lease, budget, used = copy.deepcopy(c["search_lease"]), c["budget"], copy.deepcopy(c["prior_usage"])
    evidence = {e["evidence_id"]: copy.deepcopy(e) for e in w["initial_evidence"]}
    edges = {e["edge_id"]: copy.deepcopy(e) for e in w["source_control_edges"]}
    checks = {e["source"]: copy.deepcopy(e) for e in w["initial_source_checks"]}
    actions = {a["action_id"]: a for a in w["actions"]}
    attempts, decisions, receipts, renewals, calendar = {}, [], [], [], []
    pending = review = None
    stopped, stop_cycle, stop_reason, stop_status = False, None, None, None
    grants = requests = received = unique_items = stale_items = canceled = 0

    def finish_query(query, cycle, cancellation=None):
        nonlocal received, unique_items, stale_items, canceled
        action = query["action"]
        body = {
            "action_id": action["action_id"], "lease_id": query["lease"]["lease_id"],
            "scope": copy.deepcopy(action["scope"]), "started_cycle": query["started"],
            "completed_cycle": cycle, "expected_completion_cycle": query["started"] + action["duration_cycles"],
            "outcome": cancellation or "UNAVAILABLE", "admitted": cancellation is None,
            "received_evidence_ids": [], "fresh_evidence_ids": [], "stale_evidence_ids": [],
            "source_issue_cycles": {}, "cost": action["cost"], "intrusion_cost": action["intrusion_cost"],
            "response_digest": None, "decision_authority_created": False,
        }
        if cancellation:
            canceled += 1
        else:
            response = publication_response(w, action["action_id"], cycle)
            body["outcome"], body["response_digest"] = response["outcome"], digest(response)
            for e in response["source_edges"]:
                old = edges.get(e["edge_id"])
                if old is not None and old != e:
                    raise ValueError("source edge identity rewritten")
                edges[e["edge_id"]] = e
            for check in response["source_checks"]:
                checks[check["source"]] = check
            for r in response["retractions"]:
                old = evidence.get(r["evidence_id"])
                if old is not None:
                    if old["source"] != r["source"] or av.slot(old) != av.slot(action["scope"]):
                        raise ValueError("forged runtime correction")
                    del evidence[r["evidence_id"]]
            for e in response["evidence"]:
                body["received_evidence_ids"].append(e["evidence_id"])
                body["source_issue_cycles"][e["evidence_id"]] = e["issued_cycle"]
                received += 1
                old = evidence.get(e["evidence_id"])
                if old is not None and old != e:
                    raise ValueError("evidence identity rewritten")
                unique_items += old is None
                evidence[e["evidence_id"]] = e
                is_fresh = av.fresh({**e, "ttl_cycles": min(ttl, e["ttl_cycles"])}, cycle)
                body["fresh_evidence_ids" if is_fresh else "stale_evidence_ids"].append(e["evidence_id"])
                stale_items += not is_fresh
        body["receipt_digest"] = digest(body)
        receipts.append(body)

    for cycle in range(horizon):
        if pending is not None:
            if cycle >= pending["lease"]["expires_cycle"] or cycle >= pending["action"]["expires_cycle"]:
                finish_query(pending, cycle, "CANCELLED_AT_EXPIRY")
                pending = None
            elif cycle >= pending["due"]:
                finish_query(pending, cycle)
                pending = None
        state = assessment(c, cycle, evidence, edges, checks, ttl)
        if review is not None and cycle >= review["due"]:
            # Preserve the original request binding and independently reassess
            # the current gap. The issuer cannot rewrite the signed intent.
            why, new_lease = renewal_decision(
                review["request"], c, lease, cycle, grants, state, review["request_assessment"])
            record = {
                "request": review["request"], "decision_assessment_digest": digest(state),
                "decision_cycle": cycle, "reason": why, "granted": new_lease is not None,
                "new_lease": new_lease, "lifetime_usage": copy.deepcopy(used),
                "lifetime_budget_digest": digest(budget), "authority_id": c["authority"]["issuer_id"],
                "runtime_authority_created": False,
            }
            record["receipt_digest"] = digest(record)
            renewals.append(record)
            review = None
            if new_lease is not None:
                lease, grants = new_lease, grants + 1
            else:
                stopped, stop_cycle, stop_reason, stop_status = True, cycle, "REAUTHORIZATION_DENIED", state["status"]
        if stopped:
            decision = {"kind": "OBSERVE_AFTER_STOP"}
        elif pending is not None:
            decision = {"kind": "IN_FLIGHT"}
        elif review is not None:
            decision = {"kind": "AUTHORITY_REVIEW_PENDING"}
        else:
            reasons = {key: av.gate(a, lease, budget, used, cycle, [], set()) for key, a in actions.items()}
            legacy = {
                "cycle": cycle, "assessment": state, "actions": list(actions.values()),
                "source_checks": sorted(k for k, x in checks.items() if av.fresh(x, cycle)),
                "anomalies": [], "attempts": copy.deepcopy(attempts),
                "eligible_ids": sorted(k for k, value in reasons.items() if value == "ALLOWED"),
                "gate_reasons": reasons,
                "remaining": {"actions": budget["max_actions"] - used["actions"],
                              "cost": budget["max_total_cost"] - used["cost"],
                              "intrusion": budget["max_intrusion_cost"] - used["intrusion"]},
                "lease_expires": lease["expires_cycle"],
            }
            # Renewal may repair a time corridor, never a hard right or an
            # exhausted lifetime budget. Simulate only the same scope/floor.
            extended = copy.deepcopy(lease)
            extended["issued_cycle"], extended["expires_cycle"] = 0, horizon
            gaps = {av.slot(x) for x in state["slots"] if x["status"] in ("INSUFFICIENT", "CONTRADICTED")}
            potential = [
                a for key, a in actions.items()
                if key not in attempts and av.slot(a["scope"]) in gaps
                and a["expected_information_value"] > 0 and a["availability_permille"] > 0
                and cycle + a["duration_cycles"] < min(a["expires_cycle"], horizon)
                and av.gate(a, extended, budget, used, cycle, [], set()) == "ALLOWED"
            ]
            view = {
                "legacy": legacy, "known_evidence": copy.deepcopy(list(evidence.values())),
                "known_checks": copy.deepcopy(list(checks.values())), "ttl_cycles": ttl,
                "horizon_cycles": horizon,
                "reauthorization_available": bool(potential) and c["authority"]["enabled"],
            }
            decision = choose(policy, copy.deepcopy(view))
            record = {"cycle": cycle, "view_digest": digest(view), "decision": decision}
            decisions.append(record)
            if decision["kind"] == "STOP":
                stopped, stop_cycle, stop_reason, stop_status = True, cycle, decision["reason"], state["status"]
            elif decision["kind"] == "ACTION":
                a = actions[decision["action_id"]]
                if reasons[a["action_id"]] != "ALLOWED":
                    raise ValueError("policy attempted forbidden query")
                attempts[a["action_id"]] = 1
                used["actions"] += 1
                used["cost"] += a["cost"]
                used["intrusion"] += a["intrusion_cost"]
                pending = {"action": a, "started": cycle,
                           "due": cycle + w["actual_duration_cycles"][a["action_id"]],
                           "lease": copy.deepcopy(lease)}
            elif decision["kind"] == "REQUEST_REAUTHORIZATION":
                requests += 1
                requested_scope = [x for x in lease["scope"] if av.slot(x) in gaps]
                request = {
                    "request_id": f"{c['experiment_id']}:{policy}:{ttl}:request:{requests}",
                    "requester_id": c["authority"]["requester_id"], "prior_lease_id": lease["lease_id"],
                    "scope": copy.deepcopy(requested_scope), "purpose": "EVIDENCE_SEARCH_ONLY",
                    "assessment_digest": digest(state), "requested_cycle": cycle,
                }
                due = cycle + c["authority"]["review_latency_cycles"]
                if due >= horizon:
                    record = {
                        "request": request, "decision_assessment_digest": digest(state),
                        "decision_cycle": cycle, "reason": "REVIEW_EXCEEDS_HORIZON", "granted": False,
                        "new_lease": None, "lifetime_usage": copy.deepcopy(used),
                        "lifetime_budget_digest": digest(budget), "authority_id": c["authority"]["issuer_id"],
                        "runtime_authority_created": False,
                    }
                    record["receipt_digest"] = digest(record)
                    renewals.append(record)
                    stopped, stop_cycle, stop_reason, stop_status = True, cycle, "REAUTHORIZATION_DENIED", state["status"]
                else:
                    review = {"request": request, "request_assessment": copy.deepcopy(state), "due": due}
        calendar.append({"cycle": cycle, "assessment": state, "lease_id": lease["lease_id"],
                         "lease_expires": lease["expires_cycle"], "search_stopped": stopped,
                         "decision_kind": decision["kind"]})
    if pending is not None:
        finish_query(pending, horizon, "CANCELLED_AT_HORIZON")
    if not stopped:
        stop_cycle, stop_reason, stop_status = horizon - 1, "FINITE_HORIZON", calendar[-1]["assessment"]["status"]
    outcome = "BOUNDED_INDETERMINATE" if stop_status == "INDETERMINATE" else stop_status
    metrics = {
        "verification_actions_used": used["actions"] - c["prior_usage"]["actions"],
        "lifetime_actions_used": used["actions"], "search_cost": used["cost"] - c["prior_usage"]["cost"],
        "lifetime_cost": used["cost"], "intrusion_cost": used["intrusion"] - c["prior_usage"]["intrusion"],
        "lifetime_intrusion": used["intrusion"], "evidence_items_received": received,
        "unique_evidence_gained": unique_items, "stale_items_received": stale_items,
        "canceled_queries": canceled, "reauthorization_requests": requests,
        "renewal_grants": grants, "renewal_denials": sum(not x["granted"] for x in renewals),
        "authority_review_cost": requests * c["authority"]["request_cost"],
        "search_stop_cycle": stop_cycle, "search_termination_reason": stop_reason,
        "status_at_search_stop": stop_status, "outcome_at_search_stop": outcome,
        "status_at_horizon": calendar[-1]["assessment"]["status"],
        "provisional_cycles": sum(x["assessment"]["status"] == "PROVISIONAL_INDEPENDENCE" for x in calendar),
        "capture_signal_cycles": sum(x["assessment"]["status"] == "CAPTURE_SIGNAL" for x in calendar),
        "contradiction_cycles": sum(x["assessment"]["status"] == "INDETERMINATE_CONTRADICTION" for x in calendar),
        "first_provisional_cycle": next((x["cycle"] for x in calendar if x["assessment"]["status"] == "PROVISIONAL_INDEPENDENCE"), None),
        "scope_expansions": 0, "observation_cycles": len(calendar),
    }
    return {
        "receipt_version": "1.2", "experiment_id": c["experiment_id"], "policy": policy,
        "evaluation_ttl_cycles": ttl, "metrics": metrics, "decisions": decisions,
        "evidence_receipts": receipts, "reauthorization_receipts": renewals, "calendar": calendar,
        "trace_digest": digest({"decisions": decisions, "evidence": receipts, "renewals": renewals, "calendar": calendar}),
        "runtime_authority_created": False, "decision_authority_created": False,
    }


def evaluate(c, receipt):
    w, s = c["world"], c["world"]["epistemic_scope"]
    truth = {e["edge_id"]: copy.deepcopy(e) for e in w["oracle_only"]["initial_control_edges"]}
    events = sorted(w["oracle_only"]["events"], key=lambda e: e["cycle"])
    pos, false_assurance, false_positive, captured, discovered = 0, 0, 0, 0, 0
    for tick in receipt["calendar"]:
        while pos < len(events) and events[pos]["cycle"] <= tick["cycle"]:
            e = events[pos]
            if e["type"] == "ADD":
                truth[e["edge"]["edge_id"]] = e["edge"]
            else:
                if e["edge_id"] not in truth:
                    raise ValueError("missing oracle edge")
                del truth[e["edge_id"]]
            pos += 1
        actual = av.actual_independence(s["reviewers"], s["beneficiary"], s["review_quorum"], list(truth.values()))
        status = tick["assessment"]["status"]
        false_assurance += not actual and status == "PROVISIONAL_INDEPENDENCE"
        false_positive += actual and status == "CAPTURE_SIGNAL"
        captured += not actual
        discovered += not actual and status == "CAPTURE_SIGNAL"
    receipt["oracle_evaluation"] = {
        "false_assurance_cycles": false_assurance, "false_positive_capture_cycles": false_positive,
        "captured_cycles": captured, "capture_discovery_cycles": discovered,
        "calendar_cycles": len(receipt["calendar"]),
    }
    receipt["world_digest"] = digest(w)
    receipt["publication_tape_digest"] = digest(w["response_publications"])
    receipt["config_digest"] = digest(c)
    receipt["receipt_digest"] = digest(receipt)
    return receipt


def invariants(c, receipt):
    errors = []
    b, m = c["budget"], receipt["metrics"]
    for metric, bound in (("lifetime_actions_used", "max_actions"), ("lifetime_cost", "max_total_cost"),
                          ("lifetime_intrusion", "max_intrusion_cost")):
        if m[metric] > b[bound]:
            errors.append(f"lifetime bound exceeded: {metric}")
    if len(receipt["calendar"]) != c["horizon_cycles"]:
        errors.append("unequal calendar horizon")
    if m["renewal_grants"] > c["authority"]["max_grants"]:
        errors.append("renewal limit exceeded")
    if m["reauthorization_requests"] > c["authority"]["max_grants"] + 1:
        errors.append("unbounded authority review requests")
    leases = {c["search_lease"]["lease_id"]: c["search_lease"]}
    for r in receipt["reauthorization_receipts"]:
        if r["granted"]:
            leases[r["new_lease"]["lease_id"]] = r["new_lease"]
            if r["new_lease"]["max_per_action_intrusion"] != c["search_lease"]["max_per_action_intrusion"]:
                errors.append("privacy floor changed")
            if not {av.slot(x) for x in r["new_lease"]["scope"]} <= {av.slot(x) for x in c["search_lease"]["scope"]}:
                errors.append("renewal scope inflated")
        if r["lifetime_budget_digest"] != digest(b):
            errors.append("renewal replaced lifetime budget")
    for r in receipt["evidence_receipts"]:
        lease = leases[r["lease_id"]]
        if not lease["issued_cycle"] <= r["started_cycle"] < lease["expires_cycle"]:
            errors.append("query started outside lease")
        if r["admitted"] and r["completed_cycle"] >= lease["expires_cycle"]:
            errors.append("expired lease admitted evidence")
        if r["started_cycle"] >= m["search_stop_cycle"] and m["search_termination_reason"] != "FINITE_HORIZON":
            errors.append("query after stop")
    return errors


def claim_results(c, receipts):
    results = []
    for claim in c["claims"]:
        selected = [r for r in receipts.values()
                    if claim["policy"] in ("all", r["policy"])
                    and claim["ttl_cycles"] in (0, r["evaluation_ttl_cycles"])]
        values = [r["metrics"].get(claim["metric"], r["oracle_evaluation"].get(claim["metric"])) for r in selected]
        def holds(value):
            if claim["operator"] == "eq":
                return value == claim["value"]
            if claim["operator"] == "ge":
                return value is not None and value >= claim["value"]
            if claim["operator"] == "le":
                return value is not None and value <= claim["value"]
            raise ValueError("unknown claim operator")
        results.append({"claim_id": claim["claim_id"], "verdict": "SUPPORTED" if selected and all(map(holds, values)) else "REFUTED",
                        "observed_values": values, "arm_count": len(values)})
    return results


def summary(receipts):
    return {key: {field: r[field] for field in (
        "metrics", "oracle_evaluation", "trace_digest", "receipt_digest",
        "world_digest", "publication_tape_digest", "config_digest",
    )} for key, r in receipts.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment", action="append")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--check-reference", action="store_true")
    args = parser.parse_args()
    paths = sorted(EXPERIMENT_DIR.glob("T*/config.json"))
    if args.experiment:
        paths = [p for p in paths if load_json(p)["experiment_id"] in set(args.experiment)]
    if not paths:
        print("no temporal verification experiments", file=sys.stderr)
        return 2
    cs, rs = load_json(CONFIG_SCHEMA), load_json(RECEIPT_SCHEMA)
    protocol = load_json(EXPERIMENT_DIR / "protocol.json")
    reference = load_json(EXPERIMENT_DIR / "reference-results.json") if args.check_reference else None
    output, failures = {}, 0
    if args.output_dir:
        args.output_dir.mkdir(parents=True, exist_ok=True)
    for path in paths:
        c = load_json(path)
        errors = format_errors(validator(cs).iter_errors(c))
        receipts = {}
        if not errors:
            try:
                validate_semantics(c)
                for ttl in c["ttl_arms"]:
                    for policy in POLICIES:
                        r = execute(c, policy, ttl)
                        if r != execute(c, policy, ttl):
                            raise ValueError("non-deterministic temporal execution")
                        mutant = copy.deepcopy(c)
                        mutant["world"]["oracle_only"] = {"initial_control_edges": [], "events": [], "historical_capture": True}
                        mutant["claims"] = []
                        if r != execute(mutant, policy, ttl):
                            raise ValueError("oracle or claim leaked into temporal execution")
                        r = evaluate(c, r)
                        errors += format_errors(validator(rs).iter_errors(r))
                        errors += invariants(c, r)
                        receipts[f"ttl-{ttl}/{policy}"] = r
                if len({r["world_digest"] for r in receipts.values()}) != 1:
                    errors.append("paired world mismatch")
                result = {"arms": summary(receipts), "claims": claim_results(c, receipts)}
                output[c["experiment_id"]] = result
                if reference is not None and result != reference["results"].get(c["experiment_id"]):
                    errors.append("frozen temporal reference differs")
                if args.output_dir:
                    (args.output_dir / f"{c['experiment_id']}.json").write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + "\n")
            except Exception as exc:
                errors.append(str(exc))
        print(f"{c['experiment_id']}: {'FAIL' if errors else 'CONFORM'}")
        if receipts:
            for ttl in c["ttl_arms"]:
                row = [receipts[f"ttl-{ttl}/{p}"]["metrics"] for p in POLICIES]
                print(f"  TTL {ttl}: " + " | ".join(f"{p}={m['outcome_at_search_stop']}, actions={m['verification_actions_used']}, grants={m['renewal_grants']}" for p, m in zip(POLICIES, row)))
            for claim in output[c["experiment_id"]]["claims"]:
                print(f"  {claim['claim_id']}: {claim['verdict']} {claim['observed_values']}")
        for error in errors:
            print("  -", error)
        failures += bool(errors)
    result = {"experiment_version": "1.2", "protocol_digest": digest(protocol), "results": output}
    if reference is not None and reference["protocol_digest"] != result["protocol_digest"]:
        print("temporal protocol changed")
        failures += 1
    if args.output_dir:
        (args.output_dir / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"\nUU Society temporal verification v1.2: {len(paths) - failures}/{len(paths)} experiments conform")
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())

