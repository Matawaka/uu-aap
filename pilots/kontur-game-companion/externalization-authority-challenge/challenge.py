#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ACTIVATION = ROOT / "runtime-activation-boundary" / "activation.py"

spec = importlib.util.spec_from_file_location("externalization_activation_boundary", ACTIVATION)
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

PURPOSE = "BOUNDED_LIVE_COMPANION_VALIDATION"
REQUEST_SCOPE = "THIS_SYNTHETIC_SESSION_ONLY"
REQUEST_CAPABILITY = "LIVE_RESPONSE_DELIVERY"
DURATION = "ONE_SESSION"

FALSE_EFFECTS = (
    "externalization_authority_granted",
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
    "background_messaging_enabled",
    "proactive_messaging_enabled",
    "autonomous_gameplay_enabled",
    "account_control_enabled",
    "profiling_enabled",
    "cross_game_scope_enabled",
    "stable_core_promotion",
)

def validate_activation_assessment(assessment):
    req(assessment.get("schema_version") == "kontur-game-companion-runtime-activation-assessment-v0.1", "activation assessment schema")
    req(assessment.get("status") == "SYNTHETIC_NON_EXECUTING", "activation assessment status")
    req(assessment.get("decision") in {"SHADOW_ONLY_CONFIRMED", "PRECONDITIONS_REVIEW", "EXTERNAL_AUTHORIZATION_REQUIRED", "NOT_APPLICABLE"}, "activation decision")
    req(assessment.get("assessment_scope") == "THIS_SHADOW_RESULT_ONLY", "activation assessment scope")
    req(isinstance(assessment.get("activation_assessment_digest"), str) and len(assessment["activation_assessment_digest"]) == 64, "activation digest")
    req(assessment["activation_assessment_digest"] == act.sha({k: v for k, v in assessment.items() if k != "activation_assessment_digest"}), "activation digest binding")
    for field in act.FALSE_EFFECTS:
        req(assessment.get(field) is False, f"activation effect: {field}")
    req(assessment.get("authority_effect") == assessment.get("action_effect") == assessment.get("successor_effect") == "NONE", "activation effects")
    req(assessment.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "activation runtime")
    if assessment["decision"] == "EXTERNAL_AUTHORIZATION_REQUIRED":
        req(assessment.get("technical_preconditions_complete") is True, "external authorization without technical completeness")
        req(assessment.get("externalization_authority_required") is True, "external authority requirement missing")
        req(assessment.get("externalization_authority_present") is False, "external authority already present")

def default_request(assessment):
    validate_activation_assessment(assessment)
    request = {
        "schema_version": "kontur-game-companion-live-activation-request-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "source_activation_assessment_digest": assessment["activation_assessment_digest"],
        "requester_claim": "SYNTHETIC_PILOT_OPERATOR",
        "purpose": PURPOSE,
        "requested_scope": REQUEST_SCOPE,
        "requested_capability": REQUEST_CAPABILITY,
        "duration": DURATION,
        "externalization_requested": True,
        "requester_identity_evidence_present": False,
        "requester_identity_evidence_ref": None,
        "requester_authority_evidence_present": False,
        "requester_authority_evidence_ref": None,
        "rollback_requirement_acknowledged": True,
        "audit_requirement_acknowledged": True,
        "expiry_requirement_acknowledged": True,
        "revocation_requirement_acknowledged": True,
        "proactive_messaging_requested": False,
        "background_messaging_requested": False,
        "autonomous_gameplay_requested": False,
        "account_control_requested": False,
        "profiling_requested": False,
        "cross_game_scope_requested": False,
        "persistent_authority_requested": False,
        "stable_core_promotion_requested": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    request["request_digest"] = sha(request)
    return request

def validate_request(assessment, request):
    validate_activation_assessment(assessment)
    req(request.get("schema_version") == "kontur-game-companion-live-activation-request-v0.1", "request schema")
    req(request.get("status") == "SYNTHETIC_NON_EXECUTING", "request status")
    req(request.get("source_activation_assessment_digest") == assessment.get("activation_assessment_digest"), "request assessment binding")
    req(request.get("requester_claim") == "SYNTHETIC_PILOT_OPERATOR", "requester claim")
    req(request.get("purpose") == PURPOSE, "request purpose")
    req(request.get("requested_scope") == REQUEST_SCOPE, "request scope")
    req(request.get("requested_capability") == REQUEST_CAPABILITY, "request capability")
    req(request.get("duration") == DURATION, "request duration")
    req(request.get("externalization_requested") is True, "externalization request marker")
    for field in ("rollback_requirement_acknowledged", "audit_requirement_acknowledged", "expiry_requirement_acknowledged", "revocation_requirement_acknowledged"):
        req(request.get(field) is True, f"mandatory request boundary: {field}")
    for field in (
        "proactive_messaging_requested", "background_messaging_requested", "autonomous_gameplay_requested",
        "account_control_requested", "profiling_requested", "cross_game_scope_requested",
        "persistent_authority_requested", "stable_core_promotion_requested",
    ):
        req(request.get(field) is False, f"overbroad request: {field}")
    for marker, ref in (
        ("requester_identity_evidence_present", "requester_identity_evidence_ref"),
        ("requester_authority_evidence_present", "requester_authority_evidence_ref"),
    ):
        req(type(request.get(marker)) is bool, f"evidence marker: {marker}")
        if request[marker]:
            req(isinstance(request.get(ref), str) and len(request[ref]) == 64, f"evidence ref: {ref}")
        else:
            req(request.get(ref) is None, f"evidence ref without marker: {ref}")
    req(request.get("authority_effect") == request.get("action_effect") == request.get("successor_effect") == "NONE", "request effects")
    req(request.get("request_digest") == sha({k: v for k, v in request.items() if k != "request_digest"}), "request digest")

def evaluate(assessment, request=None):
    validate_activation_assessment(assessment)
    request = default_request(assessment) if request is None else copy.deepcopy(request)
    validate_request(assessment, request)

    identity_present = request["requester_identity_evidence_present"]
    authority_present = request["requester_authority_evidence_present"]

    if assessment["decision"] != "EXTERNAL_AUTHORIZATION_REQUIRED":
        decision = "NOT_APPLICABLE"
        reason = "PREDECESSOR_NOT_REQUESTING_EXTERNAL_AUTHORIZATION"
        review_ready = False
    elif not identity_present:
        decision = "IDENTITY_CHALLENGE_REQUIRED"
        reason = "REQUESTER_IDENTITY_EVIDENCE_ABSENT"
        review_ready = False
    elif not authority_present:
        decision = "AUTHORITY_CHALLENGE_REQUIRED"
        reason = "REQUESTER_AUTHORITY_EVIDENCE_ABSENT"
        review_ready = False
    else:
        decision = "READY_FOR_AUTHORITY_REVIEW"
        reason = "BOUNDED_REQUEST_AND_EVIDENCE_REFERENCES_PRESENT"
        review_ready = True

    out = {
        "schema_version": "kontur-game-companion-externalization-authority-challenge-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": assessment.get("scope_id"),
        "source_turn": assessment.get("source_turn"),
        "source_activation_assessment_digest": assessment["activation_assessment_digest"],
        "source_request_digest": request["request_digest"],
        "decision": decision,
        "reason": reason,
        "review_ready": review_ready,
        "challenge_scope": "THIS_ACTIVATION_REQUEST_ONLY",
        "requester_claim": request["requester_claim"],
        "purpose": request["purpose"],
        "requested_scope": request["requested_scope"],
        "requested_capability": request["requested_capability"],
        "duration": request["duration"],
        "identity_evidence_present": identity_present,
        "authority_evidence_present": authority_present,
        "identity_evidence_ref": request["requester_identity_evidence_ref"],
        "authority_evidence_ref": request["requester_authority_evidence_ref"],
        "evidence_sufficiency_evaluated": False,
        "requester_identity_proven": False,
        "requester_authority_validated": False,
        "requested_scope_authorized": False,
        "requested_capability_authorized": False,
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
        "delivery_receipt_created": False,
        "action_permit_created": False,
        "successor_permit_created": False,
        "payload_persisted": False,
        "background_messaging_enabled": False,
        "proactive_messaging_enabled": False,
        "autonomous_gameplay_enabled": False,
        "account_control_enabled": False,
        "profiling_enabled": False,
        "cross_game_scope_enabled": False,
        "stable_core_promotion": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "SHADOW_ONLY_NOT_LIVE",
    }
    validate_result(assessment, request, out)
    out["challenge_digest"] = sha(out)
    return out

def validate_result(assessment, request, out):
    validate_request(assessment, request)
    req(out.get("schema_version") == "kontur-game-companion-externalization-authority-challenge-v0.1", "challenge schema")
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "challenge status")
    req(out.get("scope_id") == assessment.get("scope_id") and out.get("source_turn") == assessment.get("source_turn"), "challenge source")
    req(out.get("source_activation_assessment_digest") == assessment.get("activation_assessment_digest"), "challenge assessment binding")
    req(out.get("source_request_digest") == request.get("request_digest"), "challenge request binding")
    req(out.get("decision") in {"NOT_APPLICABLE", "IDENTITY_CHALLENGE_REQUIRED", "AUTHORITY_CHALLENGE_REQUIRED", "READY_FOR_AUTHORITY_REVIEW"}, "challenge decision")
    req(out.get("challenge_scope") == "THIS_ACTIVATION_REQUEST_ONLY", "challenge scope")
    req(out.get("requester_claim") == request.get("requester_claim"), "requester binding")
    req(out.get("purpose") == request.get("purpose") and out.get("requested_scope") == request.get("requested_scope"), "request purpose/scope binding")
    req(out.get("requested_capability") == request.get("requested_capability") and out.get("duration") == request.get("duration"), "request capability binding")
    req(out.get("identity_evidence_present") is request.get("requester_identity_evidence_present"), "identity evidence marker")
    req(out.get("authority_evidence_present") is request.get("requester_authority_evidence_present"), "authority evidence marker")
    req(out.get("identity_evidence_ref") == request.get("requester_identity_evidence_ref"), "identity ref binding")
    req(out.get("authority_evidence_ref") == request.get("requester_authority_evidence_ref"), "authority ref binding")
    for field in ("evidence_sufficiency_evaluated", "requester_identity_proven", "requester_authority_validated", "requested_scope_authorized", "requested_capability_authorized"):
        req(out.get(field) is False, f"unperformed authority proof: {field}")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"challenge effect: {field}")
    req(out.get("authority_effect") == out.get("action_effect") == out.get("successor_effect") == "NONE", "challenge effects")
    req(out.get("runtime_connectedness") == "SHADOW_ONLY_NOT_LIVE", "challenge runtime")

    if assessment["decision"] != "EXTERNAL_AUTHORIZATION_REQUIRED":
        expected = "NOT_APPLICABLE"
    elif not request["requester_identity_evidence_present"]:
        expected = "IDENTITY_CHALLENGE_REQUIRED"
    elif not request["requester_authority_evidence_present"]:
        expected = "AUTHORITY_CHALLENGE_REQUIRED"
    else:
        expected = "READY_FOR_AUTHORITY_REVIEW"
    req(out["decision"] == expected, "challenge state")
    req(out.get("review_ready") is (expected == "READY_FOR_AUTHORITY_REVIEW"), "review readiness")

if __name__ == "__main__":
    print("externalization authority challenge is library-first; run validate.py")
