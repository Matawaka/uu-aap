#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
from pathlib import Path

V06 = Path(__file__).resolve().parent


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


R = load_module("canonical_recognition_v06_test", V06 / "canonical_recognition.py")


def expect_fail(fn, contains=None):
    try:
        fn()
    except Exception as exc:
        if contains and contains not in str(exc):
            raise AssertionError(f"expected {contains!r}, got {exc}") from exc
        return
    raise AssertionError("operation unexpectedly succeeded")


def proposal_fixture():
    p = {
        "artifact_type": "CanonicalSuccessionProposal",
        "artifact_version": "0.5",
        "proposal_id": "urn:test:proposal:1",
        "created_at": "2026-08-23T14:40:00Z",
        "project_id": "Matawaka/uu-aap",
        "proposer_id": "human:test-proposer",
        "predecessor_binding_sha256": "1" * 64,
        "predecessor_origin_id": "github:Matawaka/uu-aap",
        "predecessor_frontier_commit": "1" * 40,
        "recovery_execution_receipt_sha256": "2" * 64,
        "recovered_frontier_commit": "1" * 40,
        "candidate_ref": "refs/heads/main",
        "candidate_frontier_commit": "3" * 40,
        "candidate_frontier_tree": "4" * 40,
        "candidate_ref_set_sha256": "5" * 64,
        "candidate_advances_recovered_frontier": True,
        "proposal_sha256": "0" * 64,
        "claims": {
            "candidate_is_noncanonical": True,
            "proposal_only": True,
            "human_recognition_required": True,
            "canonical_successor_established": False,
            "canonical_origin_mutated": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "distributed_consensus_established": False,
            "universal_canonicality_established": False,
            "legal_effect_established": False,
            "truth_certified": False,
        },
    }
    p["proposal_sha256"] = R.self_digest(p, "proposal_sha256")
    return p


def assessment_fixture(proposal):
    a = {
        "artifact_type": "CanonicalSuccessionProposalAssessment",
        "artifact_version": "0.5",
        "assessment_id": "urn:test:proposal-assessment:1",
        "evaluated_at": "2026-08-23T14:45:00Z",
        "project_id": proposal["project_id"],
        "proposal_sha256": proposal["proposal_sha256"],
        "policy_sha256": "6" * 64,
        "state": "proposal_reviewable",
        "decision": "human_canonical_recognition_may_be_requested",
        "checks": {
            "v04_recovery_verified": True,
            "predecessor_binding_verified": True,
            "project_binding_match": True,
            "recovered_frontier_matches_predecessor": True,
            "candidate_ref_valid": True,
            "candidate_repo_no_remotes": True,
            "candidate_repo_fsck_full": True,
            "candidate_descends_from_recovered_frontier": True,
            "candidate_tree_match": True,
            "candidate_ref_set_match": True,
            "proposal_self_digest_match": True,
        },
        "reasons": [],
        "assessment_sha256": "0" * 64,
        "claims": {
            "proposal_reviewability_only": True,
            "human_recognition_required": True,
            "canonical_successor_established": False,
            "canonical_origin_mutated": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "distributed_consensus_established": False,
            "legal_effect_established": False,
            "truth_certified": False,
        },
    }
    a["assessment_sha256"] = R.self_digest(a, "assessment_sha256")
    return a


def main():
    policy = json.loads((V06 / "reference.human-canonical-recognition-policy.json").read_text(encoding="utf-8"))
    proposal = proposal_fixture()
    assessment = assessment_fixture(proposal)

    with tempfile.TemporaryDirectory(prefix="uu-aap-recognition-v06-") as td:
        root = Path(td)
        state = root / "state"
        kwargs = dict(
            human_actor_id="human:test-recognizer",
            actor_evidence_sha256="7" * 64,
            successor_origin_id="urn:uu-aap:canonical-origin:test-successor-1",
            nonce="recognition-nonce-00000001",
            issued_at="2026-08-23T15:00:00Z",
            expires_at="2026-08-23T17:00:00Z",
            confirmation_token=R.CONFIRM,
            state_dir=state,
        )
        recognition = R.issue_recognition(policy, proposal, assessment, **kwargs)
        assert recognition["claims"]["human_decision_recorded"] is True
        assert recognition["claims"]["canonical_successor_established"] is False
        assert recognition["claims"]["canonical_origin_created"] is False
        assert recognition["claims"]["publication_executed"] is False
        assert recognition["claims"]["kontur_activated"] is False
        assert recognition["claims"]["cryptographic_or_legal_identity_proven"] is False

        result = R.assess_recognition(policy, proposal, assessment, recognition, "2026-08-23T15:30:00Z")
        assert result["state"] == "recognition_valid"
        assert result["decision"] == "canonical_publication_authorization_may_be_requested"
        assert result["claims"]["canonical_successor_established"] is False
        assert result["claims"]["publication_executed"] is False

        # Same nonce and proposal replay is rejected.
        expect_fail(lambda: R.issue_recognition(policy, proposal, assessment, **kwargs), "reservation already exists")

        # Same proposal with a different nonce is still locally single-recognition.
        different_nonce = dict(kwargs)
        different_nonce["nonce"] = "recognition-nonce-00000002"
        expect_fail(lambda: R.issue_recognition(policy, proposal, assessment, **different_nonce), "reservation already exists")

        # Different proposal with same consumed nonce is rejected by nonce reservation.
        proposal2 = copy.deepcopy(proposal)
        proposal2["proposal_id"] = "urn:test:proposal:2"
        proposal2["candidate_frontier_commit"] = "8" * 40
        proposal2["proposal_sha256"] = "0" * 64
        proposal2["proposal_sha256"] = R.self_digest(proposal2, "proposal_sha256")
        assessment2 = assessment_fixture(proposal2)
        same_nonce = dict(kwargs)
        expect_fail(lambda: R.issue_recognition(policy, proposal2, assessment2, **same_nonce), "reservation already exists")

        bad_confirm = dict(kwargs)
        bad_confirm["state_dir"] = root / "state-bad-confirm"
        bad_confirm["nonce"] = "recognition-nonce-badconfirm"
        bad_confirm["confirmation_token"] = "YES"
        expect_fail(lambda: R.issue_recognition(policy, proposal2, assessment2, **bad_confirm), "exact human confirmation token")

        bad_evidence = dict(kwargs)
        bad_evidence["state_dir"] = root / "state-bad-evidence"
        bad_evidence["nonce"] = "recognition-nonce-badevidence"
        bad_evidence["actor_evidence_sha256"] = "not-a-digest"
        expect_fail(lambda: R.issue_recognition(policy, proposal2, assessment2, **bad_evidence), "actor_evidence_sha256")

        bad_origin = dict(kwargs)
        bad_origin["state_dir"] = root / "state-bad-origin"
        bad_origin["nonce"] = "recognition-nonce-badorigin01"
        bad_origin["successor_origin_id"] = "https://example.com/repo"
        expect_fail(lambda: R.issue_recognition(policy, proposal2, assessment2, **bad_origin), "logical urn")

        expired = R.assess_recognition(policy, proposal, assessment, recognition, "2026-08-23T17:00:00Z")
        assert expired["state"] == "rejected"
        assert expired["checks"]["recognition_window_valid"] is False

        tampered_proposal = copy.deepcopy(proposal)
        tampered_proposal["candidate_frontier_tree"] = "9" * 40
        tamper_assessment = R.assess_recognition(policy, tampered_proposal, assessment, recognition, "2026-08-23T15:30:00Z")
        assert tamper_assessment["state"] == "rejected"
        assert tamper_assessment["checks"]["proposal_self_digest_match"] is False

        tampered_assessment = copy.deepcopy(assessment)
        tampered_assessment["state"] = "rejected"
        tamper2 = R.assess_recognition(policy, proposal, tampered_assessment, recognition, "2026-08-23T15:30:00Z")
        assert tamper2["state"] == "rejected"
        assert tamper2["checks"]["proposal_assessment_self_digest_match"] is False

        overclaim = copy.deepcopy(recognition)
        overclaim["claims"]["canonical_successor_established"] = True
        overclaim["recognition_sha256"] = "0" * 64
        overclaim["recognition_sha256"] = R.self_digest(overclaim, "recognition_sha256")
        overclaim_assessment = R.assess_recognition(policy, proposal, assessment, overclaim, "2026-08-23T15:30:00Z")
        assert overclaim_assessment["state"] == "rejected"
        assert overclaim_assessment["checks"]["authority_boundary_preserved"] is False

    print("Project Survival Plane v0.6 Human Canonical Recognition tests: PASS")


if __name__ == "__main__":
    main()
