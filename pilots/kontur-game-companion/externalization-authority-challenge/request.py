#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ACTIVATION = ROOT / "runtime-activation-boundary" / "activation.py"

spec = importlib.util.spec_from_file_location("externalization_activation", ACTIVATION)
act = importlib.util.module_from_spec(spec)
spec.loader.exec_module(act)

class ExternalizationChallengeError(ValueError):
    pass

def req(condition, message):
    if not condition:
        raise ExternalizationChallengeError(message)

def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()

FALSE_EFFECTS = (
    "externalization_authority_granted",
    "requester_identity_validated",
    "requester_authority_validated",
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
    "action_permit_created",
    "successor_permit_created",
    "payload_persisted",
    "proactive_messaging_enabled",
    "background_activity_enabled",
    "game_account_control_enabled",
    "stable_core_promotion",
)

ALLOWED_PURPOSE = "BOUNDED_LIVE_COMPANION_VALIDATION"
ALLOWED_SCOPE = "THIS_SYNTHETIC_SESSION_ONLY"
ALLOWED_CAPABILITIES = ["LIVE_RESPONSE_DELIVERY"]
ALLOWED_DURATION = "ONE_SESSION"

def validate_activation_assessment(assessment):
    req(assessment.get("schema_version") == "kontur-game-companion-runtime-activation-assessment-v0.1", "activation schema")
    req(assessment.get("status") == "SYNTHETIC_NON_EXECUTING", "activation status")
    req(assessment.get("decision") in {"SHADOW_ONLY_CONFIRMED", "PRECONDITIONS_REVIEW", "EXTERNAL_AUTHORIZATION_REQUIRED", "NOT_APPLICABLE"}, "activation decision")
    req(assessment.get("assessment_scope") == "THIS_SHADOW_RESULT_ONLY", "activation scope")
    req(assessment.get("activation_assessment_digest") == act.sha({k: v for k, v in assessment.items() if k != "activation_assessment_digest"}), "activation digest")
    for field in act.FALSE_EFFECTS:
        req(assessment.get(field) is False, f"upstream activation effect: {field}")
    req(assessment.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "upstream runtime")

def default_request_context(assessment):
    return {
        "schema_version": "kontur-game-companion-live-activation-request-context-v0.1",
        "source_activation_assessment_digest": assessment["activation_assessment_digest"],
        "requester_claim": "SYNTHETIC_OPERATOR_A",
        "requester_identity_evidence_present": False,
        "requester_authority_evidence_present": False,
        "purpose": ALLOWED_PURPOSE,
        "requested_scope": ALLOWED_SCOPE,
        "requested_capabilities": copy.deepcopy(ALLOWED_CAPABILITIES),
        "requested_duration": ALLOWED_DURATION,
        "rollback_required": True,
        "audit_receipt_required": True,
        "player_can_stop": True,
        "proactive_messaging_requested": False,
        "background_activity_requested": False,
        "game_account_control_requested": False,
        "cross_game_scope_requested": False,
        "externalization_authority_granted": False,
        "send_permit_available": False,
        "live_runtime_bound": False,
        "external_transport_bound": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }

def validate_request_context(assessment, ctx):
    req(ctx.get("schema_version") == "kontur-game-companion-live-activation-request-context-v0.1", "request context schema")
    req(ctx.get("source_activation_assessment_digest") == assessment.get("activation_assessment_digest"), "activation binding")
    req(isinstance(ctx.get("requester_claim"), str) and ctx["requester_claim"].startswith("SYNTHETIC_"), "synthetic requester claim")
    for field in ("requester_identity_evidence_present", "requester_authority_evidence_present"):
        req(type(ctx.get(field)) is bool, f"evidence marker: {field}")
    req(ctx.get("purpose") == ALLOWED_PURPOSE, "purpose")
    req(ctx.get("requested_scope") == ALLOWED_SCOPE, "requested scope")
    req(ctx.get("requested_capabilities") == ALLOWED_CAPABILITIES, "requested capabilities")
    req(ctx.get("requested_duration") == ALLOWED_DURATION, "requested duration")
    for field in ("rollback_required", "audit_receipt_required", "player_can_stop"):
        req(ctx.get(field) is True, f"required boundary: {field}")
    for field in (
        "proactive_messaging_requested", "background_activity_requested", "game_account_control_requested",
        "cross_game_scope_requested", "externalization_authority_granted", "send_permit_available",
        "live_runtime_bound", "external_transport_bound",
    ):
        req(ctx.get(field) is False, f"forbidden request effect: {field}")
    req(ctx.get("authority_effect") == ctx.get("action_effect") == ctx.get("successor_effect") == "NONE", "request context effects")

def challenge(assessment, request_context=None):
    validate_activation_assessment(assessment)
    ctx = default_request_context(assessment) if request_context is None else copy.deepcopy(request_context)
    validate_request_context(assessment, ctx)

    applicable = assessment["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED"
    if not applicable:
        decision = "NOT_APPLICABLE"
        reason = "UPSTREAM_EXTERNAL_AUTHORIZATION_NOT_REQUESTABLE"
    elif not ctx["requester_identity_evidence_present"]:
        decision = "IDENTITY_CHALLENGE_REQUIRED"
        reason = "REQUESTER_IDENTITY_EVIDENCE_ABSENT"
    elif not ctx["requester_authority_evidence_present"]:
        decision = "AUTHORITY_CHALLENGE_REQUIRED"
        reason = "REQUESTER_AUTHORITY_EVIDENCE_ABSENT"
    else:
        decision = "READY_FOR_AUTHORITY_REVIEW"
        reason = "BOUNDED_REQUEST_COMPLETE_REVIEW_STILL_REQUIRED"

    out = {
        "schema_version": "kontur-game-companion-externalization-authority-challenge-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": assessment.get("scope_id"),
        "source_turn": assessment.get("source_turn"),
        "source_activation_assessment_digest": assessment.get("activation_assessment_digest"),
        "request_context_digest": sha(ctx),
        "decision": decision,
        "reason": reason,
        "request_scope": "THIS_REQUEST_ONLY",
        "requester_claim": ctx["requester_claim"],
        "requester_identity_evidence_present": ctx["requester_identity_evidence_present"],
        "requester_authority_evidence_present": ctx["requester_authority_evidence_present"],
        "requester_identity_validated": False,
        "requester_authority_validated": False,
        "purpose": ctx["purpose"],
        "requested_scope": ctx["requested_scope"],
        "requested_capabilities": copy.deepcopy(ctx["requested_capabilities"]),
        "requested_duration": ctx["requested_duration"],
        "rollback_required": True,
        "audit_receipt_required": True,
        "player_can_stop": True,
        "authority_review_required": decision == "READY_FOR_AUTHORITY_REVIEW",
        "externalization_authority_granted": False,
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
        "action_permit_created": False,
        "successor_permit_created": False,
        "payload_persisted": False,
        "proactive_messaging_enabled": False,
        "background_activity_enabled": False,
        "game_account_control_enabled": False,
        "stable_core_promotion": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "SHADOW_ONLY_NOT_LIVE",
    }
    validate_challenge(assessment, ctx, out)
    out["authority_challenge_digest"] = sha(out)
    return out

def validate_challenge(assessment, ctx, out):
    req(out.get("schema_version") == "kontur-game-companion-externalization-authority-challenge-v0.1", "challenge schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    req(out.get("scope_id") == assessment.get("scope_id") and out.get("source_turn") == assessment.get("source_turn"), "challenge source")
    req(out.get("source_activation_assessment_digest") == assessment.get("activation_assessment_digest"), "challenge activation binding")
    req(out.get("request_context_digest") == sha(ctx), "request context binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "IDENTITY_CHALLENGE_REQUIRED", "AUTHORITY_CHALLENGE_REQUIRED", "READY_FOR_AUTHORITY_REVIEW"}, "challenge decision")
    req(out.get("request_scope") == "THIS_REQUEST_ONLY", "challenge request scope")
    req(out.get("requester_claim") == ctx["requester_claim"], "requester claim binding")
    req(out.get("requester_identity_evidence_present") is ctx["requester_identity_evidence_present"], "identity evidence binding")
    req(out.get("requester_authority_evidence_present") is ctx["requester_authority_evidence_present"], "authority evidence binding")
    req(out.get("purpose") == ALLOWED_PURPOSE and out.get("requested_scope") == ALLOWED_SCOPE, "request purpose/scope")
    req(out.get("requested_capabilities") == ALLOWED_CAPABILITIES and out.get("requested_duration") == ALLOWED_DURATION, "request capability/duration")
    req(out.get("rollback_required") is True and out.get("audit_receipt_required") is True and out.get("player_can_stop") is True, "request safeguards")
    req(out.get("authority_review_required") is (out["decision"] == "READY_FOR_AUTHORITY_REVIEW"), "authority review marker")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"challenge effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "challenge effects")
    req(out.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "challenge runtime")

    if assessment["decision"] != "EXTERNAL_AUTHORIZATION_REQUIRED":
        req(out["decision"] == "NOT_APPLICABLE", "non-applicable request accepted")
    elif not ctx["requester_identity_evidence_present"]:
        req(out["decision"] == "IDENTITY_CHALLENGE_REQUIRED", "identity challenge bypass")
    elif not ctx["requester_authority_evidence_present"]:
        req(out["decision"] == "AUTHORITY_CHALLENGE_REQUIRED", "authority challenge bypass")
    else:
        req(out["decision"] == "READY_FOR_AUTHORITY_REVIEW", "complete request not reviewable")

if __name__ == "__main__":
    print("externalization authority challenge is library-first; run validate.py")
