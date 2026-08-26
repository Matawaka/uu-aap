#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GRANT = ROOT / "network-user-surface-enablement-grant" / "grant.py"

spec = importlib.util.spec_from_file_location(
    "network_user_surface_enablement_materialization_grant",
    GRANT,
)
grant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grant)


class NetworkUserSurfaceEnablementMaterializationError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceEnablementMaterializationError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


MATERIALIZATION_SCOPE = "THIS_BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ONLY"
MATERIALIZATION_MODE = "LOCAL_SYNTHETIC_ENABLEMENT_STATE"
ENABLEMENT_STATE_CLASS = "SYNTHETIC_NETWORK_USER_SURFACE_ENABLEMENT_STATE_V0.1"
NETWORK_STATE_CLASS = "DECLARED_LOCAL_NETWORK_ENABLEMENT_STATE_ONLY"
USER_SURFACE_STATE_CLASS = "DECLARED_LOCAL_USER_SURFACE_ENABLEMENT_STATE_ONLY"

PROVENANCE_FIELDS = tuple(dict.fromkeys(
    grant.PROVENANCE_FIELDS
    + (
        "source_enablement_externalization_review_receipt_digest",
        "human_decision_evidence_ref",
        "revocation_handle",
    )
))

BOUNDARY_FIELDS = (
    "granted_scope",
    "granted_capability",
    "granted_duration",
    "expiry_boundary",
    "revocation_mode",
    "challenge_scope",
    "requested_capability",
    "requested_duration",
)

LIFECYCLE_FIELDS = (
    "grant_lifecycle_rechecked",
    "grant_still_active_confirmed",
    "grant_not_revoked_confirmed",
    "grant_not_expired_confirmed",
    "reviewed_evidence_current_confirmed",
    "human_decision_evidence_current_confirmed",
)

FORBIDDEN_REQUESTS = (
    "external_network_enablement_requested",
    "external_user_surface_enablement_requested",
    "network_connection_requested",
    "user_surface_exposure_requested",
    "live_runtime_enablement_requested",
    "external_transport_binding_requested",
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
    "real_endpoint_attachment_requested",
    "real_user_surface_attachment_requested",
    "copyright_process_change_requested",
    "license_or_notice_change_requested",
    "legal_author_identity_change_requested",
    "pseudonym_publication_change_requested",
)

EXTERNAL_FALSE_EFFECTS = tuple(dict.fromkeys(
    grant.FALSE_EFFECTS
    + (
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


def validate_enablement_grant(item):
    req(isinstance(item, dict), "enablement grant receipt object")
    req(
        item.get("schema_version")
        == "kontur-game-companion-network-user-surface-enablement-grant-receipt-v0.1",
        "enablement grant schema",
    )
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement grant status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ENABLEMENT_GRANT_DECISION_REQUIRED",
        "ENABLEMENT_GRANT_DENIED",
        "ENABLEMENT_GRANT_MORE_EVIDENCE_REQUIRED",
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED",
        "ENABLEMENT_GRANT_REVOKED",
        "ENABLEMENT_GRANT_EXPIRED",
    }, "enablement grant decision")
    digest = item.get("enablement_grant_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "enablement grant digest")
    req(
        digest == grant.sha({
            key: value
            for key, value in item.items()
            if key != "enablement_grant_receipt_digest"
        }),
        "enablement grant digest binding",
    )
    req(item.get("enablement_grant_receipt_scope") == grant.GRANT_RECEIPT_SCOPE, "grant scope")
    req(item.get("granted_scope") == grant.GRANTED_SCOPE, "granted scope")
    req(item.get("granted_capability") == grant.GRANTED_CAPABILITY, "granted capability")
    req(item.get("granted_duration") == grant.GRANTED_DURATION, "granted duration")
    req(item.get("expiry_boundary") == grant.EXPIRY_BOUNDARY, "grant expiry")
    req(item.get("revocation_mode") == grant.REVOCATION_MODE, "grant revocation mode")
    req(
        item.get("runtime_connectedness")
        == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
        "grant connectedness",
    )
    req(item.get("action_effect") == item.get("successor_effect") == "NONE", "grant causal effects")
    for field in grant.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream grant external effect: {field}")
    for field in (
        "grant_is_action_permit",
        "grant_is_successor_permit",
        "grant_is_send_permit",
        "grant_is_bearer_credential",
    ):
        req(item.get(field) is False, f"grant non-effect marker: {field}")

    historical = item["decision"] in {
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED",
        "ENABLEMENT_GRANT_REVOKED",
        "ENABLEMENT_GRANT_EXPIRED",
    }
    active = item["decision"] == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    req(item.get("enablement_grant_historically_issued") is historical, "historical grant marker")
    req(item.get("enablement_grant_currently_active") is active, "active grant marker")
    req(item.get("enablement_grant_created") is historical, "grant creation marker")
    req(item.get("enablement_authority_granted") is active, "enablement authority marker")
    req(item.get("network_enablement_authority_granted") is active, "network authority marker")
    req(item.get("user_surface_enablement_authority_granted") is active, "surface authority marker")
    req(item.get("enablement_materialization_required") is active, "materialization requirement")
    req(item.get("synthetic_enablement_authority_only") is historical, "synthetic authority scope")
    if historical:
        req(item.get("human_decision_asserted") is True, "human decision assertion")
        req(item.get("human_decision") == grant.GRANT_DECISION, "human grant decision")
        evidence_ref = item.get("human_decision_evidence_ref")
        req(isinstance(evidence_ref, str) and len(evidence_ref) == 64, "decision evidence ref")
        req(item.get("human_decision_authenticated") is False, "decision authentication overclaim")
        req(item.get("grantor_identity_proven") is False, "grantor identity overclaim")
        req(item.get("grantor_real_world_authority_proven") is False, "grantor authority overclaim")
        for field in PROVENANCE_FIELDS:
            value = item.get(field)
            req(isinstance(value, str) and len(value) == 64, f"grant provenance: {field}")
    expected_authority = {
        "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED": (
            "CREATE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
        "ENABLEMENT_GRANT_REVOKED": (
            "REVOKE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
        "ENABLEMENT_GRANT_EXPIRED": (
            "EXPIRE_BOUNDED_SYNTHETIC_ENABLEMENT_MATERIALIZATION_AUTHORITY"
        ),
    }.get(item["decision"], "NONE")
    req(item.get("authority_effect") == expected_authority, "grant authority effect")


def default_materialization_context(item):
    validate_enablement_grant(item)
    context = {
        "schema_version": (
            "kontur-game-companion-network-user-surface-"
            "enablement-materialization-context-v0.1"
        ),
        "source_enablement_grant_receipt_digest": item["enablement_grant_receipt_digest"],
        "materialization_requested": False,
        "materialization_scope": MATERIALIZATION_SCOPE,
        "materialization_mode": MATERIALIZATION_MODE,
        "enablement_state_class": ENABLEMENT_STATE_CLASS,
        "network_state_class": NETWORK_STATE_CLASS,
        "user_surface_state_class": USER_SURFACE_STATE_CLASS,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in PROVENANCE_FIELDS + BOUNDARY_FIELDS:
        context[field] = item.get(field)
    for field in LIFECYCLE_FIELDS:
        context[field] = False
    for field in FORBIDDEN_REQUESTS:
        context[field] = False
    return context


def validate_materialization_context(item, context):
    validate_enablement_grant(item)
    req(
        context.get("schema_version")
        == (
            "kontur-game-companion-network-user-surface-"
            "enablement-materialization-context-v0.1"
        ),
        "enablement materialization context schema",
    )
    req(
        context.get("source_enablement_grant_receipt_digest")
        == item.get("enablement_grant_receipt_digest"),
        "enablement grant receipt provenance",
    )
    req(type(context.get("materialization_requested")) is bool, "materialization request bool")
    req(context.get("materialization_scope") == MATERIALIZATION_SCOPE, "materialization scope")
    req(context.get("materialization_mode") == MATERIALIZATION_MODE, "materialization mode")
    req(context.get("enablement_state_class") == ENABLEMENT_STATE_CLASS, "enablement state class")
    req(context.get("network_state_class") == NETWORK_STATE_CLASS, "network state class")
    req(context.get("user_surface_state_class") == USER_SURFACE_STATE_CLASS, "surface state class")
    for field in PROVENANCE_FIELDS + BOUNDARY_FIELDS:
        req(context.get(field) == item.get(field), f"materialization provenance: {field}")
    for field in LIFECYCLE_FIELDS:
        req(type(context.get(field)) is bool, f"lifecycle marker: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(context.get(field) is False, f"forbidden materialization request: {field}")
    req(
        context.get("authority_effect")
        == context.get("action_effect")
        == context.get("successor_effect")
        == "NONE",
        "materialization context effects",
    )

    active = item["decision"] == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    if not active:
        req(context["materialization_requested"] is False, "materialization on inactive grant")
    if not context["materialization_requested"]:
        for field in LIFECYCLE_FIELDS:
            req(context[field] is False, f"lifecycle proof before materialization request: {field}")
    if any(context[field] for field in LIFECYCLE_FIELDS[1:]):
        req(context["grant_lifecycle_rechecked"] is True, "lifecycle conclusion without recheck")


def enablement_state_ref_for(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_ENABLEMENT_STATE_REF_V0.1",
        "source_enablement_grant_receipt_digest": item["enablement_grant_receipt_digest"],
        "activation_state_ref": item["activation_state_ref"],
        "network_contract_ref": item["network_contract_ref"],
        "user_surface_contract_ref": item["user_surface_contract_ref"],
        "scope": MATERIALIZATION_SCOPE,
    })


def network_state_ref_for(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_NETWORK_ENABLEMENT_STATE_REF_V0.1",
        "source_enablement_grant_receipt_digest": item["enablement_grant_receipt_digest"],
        "network_activation_state_ref": item["network_activation_state_ref"],
        "network_contract_ref": item["network_contract_ref"],
        "network_state_class": NETWORK_STATE_CLASS,
    })


def user_surface_state_ref_for(item):
    return sha({
        "kind": "KONTUR_LOCAL_SYNTHETIC_USER_SURFACE_ENABLEMENT_STATE_REF_V0.1",
        "source_enablement_grant_receipt_digest": item["enablement_grant_receipt_digest"],
        "user_surface_activation_state_ref": item["user_surface_activation_state_ref"],
        "user_surface_contract_ref": item["user_surface_contract_ref"],
        "user_surface_state_class": USER_SURFACE_STATE_CLASS,
    })


def enablement_state_digest_for(item):
    return sha({
        "kind": ENABLEMENT_STATE_CLASS,
        "source_enablement_grant_receipt_digest": item["enablement_grant_receipt_digest"],
        "enablement_state_ref": enablement_state_ref_for(item),
        "network_enablement_state_ref": network_state_ref_for(item),
        "user_surface_enablement_state_ref": user_surface_state_ref_for(item),
        "activation_state_digest": item["activation_state_digest"],
        "rollback_contract_ref": item["rollback_contract_ref"],
        "delivery_audit_sink_ref": item["delivery_audit_sink_ref"],
        "scope": MATERIALIZATION_SCOPE,
        "mode": MATERIALIZATION_MODE,
    })


def materialize(item, materialization_context=None):
    validate_enablement_grant(item)
    context = (
        default_materialization_context(item)
        if materialization_context is None
        else copy.deepcopy(materialization_context)
    )
    validate_materialization_context(item, context)

    active = item["decision"] == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    lifecycle_current = all(context[field] for field in LIFECYCLE_FIELDS)
    if not active:
        decision, reason = "NOT_APPLICABLE", "ACTIVE_BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_REQUIRED"
    elif not context["materialization_requested"]:
        decision, reason = "ENABLEMENT_NOT_MATERIALIZED", "SEPARATE_MATERIALIZATION_REQUEST_ABSENT"
    elif not lifecycle_current:
        decision, reason = "LIFECYCLE_RECHECK_REQUIRED", "CURRENT_GRANT_AND_REVIEWED_EVIDENCE_NOT_CONFIRMED"
    else:
        decision, reason = (
            "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED",
            "LOCAL_NON_EXTERNAL_ENABLEMENT_STATE_ARTIFACT_CREATED",
        )

    materialized = decision == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
    out = {
        "schema_version": (
            "kontur-game-companion-network-user-surface-"
            "enablement-materialization-receipt-v0.1"
        ),
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_enablement_grant_receipt_digest": item["enablement_grant_receipt_digest"],
        "materialization_context_digest": sha(context),
        "decision": decision,
        "reason": reason,
        "enablement_materialization_scope": MATERIALIZATION_SCOPE,
        "materialization_mode": MATERIALIZATION_MODE,
        "enablement_state_class": ENABLEMENT_STATE_CLASS,
        "network_state_class": NETWORK_STATE_CLASS,
        "user_surface_state_class": USER_SURFACE_STATE_CLASS,
        "enablement_authority_granted": active,
        "enablement_authority_used_for_materialization": materialized,
        "enablement_grant_consumed": False,
        "enablement_state_ref": enablement_state_ref_for(item) if materialized else None,
        "network_enablement_state_ref": network_state_ref_for(item) if materialized else None,
        "user_surface_enablement_state_ref": user_surface_state_ref_for(item) if materialized else None,
        "enablement_state_digest": enablement_state_digest_for(item) if materialized else None,
        "enablement_state_artifact_created": materialized,
        "network_enablement_state_materialized": materialized,
        "user_surface_enablement_state_materialized": materialized,
        "enablement_state_local_only": materialized,
        "enablement_state_reversible": materialized,
        "enablement_state_is_external_enablement": False,
        "local_trial_pilot_available": materialized,
        "external_enablement_boundary_required": materialized,
        "send_permit_required_after_external_enablement": materialized,
        "materialization_effect": (
            "CREATE_LOCAL_SYNTHETIC_ENABLEMENT_STATE_ARTIFACT"
            if materialized
            else "NONE"
        ),
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": (
            "LOCAL_SYNTHETIC_ENABLEMENT_STATE_ONLY_NOT_EXTERNAL"
            if materialized
            else "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        ),
    }
    for field in PROVENANCE_FIELDS + BOUNDARY_FIELDS:
        out[field] = item.get(field)
    for field in LIFECYCLE_FIELDS:
        out[field] = context[field]
    for field in EXTERNAL_FALSE_EFFECTS:
        out[field] = False

    validate_materialization_receipt(item, context, out)
    out["enablement_materialization_receipt_digest"] = sha(out)
    return out


def validate_materialization_receipt(item, context, out):
    validate_materialization_context(item, context)
    req(
        out.get("schema_version")
        == (
            "kontur-game-companion-network-user-surface-"
            "enablement-materialization-receipt-v0.1"
        ),
        "enablement materialization receipt schema",
    )
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "materialization receipt status")
    req(
        out.get("scope_id") == item.get("scope_id")
        and out.get("source_turn") == item.get("source_turn"),
        "materialization receipt source",
    )
    req(
        out.get("source_enablement_grant_receipt_digest")
        == item.get("enablement_grant_receipt_digest"),
        "enablement grant receipt binding",
    )
    req(out.get("materialization_context_digest") == sha(context), "materialization context digest")
    req(out.get("enablement_materialization_scope") == MATERIALIZATION_SCOPE, "receipt scope")
    req(out.get("materialization_mode") == MATERIALIZATION_MODE, "receipt mode")
    req(out.get("enablement_state_class") == ENABLEMENT_STATE_CLASS, "receipt state class")
    req(out.get("network_state_class") == NETWORK_STATE_CLASS, "receipt network class")
    req(out.get("user_surface_state_class") == USER_SURFACE_STATE_CLASS, "receipt surface class")
    for field in PROVENANCE_FIELDS + BOUNDARY_FIELDS:
        req(out.get(field) == item.get(field), f"materialization receipt provenance: {field}")
    for field in LIFECYCLE_FIELDS:
        req(out.get(field) is context.get(field), f"materialization lifecycle binding: {field}")

    active = item["decision"] == "BOUNDED_SYNTHETIC_ENABLEMENT_GRANT_ISSUED"
    lifecycle_current = all(context[field] for field in LIFECYCLE_FIELDS)
    if not active:
        expected = "NOT_APPLICABLE"
    elif not context["materialization_requested"]:
        expected = "ENABLEMENT_NOT_MATERIALIZED"
    elif not lifecycle_current:
        expected = "LIFECYCLE_RECHECK_REQUIRED"
    else:
        expected = "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
    req(out.get("decision") == expected, "materialization decision derivation")
    materialized = expected == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"

    req(out.get("enablement_authority_granted") is active, "enablement authority marker")
    req(
        out.get("enablement_authority_used_for_materialization") is materialized,
        "enablement authority usage marker",
    )
    req(out.get("enablement_grant_consumed") is False, "grant consumption overclaim")
    expected_refs = {
        "enablement_state_ref": enablement_state_ref_for(item) if materialized else None,
        "network_enablement_state_ref": network_state_ref_for(item) if materialized else None,
        "user_surface_enablement_state_ref": user_surface_state_ref_for(item) if materialized else None,
        "enablement_state_digest": enablement_state_digest_for(item) if materialized else None,
    }
    for field, expected_ref in expected_refs.items():
        req(out.get(field) == expected_ref, f"enablement state reference: {field}")
    for field in (
        "enablement_state_artifact_created",
        "network_enablement_state_materialized",
        "user_surface_enablement_state_materialized",
        "enablement_state_local_only",
        "enablement_state_reversible",
        "local_trial_pilot_available",
        "external_enablement_boundary_required",
        "send_permit_required_after_external_enablement",
    ):
        req(out.get(field) is materialized, f"materialization marker: {field}")
    req(out.get("enablement_state_is_external_enablement") is False, "external enablement overclaim")
    for field in EXTERNAL_FALSE_EFFECTS:
        req(out.get(field) is False, f"materialization external effect: {field}")
    req(
        out.get("materialization_effect")
        == (
            "CREATE_LOCAL_SYNTHETIC_ENABLEMENT_STATE_ARTIFACT"
            if materialized
            else "NONE"
        ),
        "materialization effect",
    )
    req(
        out.get("authority_effect")
        == out.get("action_effect")
        == out.get("successor_effect")
        == "NONE",
        "materialization causal effects",
    )
    req(
        out.get("runtime_connectedness")
        == (
            "LOCAL_SYNTHETIC_ENABLEMENT_STATE_ONLY_NOT_EXTERNAL"
            if materialized
            else "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
        ),
        "materialization connectedness",
    )
    receipt_digest = out.get("enablement_materialization_receipt_digest")
    if receipt_digest is not None:
        req(isinstance(receipt_digest, str) and len(receipt_digest) == 64, "materialization digest")
        req(
            receipt_digest == sha({
                key: value
                for key, value in out.items()
                if key != "enablement_materialization_receipt_digest"
            }),
            "materialization digest binding",
        )
