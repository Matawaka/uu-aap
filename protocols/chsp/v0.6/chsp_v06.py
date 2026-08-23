#!/usr/bin/env python3
"""CHSP v0.6 local-only external stewardship binding tooling.

This module validates an already-effective CHSP v0.5 stewardship state, records
an external-principal claim and evidence attestations, and can build/assess a
proposal-only external binding. It performs no network, Git, repository,
account, ownership, publication, or KONTUR mutations.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
EVIDENCE_CLASSES = {
    "identity_match", "role_visibility", "challenge_response",
    "signature_verification", "repository_metadata",
}
RESULTS = {"support", "contradict", "indeterminate"}


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def self_digest(value: dict[str, Any], field: str) -> str:
    work = copy.deepcopy(value)
    work[field] = "0" * 64
    return sha256_json(work)


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def artifact_set_sha(items: list[dict[str, Any]], digest_field: str) -> str:
    digests: list[str] = []
    for item in items:
        digest = item.get(digest_field, "")
        require(HEX64_RE.fullmatch(digest) is not None, f"invalid {digest_field}")
        digests.append(digest)
    require(len(digests) == len(set(digests)), f"duplicate {digest_field}")
    return sha256_json(sorted(digests))


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPExternalBindingPolicy", "CHSPExternalBindingPolicy required")
    require(policy.get("artifact_version") == "0.6", "CHSPExternalBindingPolicy v0.6 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    for key in ["minimum_supporting_attestations", "minimum_observer_domains", "minimum_evidence_classes", "maximum_observation_age_days"]:
        require(isinstance(policy.get(key), int) and policy[key] >= 1, f"invalid policy threshold: {key}")
    strong = policy.get("strong_possession_classes") or []
    require(set(strong) and set(strong).issubset({"challenge_response", "signature_verification"}), "invalid strong possession classes")
    require(policy.get("allowed_external_system_types"), "allowed external systems required")
    require(policy.get("allowed_claimed_roles"), "allowed claimed roles required")
    req = policy.get("requirements") or {}
    for key in [
        "v05_stewardship_state_required", "v05_execution_receipt_required",
        "claim_bound_to_exact_stewardship_state", "attestation_evidence_digest_required",
        "attestor_domain_declared", "contradiction_blocks", "strong_possession_required",
    ]:
        require(req.get(key) is True, f"unsafe/missing policy requirement: {key}")
    for key in ["automatic_external_transition", "automatic_ownership_transfer", "automatic_canonical_origin_mutation", "automatic_kontur_activation"]:
        require(req.get(key) is False, f"unsafe automatic policy setting: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_policy_only") is True, "policy must remain descriptive")
    for key in [
        "external_binding_established", "domain_independence_proven", "repository_ownership_transferred",
        "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed",
        "kontur_activated", "legal_ownership_adjudicated", "universal_identity_proven",
        "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe policy claim: {key}")


def validate_v05_state(state: dict[str, Any], receipt: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_policy(policy)
    require(state.get("artifact_type") == "CHSPCanonicalStewardshipState", "CHSPCanonicalStewardshipState required")
    require(state.get("artifact_version") == "0.5", "CHSPCanonicalStewardshipState v0.5 required")
    require(receipt.get("artifact_type") == "CHSPHandoverExecutionReceipt", "CHSPHandoverExecutionReceipt required")
    require(receipt.get("artifact_version") == "0.5", "CHSPHandoverExecutionReceipt v0.5 required")
    state_sha = state.get("state_sha256", "")
    receipt_sha = receipt.get("receipt_sha256", "")
    require(HEX64_RE.fullmatch(state_sha) is not None, "invalid v0.5 stewardship state digest")
    require(HEX64_RE.fullmatch(receipt_sha) is not None, "invalid v0.5 execution receipt digest")
    require(self_digest(state, "state_sha256") == state_sha, "v0.5 stewardship state self-digest mismatch")
    require(self_digest(receipt, "receipt_sha256") == receipt_sha, "v0.5 execution receipt self-digest mismatch")
    require(state.get("project_id") == policy["project_id"], "v0.5 state project mismatch")
    require(receipt.get("project_id") == policy["project_id"], "v0.5 receipt project mismatch")
    require(receipt.get("stewardship_state_sha256") == state_sha, "receipt/state binding mismatch")
    require(receipt.get("candidate_id") == state.get("current_steward_id"), "receipt/current steward mismatch")
    require(receipt.get("predecessor_steward_id") == state.get("predecessor_steward_id"), "receipt/predecessor mismatch")
    require(receipt.get("execution_nonce") == state.get("execution_nonce"), "receipt/state execution nonce mismatch")
    state_claims = state.get("claims") or {}
    require(state_claims.get("chsp_protocol_canonical_stewardship_effective") is True, "CHSP stewardship is not effective")
    require(state_claims.get("effective_scope_chsp_protocol_only") is True, "v0.5 stewardship scope must remain CHSP-only")
    for key in [
        "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated",
        "canonical_publication_executed", "external_system_control_changed", "kontur_activated",
        "predecessor_legal_rights_adjudicated", "legal_ownership_adjudicated",
        "distributed_consensus_established", "universal_trust_established",
    ]:
        require(state_claims.get(key) is False, f"unsafe v0.5 state claim: {key}")
    receipt_claims = receipt.get("claims") or {}
    require(receipt_claims.get("chsp_handover_execution_performed") is True, "v0.5 execution not recorded")
    require(receipt_claims.get("chsp_stewardship_state_recorded") is True, "v0.5 state recording claim missing")
    require(receipt_claims.get("recorder_is_authority_source") is False, "recorder cannot be authority source")
    for key in [
        "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated",
        "canonical_publication_executed", "external_system_mutation_performed", "kontur_activated",
        "global_revocation_absence_proven", "global_replay_prevention_established", "legal_effect_established",
        "distributed_consensus_established", "universal_trust_established",
    ]:
        require(receipt_claims.get(key) is False, f"unsafe v0.5 receipt claim: {key}")


def claim_claims() -> dict[str, Any]:
    return {
        "steward_declared_mapping": True,
        "current_external_control_proven": False,
        "external_identity_universally_proven": False,
        "external_binding_established": False,
        "repository_ownership_proven": False,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "external_mutation_performed": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "kontur_activated": False,
        "legal_effect_established": False,
    }


def issue_claim(
    state: dict[str, Any], receipt: dict[str, Any], policy: dict[str, Any],
    external_system_type: str, external_system_id: str, external_principal_id: str,
    claimed_role: str, nonce: str, at: str,
) -> dict[str, Any]:
    validate_v05_state(state, receipt, policy)
    require(external_system_type in policy["allowed_external_system_types"], "external system type not allowed")
    require(claimed_role in policy["allowed_claimed_roles"], "claimed role not allowed")
    require(isinstance(external_system_id, str) and external_system_id, "external_system_id required")
    require(isinstance(external_principal_id, str) and external_principal_id, "external_principal_id required")
    require(isinstance(nonce, str) and len(nonce) >= 16, "claim nonce too short")
    now = parse_time(at)
    require(now >= parse_time(state["effective_at"]), "external claim cannot predate stewardship state")
    claim = {
        "artifact_type": "CHSPExternalPrincipalClaim",
        "artifact_version": "0.6",
        "claim_id": "urn:uu-aap:chsp:external-principal-claim:" + sha256_json({"state": state["state_sha256"], "system": external_system_id, "principal": external_principal_id, "nonce": nonce})[:24],
        "project_id": policy["project_id"],
        "steward_id": state["current_steward_id"],
        "v05_stewardship_state_sha256": state["state_sha256"],
        "v05_execution_receipt_sha256": receipt["receipt_sha256"],
        "external_system_type": external_system_type,
        "external_system_id": external_system_id,
        "external_principal_id": external_principal_id,
        "claimed_role": claimed_role,
        "claimed_at": iso_z(now),
        "nonce": nonce,
        "claim_sha256": "0" * 64,
        "claims": claim_claims(),
    }
    claim["claim_sha256"] = self_digest(claim, "claim_sha256")
    return claim


def validate_claim(claim: dict[str, Any], state: dict[str, Any], receipt: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_v05_state(state, receipt, policy)
    require(claim.get("artifact_type") == "CHSPExternalPrincipalClaim", "CHSPExternalPrincipalClaim required")
    require(claim.get("artifact_version") == "0.6", "CHSPExternalPrincipalClaim v0.6 required")
    digest = claim.get("claim_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid claim digest")
    require(self_digest(claim, "claim_sha256") == digest, "claim self-digest mismatch")
    require(claim.get("project_id") == policy["project_id"], "claim project mismatch")
    require(claim.get("steward_id") == state["current_steward_id"], "claim steward mismatch")
    require(claim.get("v05_stewardship_state_sha256") == state["state_sha256"], "claim state binding mismatch")
    require(claim.get("v05_execution_receipt_sha256") == receipt["receipt_sha256"], "claim receipt binding mismatch")
    require(claim.get("external_system_type") in policy["allowed_external_system_types"], "external system type not allowed")
    require(claim.get("claimed_role") in policy["allowed_claimed_roles"], "claimed role not allowed")
    require(isinstance(claim.get("external_system_id"), str) and claim["external_system_id"], "invalid external system id")
    require(isinstance(claim.get("external_principal_id"), str) and claim["external_principal_id"], "invalid external principal id")
    require(isinstance(claim.get("nonce"), str) and len(claim["nonce"]) >= 16, "invalid claim nonce")
    require(parse_time(claim["claimed_at"]) >= parse_time(state["effective_at"]), "claim predates stewardship state")
    claims = claim.get("claims") or {}
    require(claims.get("steward_declared_mapping") is True, "steward mapping declaration missing")
    for key in [
        "current_external_control_proven", "external_identity_universally_proven", "external_binding_established",
        "repository_ownership_proven", "repository_ownership_transferred", "account_control_transferred",
        "external_mutation_performed", "canonical_origin_mutated", "canonical_publication_executed",
        "kontur_activated", "legal_effect_established",
    ]:
        require(claims.get(key) is False, f"unsafe claim assertion: {key}")


def attestation_claims() -> dict[str, Any]:
    return {
        "observation_recorded": True,
        "evidence_truth_certified": False,
        "observer_domain_independence_proven": False,
        "external_binding_established": False,
        "external_control_transferred": False,
        "repository_ownership_transferred": False,
        "canonical_origin_mutated": False,
        "kontur_activated": False,
        "legal_effect_established": False,
    }


def issue_attestation(
    claim: dict[str, Any], policy: dict[str, Any], observer_id: str, observer_domain_id: str,
    evidence_class: str, result: str, observed_at: str, evidence_sha256: str,
) -> dict[str, Any]:
    require(claim.get("artifact_type") == "CHSPExternalPrincipalClaim" and claim.get("artifact_version") == "0.6", "valid v0.6 claim required")
    require(self_digest(claim, "claim_sha256") == claim.get("claim_sha256"), "claim self-digest mismatch")
    require(claim.get("project_id") == policy.get("project_id"), "claim/policy project mismatch")
    require(isinstance(observer_id, str) and observer_id, "observer_id required")
    require(isinstance(observer_domain_id, str) and observer_domain_id, "observer_domain_id required")
    require(evidence_class in EVIDENCE_CLASSES, "invalid evidence class")
    require(result in RESULTS, "invalid attestation result")
    require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None, "invalid evidence digest")
    observed = parse_time(observed_at)
    require(observed >= parse_time(claim["claimed_at"]), "attestation cannot predate claim")
    value = {
        "artifact_type": "CHSPExternalControlAttestation",
        "artifact_version": "0.6",
        "attestation_id": "urn:uu-aap:chsp:external-attestation:" + sha256_json({"claim": claim["claim_sha256"], "observer": observer_id, "class": evidence_class, "evidence": evidence_sha256})[:24],
        "project_id": policy["project_id"],
        "claim_sha256": claim["claim_sha256"],
        "observer_id": observer_id,
        "observer_domain_id": observer_domain_id,
        "evidence_class": evidence_class,
        "result": result,
        "observed_at": iso_z(observed),
        "evidence_sha256": evidence_sha256,
        "contains_credentials": False,
        "attestation_sha256": "0" * 64,
        "claims": attestation_claims(),
    }
    value["attestation_sha256"] = self_digest(value, "attestation_sha256")
    return value


def validate_attestation(attestation: dict[str, Any], claim: dict[str, Any], policy: dict[str, Any]) -> None:
    require(attestation.get("artifact_type") == "CHSPExternalControlAttestation", "CHSPExternalControlAttestation required")
    require(attestation.get("artifact_version") == "0.6", "CHSPExternalControlAttestation v0.6 required")
    digest = attestation.get("attestation_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid attestation digest")
    require(self_digest(attestation, "attestation_sha256") == digest, "attestation self-digest mismatch")
    require(attestation.get("project_id") == policy["project_id"], "attestation project mismatch")
    require(attestation.get("claim_sha256") == claim["claim_sha256"], "attestation claim binding mismatch")
    require(isinstance(attestation.get("observer_id"), str) and attestation["observer_id"], "invalid observer id")
    require(isinstance(attestation.get("observer_domain_id"), str) and attestation["observer_domain_id"], "invalid observer domain")
    require(attestation.get("evidence_class") in EVIDENCE_CLASSES, "invalid evidence class")
    require(attestation.get("result") in RESULTS, "invalid attestation result")
    require(HEX64_RE.fullmatch(attestation.get("evidence_sha256", "")) is not None, "invalid evidence digest")
    require(attestation.get("contains_credentials") is False, "credentials are prohibited in attestations")
    require(parse_time(attestation["observed_at"]) >= parse_time(claim["claimed_at"]), "attestation predates claim")
    claims = attestation.get("claims") or {}
    require(claims.get("observation_recorded") is True, "observation not recorded")
    for key in [
        "evidence_truth_certified", "observer_domain_independence_proven", "external_binding_established",
        "external_control_transferred", "repository_ownership_transferred", "canonical_origin_mutated",
        "kontur_activated", "legal_effect_established",
    ]:
        require(claims.get(key) is False, f"unsafe attestation claim: {key}")


def _evidence_snapshot(claim: dict[str, Any], attestations: list[dict[str, Any]], policy: dict[str, Any], at: str) -> dict[str, Any]:
    now = parse_time(at)
    require(now >= parse_time(claim["claimed_at"]), "assessment cannot predate claim")
    seen: set[str] = set()
    fresh: list[dict[str, Any]] = []
    stale = 0
    for item in attestations:
        validate_attestation(item, claim, policy)
        digest = item["attestation_sha256"]
        require(digest not in seen, "duplicate attestation")
        seen.add(digest)
        observed = parse_time(item["observed_at"])
        require(observed <= now, "attestation is from the future")
        if now - observed <= timedelta(days=policy["maximum_observation_age_days"]):
            fresh.append(item)
        else:
            stale += 1
    support = [x for x in fresh if x["result"] == "support"]
    contradict = [x for x in fresh if x["result"] == "contradict"]
    indeterminate = [x for x in fresh if x["result"] == "indeterminate"]
    domains = sorted({x["observer_domain_id"] for x in support})
    classes = sorted({x["evidence_class"] for x in support})
    strong_present = bool(set(classes).intersection(policy["strong_possession_classes"]))
    oldest_age = 0
    if support:
        oldest = min(parse_time(x["observed_at"]) for x in support)
        oldest_age = max(0, int((now - oldest).total_seconds() // 86400))
    sufficient = (
        len(support) >= policy["minimum_supporting_attestations"]
        and len(domains) >= policy["minimum_observer_domains"]
        and len(classes) >= policy["minimum_evidence_classes"]
        and strong_present
        and not contradict
    )
    return {
        "fresh": fresh,
        "support": support,
        "contradict": contradict,
        "indeterminate": indeterminate,
        "domains": domains,
        "classes": classes,
        "strong_present": strong_present,
        "oldest_age": oldest_age,
        "stale": stale,
        "sufficient": sufficient,
    }


def proposal_claims() -> dict[str, Any]:
    return {
        "proposal_only": True,
        "evidence_threshold_satisfied": True,
        "external_binding_established": False,
        "external_control_transition_authorized": False,
        "external_control_transferred": False,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "kontur_activated": False,
        "legal_ownership_adjudicated": False,
        "universal_identity_proven": False,
        "distributed_consensus_established": False,
    }


def build_proposal(
    state: dict[str, Any], receipt: dict[str, Any], policy: dict[str, Any],
    claim: dict[str, Any], attestations: list[dict[str, Any]], at: str,
) -> dict[str, Any]:
    validate_claim(claim, state, receipt, policy)
    snap = _evidence_snapshot(claim, attestations, policy, at)
    require(not snap["contradict"], "contradictory external evidence blocks proposal")
    require(snap["sufficient"], "external evidence threshold not satisfied")
    supporting_digests = sorted(x["attestation_sha256"] for x in snap["support"])
    value = {
        "artifact_type": "CHSPExternalBindingProposal",
        "artifact_version": "0.6",
        "proposal_id": "urn:uu-aap:chsp:external-binding-proposal:" + sha256_json({"claim": claim["claim_sha256"], "supports": supporting_digests, "at": iso_z(parse_time(at))})[:24],
        "project_id": policy["project_id"],
        "steward_id": state["current_steward_id"],
        "v05_stewardship_state_sha256": state["state_sha256"],
        "v05_execution_receipt_sha256": receipt["receipt_sha256"],
        "claim_sha256": claim["claim_sha256"],
        "attestation_set_sha256": artifact_set_sha(snap["fresh"], "attestation_sha256"),
        "supporting_attestation_sha256s": supporting_digests,
        "observer_domain_ids": snap["domains"],
        "evidence_classes": snap["classes"],
        "external_system_type": claim["external_system_type"],
        "external_system_id": claim["external_system_id"],
        "external_principal_id": claim["external_principal_id"],
        "claimed_role": claim["claimed_role"],
        "proposed_binding_scope": "descriptive_external_stewardship_mapping",
        "created_at": iso_z(parse_time(at)),
        "proposal_sha256": "0" * 64,
        "claims": proposal_claims(),
    }
    value["proposal_sha256"] = self_digest(value, "proposal_sha256")
    return value


def validate_proposal(
    proposal: dict[str, Any], state: dict[str, Any], receipt: dict[str, Any], policy: dict[str, Any],
    claim: dict[str, Any], attestations: list[dict[str, Any]], at: str,
) -> None:
    validate_claim(claim, state, receipt, policy)
    require(proposal.get("artifact_type") == "CHSPExternalBindingProposal", "CHSPExternalBindingProposal required")
    require(proposal.get("artifact_version") == "0.6", "CHSPExternalBindingProposal v0.6 required")
    digest = proposal.get("proposal_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid proposal digest")
    require(self_digest(proposal, "proposal_sha256") == digest, "proposal self-digest mismatch")
    snap = _evidence_snapshot(claim, attestations, policy, at)
    require(snap["sufficient"] and not snap["contradict"], "proposal evidence no longer satisfies policy")
    require(proposal.get("project_id") == policy["project_id"], "proposal project mismatch")
    require(proposal.get("steward_id") == state["current_steward_id"], "proposal steward mismatch")
    require(proposal.get("v05_stewardship_state_sha256") == state["state_sha256"], "proposal state mismatch")
    require(proposal.get("v05_execution_receipt_sha256") == receipt["receipt_sha256"], "proposal receipt mismatch")
    require(proposal.get("claim_sha256") == claim["claim_sha256"], "proposal claim mismatch")
    require(proposal.get("attestation_set_sha256") == artifact_set_sha(snap["fresh"], "attestation_sha256"), "proposal attestation set mismatch")
    require(proposal.get("supporting_attestation_sha256s") == sorted(x["attestation_sha256"] for x in snap["support"]), "proposal supporting attestation set mismatch")
    require(proposal.get("observer_domain_ids") == snap["domains"], "proposal observer domain set mismatch")
    require(proposal.get("evidence_classes") == snap["classes"], "proposal evidence class set mismatch")
    for key in ["external_system_type", "external_system_id", "external_principal_id", "claimed_role"]:
        require(proposal.get(key) == claim.get(key), f"proposal/claim mismatch: {key}")
    require(proposal.get("proposed_binding_scope") == "descriptive_external_stewardship_mapping", "unsafe proposed binding scope")
    claims = proposal.get("claims") or {}
    require(claims.get("proposal_only") is True and claims.get("evidence_threshold_satisfied") is True, "proposal boundary claims missing")
    for key in [
        "external_binding_established", "external_control_transition_authorized", "external_control_transferred",
        "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated",
        "canonical_publication_executed", "kontur_activated", "legal_ownership_adjudicated",
        "universal_identity_proven", "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe proposal claim: {key}")


def assessment_claims(reviewable: bool) -> dict[str, Any]:
    return {
        "policy_sufficiency_only": True,
        "external_binding_review_eligible": reviewable,
        "external_binding_established": False,
        "external_control_transition_authorized": False,
        "external_control_transferred": False,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "kontur_activated": False,
        "legal_ownership_adjudicated": False,
        "universal_identity_proven": False,
        "domain_independence_proven": False,
        "distributed_consensus_established": False,
    }


def assess_binding(
    state: dict[str, Any], receipt: dict[str, Any], policy: dict[str, Any],
    claim: dict[str, Any], attestations: list[dict[str, Any]], proposal: dict[str, Any] | None, at: str,
) -> dict[str, Any]:
    validate_claim(claim, state, receipt, policy)
    snap = _evidence_snapshot(claim, attestations, policy, at)
    reasons: list[str] = []
    proposal_sha: str | None = None
    reviewable = False
    if snap["contradict"]:
        state_name = "evidence_conflicted"
        decision = "resolve_external_evidence_conflict"
        reasons.append("one or more fresh contradictory external-control attestations block review eligibility")
    elif not snap["sufficient"]:
        state_name = "evidence_insufficient"
        decision = "collect_more_external_evidence"
        reasons.append("supporting external evidence does not satisfy the reference threshold")
    elif proposal is None:
        state_name = "evidence_insufficient"
        decision = "collect_more_external_evidence"
        reasons.append("evidence threshold is satisfied but no exact binding proposal was supplied")
    else:
        validate_proposal(proposal, state, receipt, policy, claim, attestations, at)
        proposal_sha = proposal["proposal_sha256"]
        state_name = "binding_review_eligible"
        decision = "external_binding_human_review_may_be_requested"
        reviewable = True
        reasons.append("evidence threshold and exact proposal bindings satisfy the reference policy")
    result = {
        "artifact_type": "CHSPExternalBindingAssessment",
        "artifact_version": "0.6",
        "assessment_id": "urn:uu-aap:chsp:external-binding-assessment:" + sha256_json({"claim": claim["claim_sha256"], "set": artifact_set_sha(snap["fresh"], "attestation_sha256") if snap["fresh"] else sha256_json([]), "proposal": proposal_sha, "at": iso_z(parse_time(at))})[:24],
        "evaluated_at": iso_z(parse_time(at)),
        "project_id": policy["project_id"],
        "steward_id": state["current_steward_id"],
        "v05_stewardship_state_sha256": state["state_sha256"],
        "v05_execution_receipt_sha256": receipt["receipt_sha256"],
        "claim_sha256": claim["claim_sha256"],
        "attestation_set_sha256": artifact_set_sha(snap["fresh"], "attestation_sha256") if snap["fresh"] else sha256_json([]),
        "proposal_sha256": proposal_sha,
        "state": state_name,
        "decision": decision,
        "metrics": {
            "supporting_attestations": len(snap["support"]),
            "contradictory_attestations": len(snap["contradict"]),
            "indeterminate_attestations": len(snap["indeterminate"]),
            "observer_domains": len(snap["domains"]),
            "evidence_classes": len(snap["classes"]),
            "strong_possession_present": snap["strong_present"],
            "oldest_support_age_days": snap["oldest_age"],
        },
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": assessment_claims(reviewable),
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result
