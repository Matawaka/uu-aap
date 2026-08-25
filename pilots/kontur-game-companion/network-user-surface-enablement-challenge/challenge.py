#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
UPSTREAM = ROOT / "network-user-surface-activation-materialization" / "materialize.py"

spec = importlib.util.spec_from_file_location("network_surface_activation_materialization_for_enablement_challenge", UPSTREAM)
materialize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(materialize)


class NetworkUserSurfaceEnablementChallengeError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceEnablementChallengeError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


CHALLENGE_SCOPE = "THIS_LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY"
REQUESTED_CAPABILITY = "REVIEW_NETWORK_USER_SURFACE_ENABLEMENT"
REQUESTED_DURATION = "ONE_SYNTHETIC_SESSION"
REVIEW_BOUNDARY = "SEPARATE_ENABLEMENT_EXTERNALIZATION_REVIEW_REQUIRED"
GRANT_BOUNDARY = "SEPARATE_BOUNDED_ENABLEMENT_GRANT_REQUIRED"
MATERIALIZATION_BOUNDARY = "SEPARATE_ENABLEMENT_MATERIALIZATION_REQUIRED"
SEND_BOUNDARY = "SEPARATE_SEND_PERMIT_REQUIRED_AFTER_ENABLEMENT"

STATE_REFERENCE_FIELDS = (
    "activation_state_ref",
    "network_activation_state_ref",
    "user_surface_activation_state_ref",
    "activation_state_digest",
)

BASE_PROVENANCE_FIELDS = (
    "source_activation_grant_receipt_digest",
    "binding_object_digest",
    "runtime_binding_ref",
    "transport_binding_ref",
    "endpoint_binding_ref",
    "network_contract_ref",
    "user_surface_contract_ref",
    "rollback_contract_ref",
    "delivery_audit_sink_ref",
)

PROVENANCE_FIELDS = BASE_PROVENANCE_FIELDS + STATE_REFERENCE_FIELDS

LIFECYCLE_FIELDS = (
    "activation_state_lifecycle_rechecked",
    "activation_state_still_local_confirmed",
    "activation_state_not_rolled_back_confirmed",
    "reviewed_binding_current_confirmed",
)

FORBIDDEN_REQUESTS = (
    "network_enablement_requested",
    "user_surface_enablement_requested",
    "network_connection_requested",
    "user_surface_exposure_requested",
    "live_runtime_enablement_requested",
    "external_transport_enablement_requested",
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
    "real_endpoint_resolution_requested",
    "real_user_surface_attachment_requested",
    "copyright_process_change_requested",
    "license_or_notice_change_requested",
    "legal_author_identity_change_requested",
    "pseudonym_publication_change_requested",
)

FALSE_EFFECTS = tuple(dict.fromkeys(materialize.EXTERNAL_FALSE_EFFECTS + (
    "enablement_review_completed",
    "enablement_grant_created",
    "enablement_authority_granted",
    "network_enablement_authority_granted",
    "user_surface_enablement_authority_granted",
    "enablement_materialized",
    "network_enablement_materialized",
    "user_surface_enablement_materialized",
    "send_permit_created",
    "copyright_process_modified",
    "license_or_notice_modified",
    "legal_author_identity_modified",
    "pseudonym_publication_process_modified",
)))


def validate_activation_state(item):
    req(isinstance(item, dict), "activation materialization receipt object")
    req(
        item.get("schema_version")
        == "kontur-game-companion-network-user-surface-activation-materialization-receipt-v0.1",
        "activation materialization schema",
    )
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "activation materialization status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ACTIVATION_NOT_MATERIALIZED",
        "LIFECYCLE_RECHECK_REQUIRED",
        "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED",
    }, "activation materialization decision")
    digest = item.get("activation_materialization_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "activation materialization digest")
    req(
        digest == materialize.sha({
            key: value
            for key, value in item.items()
            if key != "activation_materialization_receipt_digest"
        }),
        "activation materialization digest binding",
    )
    for field in BASE_PROVENANCE_FIELDS:
        value = item.get(field)
        req(isinstance(value, str) and len(value) == 64, f"activation provenance: {field}")
    for field in materialize.EXTERNAL_FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream external effect: {field}")
    req(item.get("activation_state_is_enablement") is False, "activation state must not equal enablement")
    req(item.get("authority_effect") == "NONE", "upstream authority effect")
    req(item.get("action_effect") == "NONE", "upstream action effect")
    req(item.get("successor_effect") == "NONE", "upstream successor effect")

    active = item["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    for field in STATE_REFERENCE_FIELDS:
        value = item.get(field)
        if active:
            req(isinstance(value, str) and len(value) == 64, f"activation state reference: {field}")
        else:
            req(value is None, f"inactive activation state reference: {field}")
    for field in (
        "activation_state_artifact_created",
        "network_activation_state_materialized",
        "user_surface_activation_state_materialized",
        "activation_state_local_only",
        "activation_state_reversible",
        "network_enablement_required_after_materialization",
        "user_surface_enablement_required_after_materialization",
        "send_permit_required_after_surface_enablement",
    ):
        req(item.get(field) is active, f"activation state marker: {field}")
    req(
        item.get("runtime_connectedness")
        == (
            "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL"
            if active
            else "LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL"
        ),
        "activation state connectedness",
    )


def default_challenge_context(item):
    validate_activation_state(item)
    context = {
        "schema_version": "kontur-game-companion-network-user-surface-enablement-challenge-context-v0.1",
        "source_activation_materialization_receipt_digest": item[
            "activation_materialization_receipt_digest"
        ],
        "challenge_requested": False,
        "challenge_scope": CHALLENGE_SCOPE,
        "requested_capability": REQUESTED_CAPABILITY,
        "requested_duration": REQUESTED_DURATION,
        "review_boundary": REVIEW_BOUNDARY,
        "grant_boundary": GRANT_BOUNDARY,
        "materialization_boundary": MATERIALIZATION_BOUNDARY,
        "send_boundary": SEND_BOUNDARY,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in PROVENANCE_FIELDS:
        context[field] = item[field]
    for field in LIFECYCLE_FIELDS:
        context[field] = False
    for field in FORBIDDEN_REQUESTS:
        context[field] = False
    return context


def validate_challenge_context(item, context):
    validate_activation_state(item)
    req(
        context.get("schema_version")
        == "kontur-game-companion-network-user-surface-enablement-challenge-context-v0.1",
        "enablement challenge context schema",
    )
    req(
        context.get("source_activation_materialization_receipt_digest")
        == item["activation_materialization_receipt_digest"],
        "enablement challenge source receipt",
    )
    req(type(context.get("challenge_requested")) is bool, "challenge requested bool")
    req(context.get("challenge_scope") == CHALLENGE_SCOPE, "enablement challenge scope")
    req(context.get("requested_capability") == REQUESTED_CAPABILITY, "requested capability")
    req(context.get("requested_duration") == REQUESTED_DURATION, "requested duration")
    req(context.get("review_boundary") == REVIEW_BOUNDARY, "review boundary")
    req(context.get("grant_boundary") == GRANT_BOUNDARY, "grant boundary")
    req(context.get("materialization_boundary") == MATERIALIZATION_BOUNDARY, "materialization boundary")
    req(context.get("send_boundary") == SEND_BOUNDARY, "send boundary")
    for field in PROVENANCE_FIELDS:
        req(context.get(field) == item.get(field), f"challenge provenance: {field}")
    for field in LIFECYCLE_FIELDS:
        req(type(context.get(field)) is bool, f"challenge lifecycle marker: {field}")
    for field in FORBIDDEN_REQUESTS:
        req(context.get(field) is False, f"forbidden challenge request: {field}")
    req(
        context.get("authority_effect")
        == context.get("action_effect")
        == context.get("successor_effect")
        == "NONE",
        "challenge context effects",
    )

    active = item["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    if not active:
        req(context["challenge_requested"] is False, "challenge requested without active local state")
    if not context["challenge_requested"]:
        for field in LIFECYCLE_FIELDS:
            req(context[field] is False, f"lifecycle proof before challenge request: {field}")
    if any(context[field] for field in LIFECYCLE_FIELDS[1:]):
        req(
            context["activation_state_lifecycle_rechecked"] is True,
            "lifecycle conclusion without recheck",
        )


def challenge_ref_for(item):
    return sha({
        "kind": "KONTUR_NETWORK_USER_SURFACE_ENABLEMENT_CHALLENGE_REF_V0.1",
        "source_activation_materialization_receipt_digest": item[
            "activation_materialization_receipt_digest"
        ],
        "activation_state_ref": item["activation_state_ref"],
        "network_activation_state_ref": item["network_activation_state_ref"],
        "user_surface_activation_state_ref": item["user_surface_activation_state_ref"],
        "activation_state_digest": item["activation_state_digest"],
        "challenge_scope": CHALLENGE_SCOPE,
        "requested_capability": REQUESTED_CAPABILITY,
        "requested_duration": REQUESTED_DURATION,
    })


def enablement_challenge(item, challenge_context=None):
    validate_activation_state(item)
    context = (
        default_challenge_context(item)
        if challenge_context is None
        else copy.deepcopy(challenge_context)
    )
    validate_challenge_context(item, context)

    active = item["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    lifecycle_current = all(context[field] for field in LIFECYCLE_FIELDS)

    if not active:
        decision, reason = "NOT_APPLICABLE", "LOCAL_SYNTHETIC_ACTIVATION_STATE_REQUIRED"
    elif not context["challenge_requested"]:
        decision, reason = (
            "ENABLEMENT_CHALLENGE_NOT_CREATED",
            "SEPARATE_ENABLEMENT_CHALLENGE_REQUEST_ABSENT",
        )
    elif not lifecycle_current:
        decision, reason = (
            "LIFECYCLE_RECHECK_REQUIRED",
            "CURRENT_LOCAL_ACTIVATION_STATE_AND_BINDING_NOT_CONFIRMED",
        )
    else:
        decision, reason = (
            "BOUNDED_ENABLEMENT_CHALLENGE_CREATED",
            "LOCAL_NON_AUTHORIZING_ENABLEMENT_REVIEW_CHALLENGE_CREATED",
        )

    created = decision == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
    out = {
        "schema_version": "kontur-game-companion-network-user-surface-enablement-challenge-receipt-v0.1",
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_activation_materialization_receipt_digest": item[
            "activation_materialization_receipt_digest"
        ],
        "challenge_context_digest": sha(context),
        "decision": decision,
        "reason": reason,
        "challenge_scope": CHALLENGE_SCOPE,
        "requested_capability": REQUESTED_CAPABILITY,
        "requested_duration": REQUESTED_DURATION,
        "review_boundary": REVIEW_BOUNDARY,
        "grant_boundary": GRANT_BOUNDARY,
        "materialization_boundary": MATERIALIZATION_BOUNDARY,
        "send_boundary": SEND_BOUNDARY,
        "enablement_challenge_ref": challenge_ref_for(item) if created else None,
        "enablement_challenge_created": created,
        "separate_externalization_review_required": created,
        "separate_enablement_grant_required": created,
        "separate_enablement_materialization_required": created,
        "separate_send_permit_required": created,
        "challenge_is_enablement_authority": False,
        "challenge_is_enablement": False,
        "challenge_is_send_permit": False,
        "challenge_is_bearer_credential": False,
        "challenge_effect": (
            "CREATE_LOCAL_SYNTHETIC_ENABLEMENT_CHALLENGE_ARTIFACT"
            if created
            else "NONE"
        ),
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
    }
    for field in PROVENANCE_FIELDS:
        out[field] = item[field]
    for field in LIFECYCLE_FIELDS:
        out[field] = context[field]
    for field in FALSE_EFFECTS:
        out[field] = False

    validate_enablement_challenge_receipt(item, context, out)
    out["enablement_challenge_receipt_digest"] = sha(out)
    return out


def validate_enablement_challenge_receipt(item, context, out):
    validate_activation_state(item)
    validate_challenge_context(item, context)
    req(
        out.get("schema_version")
        == "kontur-game-companion-network-user-surface-enablement-challenge-receipt-v0.1",
        "enablement challenge receipt schema",
    )
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement challenge status")
    req(
        out.get("source_activation_materialization_receipt_digest")
        == item["activation_materialization_receipt_digest"],
        "enablement challenge receipt provenance",
    )
    req(out.get("challenge_context_digest") == sha(context), "challenge context digest")
    req(out.get("challenge_scope") == CHALLENGE_SCOPE, "challenge receipt scope")
    req(out.get("requested_capability") == REQUESTED_CAPABILITY, "challenge receipt capability")
    req(out.get("requested_duration") == REQUESTED_DURATION, "challenge receipt duration")
    req(out.get("review_boundary") == REVIEW_BOUNDARY, "challenge receipt review boundary")
    req(out.get("grant_boundary") == GRANT_BOUNDARY, "challenge receipt grant boundary")
    req(
        out.get("materialization_boundary") == MATERIALIZATION_BOUNDARY,
        "challenge receipt materialization boundary",
    )
    req(out.get("send_boundary") == SEND_BOUNDARY, "challenge receipt send boundary")
    for field in PROVENANCE_FIELDS:
        req(out.get(field) == item.get(field), f"challenge receipt provenance: {field}")
    for field in LIFECYCLE_FIELDS:
        req(out.get(field) is context.get(field), f"challenge lifecycle binding: {field}")

    active = item["decision"] == "SYNTHETIC_ACTIVATION_STATE_MATERIALIZED"
    lifecycle_current = all(context[field] for field in LIFECYCLE_FIELDS)
    if not active:
        expected = "NOT_APPLICABLE"
    elif not context["challenge_requested"]:
        expected = "ENABLEMENT_CHALLENGE_NOT_CREATED"
    elif not lifecycle_current:
        expected = "LIFECYCLE_RECHECK_REQUIRED"
    else:
        expected = "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
    req(out.get("decision") == expected, "enablement challenge decision derivation")

    created = expected == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
    req(
        out.get("enablement_challenge_ref")
        == (challenge_ref_for(item) if created else None),
        "enablement challenge reference",
    )
    for field in (
        "enablement_challenge_created",
        "separate_externalization_review_required",
        "separate_enablement_grant_required",
        "separate_enablement_materialization_required",
        "separate_send_permit_required",
    ):
        req(out.get(field) is created, f"enablement challenge marker: {field}")
    for field in (
        "challenge_is_enablement_authority",
        "challenge_is_enablement",
        "challenge_is_send_permit",
        "challenge_is_bearer_credential",
    ):
        req(out.get(field) is False, f"challenge non-authority marker: {field}")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"enablement challenge external effect: {field}")
    req(
        out.get("challenge_effect")
        == (
            "CREATE_LOCAL_SYNTHETIC_ENABLEMENT_CHALLENGE_ARTIFACT"
            if created
            else "NONE"
        ),
        "enablement challenge effect",
    )
    req(
        out.get("authority_effect")
        == out.get("action_effect")
        == out.get("successor_effect")
        == "NONE",
        "enablement challenge causal effects",
    )
    req(
        out.get("runtime_connectedness")
        == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
        "enablement challenge connectedness",
    )

