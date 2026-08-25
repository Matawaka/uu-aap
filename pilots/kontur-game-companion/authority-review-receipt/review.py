#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = ROOT / "externalization-authority-challenge" / "challenge.py"

spec = importlib.util.spec_from_file_location("authority_review_challenge", CHALLENGE)
challenge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(challenge)

class AuthorityReviewError(ValueError):
    pass

def req(condition, message):
    if not condition:
        raise AuthorityReviewError(message)

def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()

FALSE_EFFECTS = (
    "externalization_authority_granted",
    "grant_decision_present",
    "grant_token_created",
    "live_runtime_enabled",
    "live_runtime_bound",
    "external_transport_bound",
    "network_enabled",
    "user_surface_enabled",
    "send_permit",
    "send_authority",
    "response_authority_created",
    "external_effect_authorized",
    "delivery_attempted",
    "transport_invoked",
    "delivery_receipt_created",
    "action_permit_created",
    "successor_permit_created",
    "payload_persisted",
    "proactive_messaging_enabled",
    "background_messaging_enabled",
    "autonomous_gameplay_enabled",
    "account_control_enabled",
    "profiling_enabled",
    "cross_game_scope_enabled",
    "persistent_authority_created",
    "requested_scope_authorized",
    "requested_capability_authorized",
    "stable_core_promotion",
)

REVIEW_DIMENSIONS = (
    "identity_evidence_reviewed",
    "authority_evidence_reviewed",
    "scope_reviewed",
    "capability_reviewed",
    "duration_reviewed",
)

SUFFICIENCY_BINDINGS = (
    ("identity_evidence_reviewed", "identity_evidence_sufficient"),
    ("authority_evidence_reviewed", "authority_evidence_sufficient"),
    ("scope_reviewed", "scope_within_bounds"),
    ("capability_reviewed", "capability_within_bounds"),
    ("duration_reviewed", "duration_within_bounds"),
)

def validate_challenge_result(item):
    req(item.get("schema_version") == "kontur-game-companion-externalization-authority-challenge-v0.1", "challenge schema")
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    req(item.get("decision") in {"NOT_APPLICABLE", "IDENTITY_CHALLENGE_REQUIRED", "AUTHORITY_CHALLENGE_REQUIRED", "READY_FOR_AUTHORITY_REVIEW"}, "challenge decision")
    req(item.get("challenge_scope") == "THIS_ACTIVATION_REQUEST_ONLY", "challenge scope")
    req(item.get("purpose") == challenge.PURPOSE, "challenge purpose")
    req(item.get("requested_scope") == challenge.REQUEST_SCOPE, "challenge requested scope")
    req(item.get("requested_capability") == challenge.REQUEST_CAPABILITY, "challenge capability")
    req(item.get("duration") == challenge.DURATION, "challenge duration")
    req(item.get("challenge_digest") == challenge.sha({k: v for k, v in item.items() if k != "challenge_digest"}), "challenge digest")
    for field in challenge.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream challenge effect: {field}")
    for field in ("evidence_sufficiency_evaluated", "requester_identity_proven", "requester_authority_validated", "requested_scope_authorized", "requested_capability_authorized"):
        req(item.get(field) is False, f"upstream challenge performed review: {field}")
    req(item.get("authority_effect") == item.get("action_effect") == item.get("successor_effect") == "NONE", "challenge effects")
    req(item.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "challenge runtime")
    if item["decision"] == "READY_FOR_AUTHORITY_REVIEW":
        req(item.get("review_ready") is True, "ready challenge marker")
        req(item.get("identity_evidence_present") is True and item.get("authority_evidence_present") is True, "ready evidence markers")
        req(isinstance(item.get("identity_evidence_ref"), str) and len(item["identity_evidence_ref"]) == 64, "identity evidence ref")
        req(isinstance(item.get("authority_evidence_ref"), str) and len(item["authority_evidence_ref"]) == 64, "authority evidence ref")
    else:
        req(item.get("review_ready") is False, "non-ready challenge")

def default_review_context(item):
    validate_challenge_result(item)
    return {
        "schema_version": "kontur-game-companion-authority-review-context-v0.1",
        "source_challenge_digest": item["challenge_digest"],
        "review_scope": "THIS_ACTIVATION_REQUEST_ONLY",
        "reviewer_claim": "SYNTHETIC_AUTHORITY_REVIEWER",
        "independent_review_asserted": True,
        "identity_evidence_ref": item.get("identity_evidence_ref"),
        "authority_evidence_ref": item.get("authority_evidence_ref"),
        "identity_evidence_reviewed": False,
        "identity_evidence_sufficient": False,
        "authority_evidence_reviewed": False,
        "authority_evidence_sufficient": False,
        "scope_reviewed": False,
        "scope_within_bounds": False,
        "capability_reviewed": False,
        "capability_within_bounds": False,
        "duration_reviewed": False,
        "duration_within_bounds": False,
        "grant_decision_present": False,
        "grant_token_present": False,
        "externalization_authority_granted": False,
        "send_permit_available": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_review_context(item, ctx):
    validate_challenge_result(item)
    req(ctx.get("schema_version") == "kontur-game-companion-authority-review-context-v0.1", "review context schema")
    req(ctx.get("source_challenge_digest") == item.get("challenge_digest"), "review challenge binding")
    req(ctx.get("review_scope") == "THIS_ACTIVATION_REQUEST_ONLY", "review context scope")
    req(ctx.get("reviewer_claim") == "SYNTHETIC_AUTHORITY_REVIEWER", "reviewer claim")
    req(ctx.get("independent_review_asserted") is True, "independent review assertion")
    req(ctx.get("identity_evidence_ref") == item.get("identity_evidence_ref"), "identity evidence binding")
    req(ctx.get("authority_evidence_ref") == item.get("authority_evidence_ref"), "authority evidence binding")
    for field in REVIEW_DIMENSIONS:
        req(type(ctx.get(field)) is bool, f"review bool: {field}")
    for _, field in SUFFICIENCY_BINDINGS:
        req(type(ctx.get(field)) is bool, f"review outcome bool: {field}")
    for reviewed, result in SUFFICIENCY_BINDINGS:
        if ctx[result]:
            req(ctx[reviewed] is True, f"outcome without review: {result}")
    for field in ("grant_decision_present", "grant_token_present", "externalization_authority_granted", "send_permit_available", "live_runtime_bound", "external_transport_bound"):
        req(ctx.get(field) is False, f"forbidden review context effect: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "review context effects")
    if item["decision"] != "READY_FOR_AUTHORITY_REVIEW":
        for field in REVIEW_DIMENSIONS:
            req(ctx[field] is False, "review performed before ready")
        for _, field in SUFFICIENCY_BINDINGS:
            req(ctx[field] is False, "review result before ready")

def review(item, review_context=None):
    validate_challenge_result(item)
    ctx = default_review_context(item) if review_context is None else copy.deepcopy(review_context)
    validate_review_context(item, ctx)

    applicable = item["decision"] == "READY_FOR_AUTHORITY_REVIEW"
    all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)
    evidence_reviewed = applicable and ctx["identity_evidence_reviewed"] and ctx["authority_evidence_reviewed"]

    if not applicable:
        decision = "NOT_APPLICABLE"
        reason = "CHALLENGE_NOT_READY_FOR_AUTHORITY_REVIEW"
    elif not all_reviewed:
        decision = "REVIEW_INCOMPLETE"
        reason = "ONE_OR_MORE_REVIEW_DIMENSIONS_INCOMPLETE"
    elif not ctx["identity_evidence_sufficient"]:
        decision = "REVIEW_REJECTED_IDENTITY"
        reason = "IDENTITY_EVIDENCE_INSUFFICIENT_FOR_BOUNDED_REQUEST"
    elif not ctx["authority_evidence_sufficient"]:
        decision = "REVIEW_REJECTED_AUTHORITY"
        reason = "AUTHORITY_BASIS_INSUFFICIENT_FOR_BOUNDED_REQUEST"
    elif not ctx["scope_within_bounds"]:
        decision = "REVIEW_REJECTED_SCOPE"
        reason = "REQUEST_SCOPE_OUTSIDE_REVIEWED_BOUNDARY"
    elif not ctx["capability_within_bounds"]:
        decision = "REVIEW_REJECTED_CAPABILITY"
        reason = "REQUEST_CAPABILITY_OUTSIDE_REVIEWED_BOUNDARY"
    elif not ctx["duration_within_bounds"]:
        decision = "REVIEW_REJECTED_DURATION"
        reason = "REQUEST_DURATION_OUTSIDE_REVIEWED_BOUNDARY"
    else:
        decision = "REVIEW_COMPLETE_GRANT_REQUIRED"
        reason = "BOUNDED_REVIEW_COMPLETE_SEPARATE_GRANT_STILL_REQUIRED"

    out = {
        "schema_version": "kontur-game-companion-authority-review-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_challenge_digest": item["challenge_digest"],
        "review_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "review_receipt_scope": "THIS_REVIEW_ONLY",
        "reviewer_claim": ctx["reviewer_claim"],
        "independent_review_asserted": True,
        "reviewer_identity_proven": False,
        "independent_review_proven": False,
        "identity_evidence_ref": ctx["identity_evidence_ref"],
        "authority_evidence_ref": ctx["authority_evidence_ref"],
        "identity_evidence_reviewed": ctx["identity_evidence_reviewed"],
        "identity_evidence_sufficient_for_request": ctx["identity_evidence_sufficient"],
        "authority_evidence_reviewed": ctx["authority_evidence_reviewed"],
        "authority_basis_sufficient_for_request": ctx["authority_evidence_sufficient"],
        "scope_reviewed": ctx["scope_reviewed"],
        "scope_within_reviewed_bounds": ctx["scope_within_bounds"],
        "capability_reviewed": ctx["capability_reviewed"],
        "capability_within_reviewed_bounds": ctx["capability_within_bounds"],
        "duration_reviewed": ctx["duration_reviewed"],
        "duration_within_reviewed_bounds": ctx["duration_within_bounds"],
        "evidence_sufficiency_evaluated": evidence_reviewed,
        "review_completed": all_reviewed,
        "requester_identity_proven": False,
        "requester_authority_granted": False,
        "separate_grant_step_required": decision == "REVIEW_COMPLETE_GRANT_REQUIRED",
        "externalization_authority_granted": False,
        "grant_decision_present": False,
        "grant_token_created": False,
        "live_runtime_enabled": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "network_enabled": False,
        "user_surface_enabled": False,
        "send_permit": False,
        "send_authority": False,
        "response_authority_created": False,
        "external_effect_authorized": False,
        "delivery_attempted": False,
        "transport_invoked": False,
        "delivery_receipt_created": False,
        "action_permit_created": False,
        "successor_permit_created": False,
        "payload_persisted": False,
        "proactive_messaging_enabled": False,
        "background_messaging_enabled": False,
        "autonomous_gameplay_enabled": False,
        "account_control_enabled": False,
        "profiling_enabled": False,
        "cross_game_scope_enabled": False,
        "persistent_authority_created": False,
        "requested_scope_authorized": False,
        "requested_capability_authorized": False,
        "stable_core_promotion": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "SHADOW_ONLY_NOT_LIVE",
    }
    validate_receipt(item, ctx, out)
    out["authority_review_receipt_digest"] = sha(out)
    return out

def validate_receipt(item, ctx, out):
    validate_review_context(item, ctx)
    req(out.get("schema_version") == "kontur-game-companion-authority-review-receipt-v0.1", "review receipt schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "review receipt status")
    req(out.get("scope_id") == item.get("scope_id") and out.get("source_turn") == item.get("source_turn"), "review source")
    req(out.get("source_challenge_digest") == item.get("challenge_digest"), "review challenge binding")
    req(out.get("review_context_digest") == sha(ctx), "review context binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "REVIEW_INCOMPLETE", "REVIEW_REJECTED_IDENTITY", "REVIEW_REJECTED_AUTHORITY", "REVIEW_REJECTED_SCOPE", "REVIEW_REJECTED_CAPABILITY", "REVIEW_REJECTED_DURATION", "REVIEW_COMPLETE_GRANT_REQUIRED"}, "review decision")
    req(out.get("review_receipt_scope") == "THIS_REVIEW_ONLY", "review receipt scope")
    req(out.get("reviewer_claim") == ctx["reviewer_claim"], "reviewer binding")
    req(out.get("independent_review_asserted") is True, "independent review marker")
    req(out.get("reviewer_identity_proven") is False and out.get("independent_review_proven") is False, "reviewer proof overclaim")
    req(out.get("identity_evidence_ref") == ctx["identity_evidence_ref"] and out.get("authority_evidence_ref") == ctx["authority_evidence_ref"], "evidence ref binding")
    req(out.get("identity_evidence_reviewed") is ctx["identity_evidence_reviewed"], "identity review binding")
    req(out.get("identity_evidence_sufficient_for_request") is ctx["identity_evidence_sufficient"], "identity sufficiency binding")
    req(out.get("authority_evidence_reviewed") is ctx["authority_evidence_reviewed"], "authority review binding")
    req(out.get("authority_basis_sufficient_for_request") is ctx["authority_evidence_sufficient"], "authority sufficiency binding")
    req(out.get("scope_reviewed") is ctx["scope_reviewed"] and out.get("scope_within_reviewed_bounds") is ctx["scope_within_bounds"], "scope review binding")
    req(out.get("capability_reviewed") is ctx["capability_reviewed"] and out.get("capability_within_reviewed_bounds") is ctx["capability_within_bounds"], "capability review binding")
    req(out.get("duration_reviewed") is ctx["duration_reviewed"] and out.get("duration_within_reviewed_bounds") is ctx["duration_within_bounds"], "duration review binding")
    applicable = item["decision"] == "READY_FOR_AUTHORITY_REVIEW"
    expected_all_reviewed = applicable and all(ctx[field] for field in REVIEW_DIMENSIONS)
    expected_evidence_reviewed = applicable and ctx["identity_evidence_reviewed"] and ctx["authority_evidence_reviewed"]
    req(out.get("review_completed") is expected_all_reviewed, "review completion")
    req(out.get("evidence_sufficiency_evaluated") is expected_evidence_reviewed, "evidence sufficiency evaluation")
    req(out.get("requester_identity_proven") is False and out.get("requester_authority_granted") is False, "requester authority overclaim")
    req(out.get("separate_grant_step_required") is (out["decision"] == "REVIEW_COMPLETE_GRANT_REQUIRED"), "grant step marker")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"review receipt effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "review receipt effects")
    req(out.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "review runtime")

    if not applicable:
        expected = "NOT_APPLICABLE"
    elif not expected_all_reviewed:
        expected = "REVIEW_INCOMPLETE"
    elif not ctx["identity_evidence_sufficient"]:
        expected = "REVIEW_REJECTED_IDENTITY"
    elif not ctx["authority_evidence_sufficient"]:
        expected = "REVIEW_REJECTED_AUTHORITY"
    elif not ctx["scope_within_bounds"]:
        expected = "REVIEW_REJECTED_SCOPE"
    elif not ctx["capability_within_bounds"]:
        expected = "REVIEW_REJECTED_CAPABILITY"
    elif not ctx["duration_within_bounds"]:
        expected = "REVIEW_REJECTED_DURATION"
    else:
        expected = "REVIEW_COMPLETE_GRANT_REQUIRED"
    req(out["decision"] == expected, "review decision semantics")

if __name__ == "__main__":
    print("authority review receipt is library-first; run validate.py")
