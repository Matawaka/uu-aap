#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load_module(ROOT / "chsp_v06.py", "chsp_v06_test")


def expect_fail(fn, contains=None):
    try:
        fn()
    except Exception as exc:
        if contains and contains not in str(exc):
            raise AssertionError(f"failure did not contain {contains!r}: {exc}") from exc
        return
    raise AssertionError("operation unexpectedly succeeded")


def z(dt):
    return C.iso_z(dt)


def make_v05_state(base):
    value = {
        "artifact_type": "CHSPCanonicalStewardshipState",
        "artifact_version": "0.5",
        "state_id": "urn:test:chsp:v05:state",
        "project_id": "Matawaka/uu-aap",
        "predecessor_steward_id": "human:predecessor-1",
        "current_steward_id": "human:steward-2",
        "predecessor_disposition_mode": "acknowledged",
        "v04_authorization_sha256": "1" * 64,
        "v04_authorization_assessment_sha256": "2" * 64,
        "effective_at": z(base),
        "execution_nonce": "execution-nonce-v05-0001",
        "predecessor_state_sha256": None,
        "state_sha256": "0" * 64,
        "claims": {
            "chsp_protocol_canonical_stewardship_effective": True,
            "effective_scope_chsp_protocol_only": True,
            "repository_ownership_transferred": False,
            "account_control_transferred": False,
            "canonical_origin_mutated": False,
            "canonical_publication_executed": False,
            "external_system_control_changed": False,
            "kontur_activated": False,
            "predecessor_legal_rights_adjudicated": False,
            "legal_ownership_adjudicated": False,
            "distributed_consensus_established": False,
            "universal_trust_established": False,
        },
    }
    value["state_sha256"] = C.self_digest(value, "state_sha256")
    return value


def make_v05_receipt(state, base):
    value = {
        "artifact_type": "CHSPHandoverExecutionReceipt",
        "artifact_version": "0.5",
        "execution_id": "urn:test:chsp:v05:execution",
        "project_id": "Matawaka/uu-aap",
        "candidate_id": state["current_steward_id"],
        "predecessor_steward_id": state["predecessor_steward_id"],
        "v04_authorization_sha256": state["v04_authorization_sha256"],
        "v04_authorization_assessment_sha256": state["v04_authorization_assessment_sha256"],
        "stewardship_state_sha256": state["state_sha256"],
        "executed_at": z(base),
        "execution_nonce": state["execution_nonce"],
        "recorder_id": "recorder:test",
        "recorder_evidence_sha256": "3" * 64,
        "result": "recorded",
        "receipt_sha256": "0" * 64,
        "claims": {
            "chsp_handover_execution_performed": True,
            "chsp_stewardship_state_recorded": True,
            "recorder_is_authority_source": False,
            "repository_ownership_transferred": False,
            "account_control_transferred": False,
            "canonical_origin_mutated": False,
            "canonical_publication_executed": False,
            "external_system_mutation_performed": False,
            "kontur_activated": False,
            "global_revocation_absence_proven": False,
            "global_replay_prevention_established": False,
            "legal_effect_established": False,
            "distributed_consensus_established": False,
            "universal_trust_established": False,
        },
    }
    value["receipt_sha256"] = C.self_digest(value, "receipt_sha256")
    return value


def support_set(claim, policy, base):
    return [
        C.issue_attestation(claim, policy, "observer:1", "domain:a", "identity_match", "support", z(base + timedelta(hours=1)), "a" * 64),
        C.issue_attestation(claim, policy, "observer:2", "domain:b", "challenge_response", "support", z(base + timedelta(hours=2)), "b" * 64),
        C.issue_attestation(claim, policy, "observer:3", "domain:a", "role_visibility", "support", z(base + timedelta(hours=3)), "c" * 64),
    ]


def main():
    import json
    policy = json.load((ROOT / "reference.chsp-external-binding-policy.json").open(encoding="utf-8"))
    C.validate_policy(policy)
    base = datetime(2026, 8, 10, 12, 0, tzinfo=timezone.utc)
    state = make_v05_state(base)
    receipt = make_v05_receipt(state, base)
    C.validate_v05_state(state, receipt, policy)

    claim = C.issue_claim(
        state, receipt, policy,
        "github_repository", "github:Matawaka/uu-aap", "github-user:Matawaka", "owner",
        "external-claim-nonce-0001", z(base + timedelta(minutes=10)),
    )
    assert claim["claims"]["steward_declared_mapping"] is True
    assert claim["claims"]["repository_ownership_proven"] is False
    assert claim["claims"]["external_binding_established"] is False
    C.validate_claim(claim, state, receipt, policy)

    attestations = support_set(claim, policy, base + timedelta(minutes=10))
    at = z(base + timedelta(days=1))
    proposal = C.build_proposal(state, receipt, policy, claim, attestations, at)
    assert proposal["claims"]["proposal_only"] is True
    assert proposal["claims"]["external_binding_established"] is False
    assert proposal["claims"]["external_control_transition_authorized"] is False
    assert proposal["external_principal_id"] == "github-user:Matawaka"
    assessment = C.assess_binding(state, receipt, policy, claim, attestations, proposal, at)
    assert assessment["state"] == "binding_review_eligible"
    assert assessment["decision"] == "external_binding_human_review_may_be_requested"
    assert assessment["claims"]["external_binding_review_eligible"] is True
    assert assessment["claims"]["external_binding_established"] is False
    assert assessment["metrics"]["supporting_attestations"] == 3
    assert assessment["metrics"]["observer_domains"] == 2
    assert assessment["metrics"]["strong_possession_present"] is True

    # Evidence threshold without a proposal cannot become reviewable.
    no_proposal = C.assess_binding(state, receipt, policy, claim, attestations, None, at)
    assert no_proposal["state"] == "evidence_insufficient"
    assert no_proposal["claims"]["external_binding_review_eligible"] is False

    # Two supports are insufficient.
    short = attestations[:2]
    insufficient = C.assess_binding(state, receipt, policy, claim, short, None, at)
    assert insufficient["state"] == "evidence_insufficient"
    expect_fail(lambda: C.build_proposal(state, receipt, policy, claim, short, at), "threshold")

    # Fresh contradictory evidence blocks even an otherwise sufficient set.
    contradiction = C.issue_attestation(
        claim, policy, "observer:4", "domain:c", "repository_metadata", "contradict",
        z(base + timedelta(hours=4)), "d" * 64,
    )
    conflicted_set = attestations + [contradiction]
    conflicted = C.assess_binding(state, receipt, policy, claim, conflicted_set, None, at)
    assert conflicted["state"] == "evidence_conflicted"
    assert conflicted["decision"] == "resolve_external_evidence_conflict"
    expect_fail(lambda: C.build_proposal(state, receipt, policy, claim, conflicted_set, at), "contradictory")

    # Indeterminate evidence never contributes support.
    indeterminate = C.issue_attestation(
        claim, policy, "observer:5", "domain:d", "signature_verification", "indeterminate",
        z(base + timedelta(hours=5)), "e" * 64,
    )
    ind_assessment = C.assess_binding(state, receipt, policy, claim, [attestations[0], indeterminate], None, at)
    assert ind_assessment["state"] == "evidence_insufficient"
    assert ind_assessment["metrics"]["indeterminate_attestations"] == 1

    # Stale support is ignored by the current evidence snapshot.
    stale_at = z(base + timedelta(days=10))
    stale = C.assess_binding(state, receipt, policy, claim, attestations, None, stale_at)
    assert stale["state"] == "evidence_insufficient"
    assert stale["metrics"]["supporting_attestations"] == 0

    # Credentials cannot be smuggled into an attestation by tampering.
    bad_attestation = copy.deepcopy(attestations[0])
    bad_attestation["contains_credentials"] = True
    bad_attestation["attestation_sha256"] = C.self_digest(bad_attestation, "attestation_sha256")
    expect_fail(lambda: C.validate_attestation(bad_attestation, claim, policy), "credentials")

    # Claim and predecessor evidence are content-bound.
    bad_claim = copy.deepcopy(claim)
    bad_claim["external_principal_id"] = "github-user:other"
    expect_fail(lambda: C.validate_claim(bad_claim, state, receipt, policy), "self-digest")
    bad_state = copy.deepcopy(state)
    bad_state["current_steward_id"] = "human:other"
    expect_fail(lambda: C.validate_v05_state(bad_state, receipt, policy), "self-digest")
    bad_receipt = copy.deepcopy(receipt)
    bad_receipt["stewardship_state_sha256"] = "f" * 64
    expect_fail(lambda: C.validate_v05_state(state, bad_receipt, policy), "self-digest")

    # Proposal tamper is rejected even when underlying evidence is sufficient.
    bad_proposal = copy.deepcopy(proposal)
    bad_proposal["claimed_role"] = "admin"
    expect_fail(lambda: C.validate_proposal(bad_proposal, state, receipt, policy, claim, attestations, at), "self-digest")

    # Disallowed role and pre-state claims fail closed.
    expect_fail(
        lambda: C.issue_claim(state, receipt, policy, "github_repository", "github:Matawaka/uu-aap", "github-user:Matawaka", "superuser", "external-claim-nonce-0002", z(base + timedelta(minutes=20))),
        "claimed role",
    )
    expect_fail(
        lambda: C.issue_claim(state, receipt, policy, "github_repository", "github:Matawaka/uu-aap", "github-user:Matawaka", "owner", "external-claim-nonce-0003", z(base - timedelta(seconds=1))),
        "predate stewardship",
    )

    print("CHSP v0.6 external stewardship binding tests: PASS")


if __name__ == "__main__":
    main()
