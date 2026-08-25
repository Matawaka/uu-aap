#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REVIEW = ROOT / "network-user-surface-enablement-externalization-review" / "review.py"

spec = importlib.util.spec_from_file_location(
    "network_user_surface_enablement_grant_review",
    REVIEW,
)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class NetworkUserSurfaceEnablementGrantError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceEnablementGrantError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


GRANT_RECEIPT_SCOPE = "THIS_ENABLEMENT_EXTERNALIZATION_REVIEW_ONLY"
GRANTED_SCOPE = "THIS_REVIEWED_LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY"
GRANTED_CAPABILITY = "MATERIALIZE_LOCAL_SYNTHETIC_NETWORK_USER_SURFACE_ENABLEMENT_STATE"
GRANTED_DURATION = "ONE_SYNTHETIC_SESSION"
EXPIRY_BOUNDARY = "SYNTHETIC_SESSION_END"
REVOCATION_MODE = "EXPLICIT_OR_SYNTHETIC_SESSION_END"
GRANTOR_CLAIM = "HUMAN_ENABLEMENT_GRANTOR"

NO_HUMAN_DECISION = "NO_HUMAN_DECISION"
DENY_DECISION = "DENY_BOUNDED_SYNTHETIC_ENABLEMENT"
MORE_EVIDENCE_DECISION = "REQUEST_MORE_ENABLEMENT_EVIDENCE"
GRANT_DECISION = "GRANT_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION"
HUMAN_DECISIONS = (
    NO_HUMAN_DECISION,
    DENY_DECISION,
    MORE_EVIDENCE_DECISION,
    GRANT_DECISION,
)

PROVENANCE_FIELDS = tuple(dict.fromkeys(
    review.PROVENANCE_FIELDS
    + (
        "source_enablement_challenge_receipt_digest",
        "review_context_digest",
        "enablement_externalization_review_receipt_digest",
    )
))

FORBIDDEN_REQUESTS = (
    "enablement_materialization_requested",
    "network_enablement_requested",
    "user_surface_enablement_requested",
    "network_connection_requested",
    "user_surface_exposure_requested",
    "live_runtime_enablement_requested",
    "external_transport_enablement_requested",
    "endpoint_resolution_requested",
    "transport_invocation_requested",
    "delivery_attempt_requested",
    "send_permit_requested",
    "send_authority_requested",
    "credential_material_requested",
    "secret_material_requested",
    "endpoint_credential_requested",
    "bearer_credential_requested",
    "payload_persistence_requested",
    "proactive_messaging_requested",
    "background_messaging_requested",
    "autonomous_gameplay_requested",
    "account_control_requested",
    "profiling_requested",
    "persistent_enablement_requested",
    "cross_session_enablement_requested",
    "cross_game_scope_requested",
    "scope_expansion_requested",
    "capability_expansion_requested",
    "copyright_process_change_requested",
    "license_or_notice_change_requested",
    "legal_author_identity_change_requested",
    "pseudonym_publication_change_requested",
)

ALLOWED_AUTHORITY_FIELDS = {
    "enablement_grant_decision_present",
    "enablement_grant_created",
    "enablement_authority_granted",
    "network_enablement_authority_granted",
    "user_surface_enablement_authority_granted",
}

FALSE_EFFECTS = tuple(dict.fromkeys(
    tuple(
        field
        for field in review.FALSE_EFFECTS
        if field not in ALLOWED_AUTHORITY_FIELDS
    )
    + (
        "enablement_materialized",
        "network_enablement_materialized",
        "user_surface_enablement_materialized",
        "network_enabled",
        "user_surface_enabled",
        "network_connection_created",
        "user_surface_exposure_created",
        "live_runtime_enabled",
        "live_runtime_bound",
        "external_transport_bound",
        "endpoint_resolved",
        "transport_invoked",
        "delivery_attempted",
        "delivery_receipt_created",
        "send_permit",
        "send_authority",
        "response_authority_created",
        "external_effect_authorized",
        "credential_material_created",
        "secret_material_created",
        "endpoint_credential_created",
        "bearer_credential_created",
        "action_permit_created",
        "successor_permit_created",
        "payload_persisted",
        "proactive_messaging_enabled",
        "background_messaging_enabled",
        "autonomous_gameplay_enabled",
        "account_control_enabled",
        "profiling_enabled",
        "persistent_enablement_created",
        "cross_session_enablement_enabled",
        "cross_game_scope_enabled",
        "stable_core_promotion",
        "real_world_enablement_authority_created",
        "copyright_process_modified",
        "license_or_notice_modified",
        "legal_author_identity_modified",
        "pseudonym_publication_process_modified",
    )
))


def validate_review_receipt(item):
    req(isinstance(item, dict), "enablement review receipt object")
    req(
        item.get("schema_version")
        == (
            "kontur-game-companion-network-user-surface-"
            "enablement-externalization-review-receipt-v0.1"
        ),
        "enablement review receipt schema",
    )
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement review status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ENABLEMENT_REVIEW_INCOMPLETE",
        "ENABLEMENT_REVIEW_REJECTED_PROVENANCE",
        "ENABLEMENT_REVIEW_REJECTED_NETWORK_CONTRACT",
        "ENABLEMENT_REVIEW_REJECTED_USER_SURFACE_CONTRACT",
        "ENABLEMENT_REVIEW_REJECTED_ROLLBACK",
        "ENABLEMENT_REVIEW_REJECTED_AUDIT_SINK",
        "ENABLEMENT_REVIEW_REJECTED_FRESHNESS",
        "ENABLEMENT_REVIEW_REJECTED_SCOPE",
        "ENABLEMENT_REVIEW_REJECTED_CAPABILITY",
        "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED",
    }, "enablement review decision")
    digest = item.get("enablement_externalization_review_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "enablement review receipt digest")
    req(
        digest == review.sha({
            key: value
            for key, value in item.items()
            if key != "enablement_externalization_review_receipt_digest"
        }),
        "enablement review receipt digest binding",
    )
    req(
        item.get("enablement_externalization_review_scope") == review.REVIEW_SCOPE,
        "enablement review scope",
    )
    req(item.get("reviewer_claim") == review.REVIEWER_CLAIM, "enablement reviewer claim")
    req(item.get("reviewer_identity_proven") is False, "reviewer identity overclaim")
    req(item.get("independent_review_proven") is False, "independent review overclaim")
    req(
        item.get("runtime_connectedness")
        == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
        "enablement review connectedness",
    )
    req(
        item.get("authority_effect")
        == item.get("action_effect")
        == item.get("successor_effect")
        == "NONE",
        "enablement review causal effects",
    )
    for field in review.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream enablement review effect: {field}")
    for field in (
        "review_is_enablement_grant",
        "review_is_enablement",
        "review_is_send_permit",
        "review_is_bearer_credential",
    ):
        req(item.get(field) is False, f"upstream review non-authority marker: {field}")

    complete = item["decision"] == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
    req(item.get("enablement_externalization_sufficiency_confirmed") is complete, "review sufficiency")
    req(item.get("separate_enablement_grant_required") is complete, "separate grant requirement")
    req(
        item.get("human_enablement_grant_decision_required") is complete,
        "human grant decision requirement",
    )
    req(item.get("human_enablement_grant_decision_present") is False, "upstream human decision overclaim")
    if complete:
        req(item.get("enablement_review_completed") is True, "complete review marker")
        for reviewed, result in review.RESULT_BINDINGS:
            req(item.get(reviewed) is True, f"complete review marker: {reviewed}")
            req(item.get(result) is True, f"complete review result: {result}")
        for field in PROVENANCE_FIELDS:
            value = item.get(field)
            req(isinstance(value, str) and len(value) == 64, f"complete review provenance: {field}")


def revocation_handle_for(item):
    return sha({
        "kind": "KONTUR_BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_REVOCATION_HANDLE_V0.1",
        "source_enablement_externalization_review_receipt_digest": item[
            "enablement_externalization_review_receipt_digest"
        ],
        "granted_scope": GRANTED_SCOPE,
        "granted_capability": GRANTED_CAPABILITY,
        "granted_duration": GRANTED_DURATION,
    })


def default_grant_context(item):
    validate_review_receipt(item)
    context = {
        "schema_version": "kontur-game-companion-network-user-surface-enablement-grant-context-v0.1",
        "source_enablement_externalization_review_receipt_digest": item[
            "enablement_externalization_review_receipt_digest"
        ],
        "human_decision_asserted": False,
        "human_decision": NO_HUMAN_DECISION,
        "human_decision_evidence_ref": None,
        "grantor_claim": None,
        "granted_scope": GRANTED_SCOPE,
        "granted_capability": GRANTED_CAPABILITY,
        "granted_duration": GRANTED_DURATION,
        "expiry_boundary": EXPIRY_BOUNDARY,
        "revocation_mode": REVOCATION_MODE,
        "revocation_handle": revocation_handle_for(item),
        "revocation_requested": False,
        "expiry_boundary_reached": False,
        "challenge_scope": item.get("challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "requested_duration": item.get("requested_duration"),
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in PROVENANCE_FIELDS:
        context[field] = item.get(field)
    for field in FORBIDDEN_REQUESTS:
        context[field] = False
    return context


def validate_grant_context(item, context):
    validate_review_receipt(item)
    req(
        context.get("schema_version")
        == "kontur-game-companion-network-user-surface-enablement-grant-context-v0.1",
        "enablement grant context schema",
    )
    req(
        context.get("source_enablement_externalization_review_receipt_digest")
        == item.get("enablement_externalization_review_receipt_digest"),
        "enablement review receipt provenance",
    )
    req(type(context.get("human_decision_asserted")) is bool, "human decision assertion bool")
    req(context.get("human_decision") in HUMAN_DECISIONS, "human decision")
    asserted = context["human_decision_asserted"]
    has_decision = context["human_decision"] != NO_HUMAN_DECISION
    req(asserted is has_decision, "human decision assertion binding")
    if asserted:
        evidence_ref = context.get("human_decision_evidence_ref")
        req(isinstance(evidence_ref, str) and len(evidence_ref) == 64, "human decision evidence ref")
        req(context.get("grantor_claim") == GRANTOR_CLAIM, "grantor claim")
    else:
        req(context.get("human_decision_evidence_ref") is None, "decision evidence without decision")
        req(context.get("grantor_claim") is None, "grantor claim without decision")

    req(context.get("granted_scope") == GRANTED_SCOPE, "granted scope")
    req(context.get("granted_capability") == GRANTED_CAPABILITY, "granted capability")
    req(context.get("granted_duration") == GRANTED_DURATION, "granted duration")
    req(context.get("expiry_boundary") == EXPIRY_BOUNDARY, "grant expiry boundary")
    req(context.get("revocation_mode") == REVOCATION_MODE, "grant revocation mode")
    req(context.get("revocation_handle") == revocation_handle_for(item), "revocation handle")
    req(type(context.get("revocation_requested")) is bool, "revocation requested bool")
    req(type(context.get("expiry_boundary_reached")) is bool, "expiry boundary bool")
    req(
        not (context["revocation_requested"] and context["expiry_boundary_reached"]),
        "revocation and expiry simultaneously",
    )
    if context["revocation_requested"] or context["expiry_boundary_reached"]:
        req(context["human_decision"] == GRANT_DECISION, "grant lifecycle without grant decision")
    req(context.get("challenge_scope") == item.get("challenge_scope"), "challenge scope provenance")
    req(
        context.get("requested_capability") == item.get("requested_capability"),
        "requested capability provenance",
    )
    req(
        context.get("requested_duration") == item.get("requested_duration"),
        "requested duration provenance",
    )
    for field in PROVENANCE_FIELDS:
        req(context.get(field) == item.get(field), f"enablement grant provenance: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(context.get(field) is False, f"forbidden enablement grant request: {field}")
    req(
        context.get("authority_effect")
        == context.get("action_effect")
        == context.get("successor_effect")
        == "NONE",
        "grant context causal effects",
    )
    if item["decision"] != "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED":
        req(context["human_decision_asserted"] is False, "human grant decision on ineligible review")
        req(context["human_decision"] == NO_HUMAN_DECISION, "grant decision on ineligible review")
        req(
            context["revocation_requested"] is False
            and context["expiry_boundary_reached"] is False,
            "grant lifecycle on ineligible review",
        )


def grant(item, grant_context=None):
    validate_review_receipt(item)
    context = (
        default_grant_context(item)
        if grant_context is None
        else copy.deepcopy(grant_context)
    )
    validate_grant_context(item, context)

    applicable = item["decision"] == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
    human_decision = context["human_decision"]
    if not applicable:
        decision, reason = (
            "NOT_APPLICABLE",
            "ENABLEMENT_EXTERNALIZATION_REVIEW_NOT_COMPLETE",
        )
    elif human_decision == NO_HUMAN_DECISION:
        decision, reason = (
            "ENABLEMENT_GRANT_DECISION_REQUIRED",
            "EXPLICIT_HUMAN_ENABLEMENT_GRANT_DECISION_ABSENT",
        )
    elif human_decision == DENY_DECISION:
        decision, reason = (
            "ENABLEMENT_GRANT_DENIED",
            "HUMAN_DENIED_BOUNDED_SYNTHETIC_ENABLEMENT",
        )
    elif human_decision == MORE_EVIDENCE_DECISION:
        decision, reason = (
            "ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED",
            "HUMAN_REQUESTED_MORE_ENABLEMENT_EVIDENCE",
        )
    elif context["revocation_requested"]:
        decision, reason = (
            "ENABLEMENT_GRANT_REVOKED",
            "EXPLICIT_ENABLEMENT_GRANT_REVOCATION_APPLIED",
        )
    elif context["expiry_boundary_reached"]:
        decision, reason = (
            "ENABLEMENT_GRANT_EXPIRED",
            "ENABLEMENT_GRANT_SYNTHETIC_SESSION_EXPIRY_REACHED",
        )
    else:
        decision, reason = (
            "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED",
            "HUMAN_ASSERTED_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY",
        )

    historical = decision in {
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED",
        "ENABLEMENT_GRANT_REVOKED",
        "ENABLEMENT_GRANT_EXPIRED",
    }
    active = decision == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    authority_effect = {
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED": (
            "CREATE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
        "ENABLEMENT_GRANT_REVOKED": (
            "REVOKE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
        "ENABLEMENT_GRANT_EXPIRED": (
            "EXPIRE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
    }.get(decision, "NONE")

    out = {
        "schema_version": "kontur-game-companion-network-user-surface-enablement-grant-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_enablement_externalization_review_receipt_digest": item[
            "enablement_externalization_review_receipt_digest"
        ],
        "grant_context_digest": sha(context),
        "decision": decision,
        "reason": reason,
        "enablement_grant_receipt_scope": GRANT_RECEIPT_SCOPE,
        "human_decision_asserted": context["human_decision_asserted"],
        "human_decision": human_decision,
        "human_decision_evidence_ref": context["human_decision_evidence_ref"],
        "human_decision_authenticated": False,
        "grantor_claim": context["grantor_claim"],
        "grantor_identity_proven": False,
        "grantor_real_world_authority_proven": False,
        "grant_authority_basis_validated_for_synthetic_scope": historical,
        "granted_scope": GRANTED_SCOPE,
        "granted_capability": GRANTED_CAPABILITY,
        "granted_duration": GRANTED_DURATION,
        "expiry_boundary": EXPIRY_BOUNDARY,
        "revocation_mode": REVOCATION_MODE,
        "revocation_handle": revocation_handle_for(item),
        "challenge_scope": item.get("challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "requested_duration": item.get("requested_duration"),
        "grant_decision_receipt_created": context["human_decision_asserted"],
        "enablement_grant_historically_issued": historical,
        "enablement_grant_currently_active": active,
        "enablement_grant_revoked": decision == "ENABLEMENT_GRANT_REVOKED",
        "enablement_grant_expired": decision == "ENABLEMENT_GRANT_EXPIRED",
        "enablement_grant_denied": decision == "ENABLEMENT_GRANT_DENIED",
        "enablement_more_evidence_required": decision == "ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED",
        "enablement_grant_decision_present": context["human_decision_asserted"],
        "enablement_grant_created": historical,
        "enablement_scope_authorized_now": active,
        "enablement_capability_authorized_now": active,
        "enablement_authority_granted": active,
        "network_enablement_authority_granted": active,
        "user_surface_enablement_authority_granted": active,
        "enablement_materialization_required": active,
        "network_enablement_step_required_after_materialization": active,
        "user_surface_enablement_step_required_after_materialization": active,
        "send_permit_required_after_enablement": active,
        "synthetic_enablement_authority_only": historical,
        "grant_is_action_permit": False,
        "grant_is_successor_permit": False,
        "grant_is_send_permit": False,
        "grant_is_bearer_credential": False,
        "authority_effect": authority_effect,
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
    }
    for field in PROVENANCE_FIELDS:
        out[field] = item.get(field)
    for field in FALSE_EFFECTS:
        out[field] = False

    validate_grant_receipt(item, context, out)
    out["enablement_grant_receipt_digest"] = sha(out)
    return out


def validate_grant_receipt(item, context, out):
    validate_grant_context(item, context)
    req(
        out.get("schema_version")
        == "kontur-game-companion-network-user-surface-enablement-grant-receipt-v0.1",
        "enablement grant receipt schema",
    )
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement grant status")
    req(
        out.get("scope_id") == item.get("scope_id")
        and out.get("source_turn") == item.get("source_turn"),
        "enablement grant source",
    )
    req(
        out.get("source_enablement_externalization_review_receipt_digest")
        == item.get("enablement_externalization_review_receipt_digest"),
        "enablement review receipt binding",
    )
    req(out.get("grant_context_digest") == sha(context), "enablement grant context digest")
    req(out.get("enablement_grant_receipt_scope") == GRANT_RECEIPT_SCOPE, "grant receipt scope")
    req(out.get("human_decision_asserted") is context.get("human_decision_asserted"), "decision assertion")
    req(out.get("human_decision") == context.get("human_decision"), "human decision binding")
    req(
        out.get("human_decision_evidence_ref") == context.get("human_decision_evidence_ref"),
        "human decision evidence binding",
    )
    req(out.get("human_decision_authenticated") is False, "human decision authentication overclaim")
    req(out.get("grantor_claim") == context.get("grantor_claim"), "grantor claim binding")
    req(
        out.get("grantor_identity_proven") is False
        and out.get("grantor_real_world_authority_proven") is False,
        "grantor proof overclaim",
    )
    req(
        out.get("granted_scope") == GRANTED_SCOPE
        and out.get("granted_capability") == GRANTED_CAPABILITY
        and out.get("granted_duration") == GRANTED_DURATION,
        "enablement grant bounds",
    )
    req(
        out.get("expiry_boundary") == EXPIRY_BOUNDARY
        and out.get("revocation_mode") == REVOCATION_MODE,
        "enablement grant lifecycle bounds",
    )
    req(out.get("revocation_handle") == revocation_handle_for(item), "revocation handle binding")
    req(out.get("challenge_scope") == item.get("challenge_scope"), "receipt challenge scope")
    req(
        out.get("requested_capability") == item.get("requested_capability"),
        "receipt requested capability",
    )
    req(
        out.get("requested_duration") == item.get("requested_duration"),
        "receipt requested duration",
    )
    for field in PROVENANCE_FIELDS:
        req(out.get(field) == item.get(field), f"enablement grant receipt provenance: {field}")

    applicable = item["decision"] == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
    human_decision = context["human_decision"]
    if not applicable:
        expected = "NOT_APPLICABLE"
    elif human_decision == NO_HUMAN_DECISION:
        expected = "ENABLEMENT_GRANT_DECISION_REQUIRED"
    elif human_decision == DENY_DECISION:
        expected = "ENABLEMENT_GRANT_DENIED"
    elif human_decision == MORE_EVIDENCE_DECISION:
        expected = "ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED"
    elif context["revocation_requested"]:
        expected = "ENABLEMENT_GRANT_REVOKED"
    elif context["expiry_boundary_reached"]:
        expected = "ENABLEMENT_GRANT_EXPIRED"
    else:
        expected = "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    req(out.get("decision") == expected, "enablement grant decision derivation")

    historical = expected in {
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED",
        "ENABLEMENT_GRANT_REVOKED",
        "ENABLEMENT_GRANT_EXPIRED",
    }
    active = expected == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    req(
        out.get("grant_authority_basis_validated_for_synthetic_scope") is historical,
        "synthetic authority basis marker",
    )
    req(
        out.get("grant_decision_receipt_created") is context["human_decision_asserted"],
        "grant decision receipt marker",
    )
    req(out.get("enablement_grant_historically_issued") is historical, "historical grant marker")
    req(out.get("enablement_grant_currently_active") is active, "active grant marker")
    req(out.get("enablement_grant_revoked") is (expected == "ENABLEMENT_GRANT_REVOKED"), "revocation marker")
    req(out.get("enablement_grant_expired") is (expected == "ENABLEMENT_GRANT_EXPIRED"), "expiry marker")
    req(out.get("enablement_grant_denied") is (expected == "ENABLEMENT_GRANT_DENIED"), "denial marker")
    req(
        out.get("enablement_more_evidence_required")
        is (expected == "ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED"),
        "more evidence marker",
    )
    req(
        out.get("enablement_grant_decision_present") is context["human_decision_asserted"],
        "grant decision presence",
    )
    req(out.get("enablement_grant_created") is historical, "grant creation marker")
    for field in (
        "enablement_scope_authorized_now",
        "enablement_capability_authorized_now",
        "enablement_authority_granted",
        "network_enablement_authority_granted",
        "user_surface_enablement_authority_granted",
        "enablement_materialization_required",
        "network_enablement_step_required_after_materialization",
        "user_surface_enablement_step_required_after_materialization",
        "send_permit_required_after_enablement",
    ):
        req(out.get(field) is active, f"active enablement grant marker: {field}")
    req(out.get("synthetic_enablement_authority_only") is historical, "synthetic authority scope")
    for field in (
        "grant_is_action_permit",
        "grant_is_successor_permit",
        "grant_is_send_permit",
        "grant_is_bearer_credential",
    ):
        req(out.get(field) is False, f"grant non-effect marker: {field}")

    expected_authority_effect = {
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED": (
            "CREATE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
        "ENABLEMENT_GRANT_REVOKED": (
            "REVOKE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
        "ENABLEMENT_GRANT_EXPIRED": (
            "EXPIRE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
    }.get(expected, "NONE")
    req(out.get("authority_effect") == expected_authority_effect, "enablement authority effect")
    req(out.get("action_effect") == out.get("successor_effect") == "NONE", "grant non-authority effects")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"enablement grant external effect: {field}")
    req(
        out.get("runtime_connectedness")
        == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
        "enablement grant connectedness",
    )
    receipt_digest = out.get("enablement_grant_receipt_digest")
    if receipt_digest is not None:
        req(isinstance(receipt_digest, str) and len(receipt_digest) == 64, "grant receipt digest")
        req(
            receipt_digest == sha({
                key: value
                for key, value in out.items()
                if key != "enablement_grant_receipt_digest"
            }),
            "grant receipt digest binding",
        )
