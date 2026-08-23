#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module():
    spec = importlib.util.spec_from_file_location("chsp_v01", ROOT / "chsp.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load chsp.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load_module()
POLICY = json.loads((ROOT / "reference.chsp-policy.json").read_text(encoding="utf-8"))


def expect_fail(fn, contains=None):
    try:
        fn()
    except Exception as exc:
        if contains and contains not in str(exc):
            raise AssertionError(f"failure did not contain {contains!r}: {exc}") from exc
        return
    raise AssertionError("operation unexpectedly succeeded")


def candidate():
    return C.build_candidate(
        "Matawaka/uu-aap",
        "human:successor-candidate",
        "human:canonical-steward",
        "appeal:independent-contour",
        "2026-01-01T00:00:00Z",
    )


def event(cand, idx, when, klass, domain, finding="supportive", resolution="not_applicable", observer=None):
    value = {
        "artifact_type": "CHSPEvidenceEvent",
        "artifact_version": "0.1",
        "event_id": f"urn:test:chsp:event:{idx}",
        "project_id": cand["project_id"],
        "candidate_id": cand["candidate_id"],
        "observed_at": when,
        "observer_id": observer or f"observer:{domain}",
        "observer_domain_id": domain,
        "observer_is_candidate": False,
        "evidence_class": klass,
        "finding": finding,
        "resolution": resolution,
        "scenario_id": f"scenario:{idx}",
        "evidence_payload_sha256": f"{idx % 10}" * 64,
        "event_sha256": "0" * 64,
        "claims": {
            "observable_event_recorded": True,
            "independent_domain_declared": True,
            "domain_independence_proven": False,
            "trust_established": False,
            "authority_granted": False,
            "truth_certified": False,
        },
    }
    value["event_sha256"] = C.self_digest(value, "event_sha256")
    return value


def delegation(cand, idx, level="reversible_limited", outcome="successful", status="completed"):
    value = {
        "artifact_type": "CHSPDelegation",
        "artifact_version": "0.1",
        "delegation_id": f"urn:test:chsp:delegation:{idx}",
        "project_id": cand["project_id"],
        "candidate_id": cand["candidate_id"],
        "granted_by_id": f"grantor:{idx}",
        "granted_at": f"2026-04-0{idx}T00:00:00Z",
        "starts_at": f"2026-04-0{idx}T01:00:00Z",
        "expires_at": f"2026-04-{10 + idx:02d}T00:00:00Z",
        "delegation_level": level,
        "scopes": ["review_change", "document_rationale"],
        "reversible": True,
        "status": status,
        "outcome": outcome,
        "completion_evidence_sha256": (str(idx) * 64) if status == "completed" else None,
        "delegation_sha256": "0" * 64,
        "claims": {
            "bounded_delegation_recorded": True,
            "canonical_authority_granted": False,
            "canonical_successor_established": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "appeal_path_removed": False,
        },
    }
    value["delegation_sha256"] = C.self_digest(value, "delegation_sha256")
    return value


def supportive_set(cand):
    rows = [
        (1, "2026-01-02T00:00:00Z", "protocol_comprehension", "domain:a"),
        (2, "2026-01-20T00:00:00Z", "boundary_respect", "domain:b"),
        (3, "2026-02-05T00:00:00Z", "conflict_of_interest_disclosure", "domain:c"),
        (4, "2026-02-20T00:00:00Z", "challenged_decision_response", "domain:a"),
        (5, "2026-03-10T00:00:00Z", "uncertainty_handling", "domain:b"),
        (6, "2026-03-25T00:00:00Z", "reversibility_preservation", "domain:c"),
        (7, "2026-04-05T00:00:00Z", "appeal_preservation", "domain:a"),
        (8, "2026-04-20T00:00:00Z", "operational_stewardship", "domain:b"),
        (9, "2026-05-05T00:00:00Z", "challenged_decision_response", "domain:c"),
    ]
    return [event(cand, *row) for row in rows]


def main():
    C.validate_policy(POLICY)
    cand = candidate()
    evidence = supportive_set(cand)
    delegations = [delegation(cand, 1), delegation(cand, 2, "supervised_stewardship")]

    eligible = C.assess(POLICY, cand, evidence, delegations, "2026-05-15T00:00:00Z")
    assert eligible["state"] == "succession_eligible"
    assert eligible["decision"] == "human_successor_recognition_may_be_requested"
    assert eligible["metrics"]["immersion_days"] >= 90
    assert eligible["metrics"]["observer_domains"] == 3
    assert eligible["metrics"]["challenge_events"] == 2
    assert eligible["claims"]["canonical_successor_established"] is False
    assert eligible["claims"]["kontur_activated"] is False
    assert eligible["claims"]["psychological_fitness_certified"] is False

    delegation_ready = C.assess(POLICY, cand, evidence, [], "2026-05-15T00:00:00Z")
    assert delegation_ready["state"] == "delegation_eligible"
    assert delegation_ready["decision"] == "bounded_delegation_may_be_considered"

    short = [copy.deepcopy(x) for x in evidence]
    for idx, item in enumerate(short):
        item["observed_at"] = f"2026-04-{idx + 1:02d}T00:00:00Z"
        item["event_sha256"] = "0" * 64
        item["event_sha256"] = C.self_digest(item, "event_sha256")
    short_result = C.assess(POLICY, cand, short, delegations, "2026-05-15T00:00:00Z")
    assert short_result["state"] == "observation_required"

    one_domain = [copy.deepcopy(x) for x in evidence]
    for item in one_domain:
        item["observer_domain_id"] = "domain:one"
        item["observer_id"] = "observer:one"
        item["event_sha256"] = "0" * 64
        item["event_sha256"] = C.self_digest(item, "event_sha256")
    one_domain_result = C.assess(POLICY, cand, one_domain, delegations, "2026-05-15T00:00:00Z")
    assert one_domain_result["state"] == "observation_required"

    adverse = event(cand, 40, "2026-05-10T00:00:00Z", "boundary_respect", "domain:d", "adverse", "unresolved")
    blocked = C.assess(POLICY, cand, evidence + [adverse], delegations, "2026-05-15T00:00:00Z")
    assert blocked["state"] == "observation_required"
    assert blocked["metrics"]["blocking_adverse_events"] == 1

    remediated = copy.deepcopy(adverse)
    remediated["resolution"] = "resolved_remediated"
    remediated["event_sha256"] = "0" * 64
    remediated["event_sha256"] = C.self_digest(remediated, "event_sha256")
    remediated_result = C.assess(POLICY, cand, evidence + [remediated], delegations, "2026-05-15T00:00:00Z")
    assert remediated_result["state"] == "succession_eligible"

    self_event = copy.deepcopy(evidence[0])
    self_event["observer_id"] = cand["subject_id"]
    self_event["event_sha256"] = "0" * 64
    self_event["event_sha256"] = C.self_digest(self_event, "event_sha256")
    expect_fail(lambda: C.assess(POLICY, cand, [self_event] + evidence[1:], delegations, "2026-05-15T00:00:00Z"), "own observer")

    tampered = copy.deepcopy(evidence)
    tampered[0]["scenario_id"] = "tampered"
    expect_fail(lambda: C.assess(POLICY, cand, tampered, delegations, "2026-05-15T00:00:00Z"), "self-digest mismatch")

    unsafe_delegation = copy.deepcopy(delegations[0])
    unsafe_delegation["scopes"] = ["canonical_merge"]
    unsafe_delegation["delegation_sha256"] = "0" * 64
    unsafe_delegation["delegation_sha256"] = C.self_digest(unsafe_delegation, "delegation_sha256")
    expect_fail(lambda: C.assess(POLICY, cand, evidence, [unsafe_delegation], "2026-05-15T00:00:00Z"), "unsafe or unknown delegation scope")

    adverse_delegation = delegation(cand, 3, outcome="adverse")
    adverse_result = C.assess(POLICY, cand, evidence, delegations + [adverse_delegation], "2026-05-15T00:00:00Z")
    assert adverse_result["state"] == "observation_required"

    stale = [copy.deepcopy(x) for x in evidence]
    stale[0]["observed_at"] = "2024-01-01T00:00:00Z"
    stale[0]["event_sha256"] = "0" * 64
    stale[0]["event_sha256"] = C.self_digest(stale[0], "event_sha256")
    stale_result = C.assess(POLICY, cand, stale, delegations, "2026-05-15T00:00:00Z")
    assert stale_result["state"] == "observation_required"

    expect_fail(
        lambda: C.build_candidate("Matawaka/uu-aap", "human:x", "human:y", "human:x", "2026-01-01T00:00:00Z"),
        "sole appeal contour",
    )

    print("CHSP v0.1 foundation tests: PASS")


if __name__ == "__main__":
    main()
