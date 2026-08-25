#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CHALLENGE = ROOT / "network-user-surface-enablement-challenge" / "challenge.py"

spec = importlib.util.spec_from_file_location(
    "network_user_surface_enablement_externalization_review_challenge",
    CHALLENGE,
)
challenge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(challenge)


class NetworkUserSurfaceEnablementExternalizationReviewError(ValueError):
    pass


def req(condition, message):
    if not condition:
        raise NetworkUserSurfaceEnablementExternalizationReviewError(message)


def canon(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(value):
    return hashlib.sha256(canon(value).encode()).hexdigest()


REVIEW_SCOPE = "THIS_BOUNDED_ENABLEMENT_CHALLENGE_ONLY"
REVIEWER_CLAIM = "SYNTHETIC_ENABLEMENT_EXTERNALIZATION_REVIEWER"
HUMAN_DECISION_BOUNDARY = "HUMAN_BOUNDED_ENABLEMENT_GRANT_DECISION_REQUIRED"

RESULT_BINDINGS = (
    ("activation_provenance_reviewed", "activation_provenance_valid"),
    ("network_contract_reviewed", "network_contract_sufficient"),
    ("user_surface_contract_reviewed", "user_surface_contract_sufficient"),
    ("rollback_contract_reviewed", "rollback_contract_sufficient"),
    ("delivery_audit_sink_reviewed", "delivery_audit_sink_sufficient"),
    ("lifecycle_freshness_reviewed", "lifecycle_freshness_valid"),
    ("enablement_scope_reviewed", "enablement_scope_valid"),
    ("requested_capability_reviewed", "requested_capability_valid"),
)

REVIEW_DIMENSIONS = tuple(reviewed for reviewed, _ in RESULT_BINDINGS)

PROVENANCE_FIELDS = tuple(dict.fromkeys(
    challenge.PROVENANCE_FIELDS
    + (
        "source_activation_materialization_receipt_digest",
        "enablement_challenge_ref",
    )
))

FORBIDDEN_CONTEXT_EFFECTS = (
    "human_enablement_grant_decision_present",
    "enablement_grant_issuance_requested",
    "enablement_materialization_requested",
    "network_enablement_requested",
    "user_surface_enablement_requested",
    "network_connection_requested",
    "user_surface_exposure_requested",
    "send_permit_requested",
    "transport_invocation_requested",
    "credential_material_requested",
    "copyright_process_change_requested",
    "license_or_notice_change_requested",
    "legal_author_identity_change_requested",
    "pseudonym_publication_change_requested",
)

FALSE_EFFECTS = tuple(dict.fromkeys(
    tuple(
        field
        for field in challenge.FALSE_EFFECTS
        if field != "enablement_review_completed"
    )
    + (
        "enablement_grant_decision_present",
        "enablement_grant_issuance_requested",
        "enablement_grant_created",
        "enablement_authority_granted",
        "network_enablement_authority_granted",
        "user_surface_enablement_authority_granted",
        "enablement_materialized",
        "network_enablement_materialized",
        "user_surface_enablement_materialized",
        "copyright_process_modified",
        "license_or_notice_modified",
        "legal_author_identity_modified",
        "pseudonym_publication_process_modified",
    )
))


def expected_challenge_ref(item):
    return challenge.sha({
        "kind": "KONTUR_NETWORK_USER_SURFACE_ENABLEMENT_CHALLENGE_REF_V0.1",
        "source_activation_materialization_receipt_digest": item[
            "source_activation_materialization_receipt_digest"
        ],
        "activation_state_ref": item["activation_state_ref"],
        "network_activation_state_ref": item["network_activation_state_ref"],
        "user_surface_activation_state_ref": item["user_surface_activation_state_ref"],
        "activation_state_digest": item["activation_state_digest"],
        "challenge_scope": challenge.CHALLENGE_SCOPE,
        "requested_capability": challenge.REQUESTED_CAPABILITY,
        "requested_duration": challenge.REQUESTED_DURATION,
    })


def validate_enablement_challenge(item):
    req(isinstance(item, dict), "enablement challenge receipt object")
    req(
        item.get("schema_version")
        == "kontur-game-companion-network-user-surface-enablement-challenge-receipt-v0.1",
        "enablement challenge schema",
    )
    req(item.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement challenge status")
    req(item.get("decision") in {
        "NOT_APPLICABLE",
        "ENABLEMENT_CHALLENGE_NOT_CREATED",
        "LIFECYCLE_RECHECK_REQUIRED",
        "BOUNDED_ENABLEMENT_CHALLENGE_CREATED",
    }, "enablement challenge decision")
    digest = item.get("enablement_challenge_receipt_digest")
    req(isinstance(digest, str) and len(digest) == 64, "enablement challenge digest")
    req(
        digest == challenge.sha({
            key: value
            for key, value in item.items()
            if key != "enablement_challenge_receipt_digest"
        }),
        "enablement challenge digest binding",
    )
    req(item.get("challenge_scope") == challenge.CHALLENGE_SCOPE, "challenge scope")
    req(item.get("requested_capability") == challenge.REQUESTED_CAPABILITY, "challenge capability")
    req(item.get("requested_duration") == challenge.REQUESTED_DURATION, "challenge duration")
    req(item.get("review_boundary") == challenge.REVIEW_BOUNDARY, "challenge review boundary")
    req(item.get("grant_boundary") == challenge.GRANT_BOUNDARY, "challenge grant boundary")
    req(
        item.get("materialization_boundary") == challenge.MATERIALIZATION_BOUNDARY,
        "challenge materialization boundary",
    )
    req(item.get("send_boundary") == challenge.SEND_BOUNDARY, "challenge send boundary")
    req(
        item.get("runtime_connectedness")
        == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
        "challenge connectedness",
    )
    req(
        item.get("authority_effect")
        == item.get("action_effect")
        == item.get("successor_effect")
        == "NONE",
        "challenge causal effects",
    )
    for field in challenge.FALSE_EFFECTS:
        req(item.get(field) is False, f"upstream challenge effect: {field}")
    for field in (
        "challenge_is_enablement_authority",
        "challenge_is_enablement",
        "challenge_is_send_permit",
        "challenge_is_bearer_credential",
    ):
        req(item.get(field) is False, f"challenge non-authority marker: {field}")

    created = item["decision"] == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
    req(item.get("enablement_challenge_created") is created, "challenge creation marker")
    req(
        item.get("enablement_challenge_ref")
        == (expected_challenge_ref(item) if created else None),
        "challenge reference binding",
    )
    for field in (
        "separate_externalization_review_required",
        "separate_enablement_grant_required",
        "separate_enablement_materialization_required",
        "separate_send_permit_required",
    ):
        req(item.get(field) is created, f"challenge successor boundary: {field}")
    if created:
        for field in PROVENANCE_FIELDS:
            value = item.get(field)
            req(isinstance(value, str) and len(value) == 64, f"challenge provenance: {field}")
        for field in challenge.LIFECYCLE_FIELDS:
            req(item.get(field) is True, f"challenge lifecycle freshness: {field}")


def default_review_context(item):
    validate_enablement_challenge(item)
    context = {
        "schema_version": (
            "kontur-game-companion-network-user-surface-"
            "enablement-externalization-review-context-v0.1"
        ),
        "source_enablement_challenge_receipt_digest": item[
            "enablement_challenge_receipt_digest"
        ],
        "review_scope": REVIEW_SCOPE,
        "reviewer_claim": REVIEWER_CLAIM,
        "independent_review_asserted": True,
        "challenge_scope": item.get("challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "requested_duration": item.get("requested_duration"),
        "human_decision_boundary": HUMAN_DECISION_BOUNDARY,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
    }
    for field in PROVENANCE_FIELDS:
        context[field] = item.get(field)
    for reviewed, result in RESULT_BINDINGS:
        context[reviewed] = False
        context[result] = False
    for field in FORBIDDEN_CONTEXT_EFFECTS:
        context[field] = False
    return context


def validate_review_context(item, context):
    validate_enablement_challenge(item)
    req(
        context.get("schema_version")
        == (
            "kontur-game-companion-network-user-surface-"
            "enablement-externalization-review-context-v0.1"
        ),
        "enablement review context schema",
    )
    req(
        context.get("source_enablement_challenge_receipt_digest")
        == item.get("enablement_challenge_receipt_digest"),
        "enablement challenge receipt binding",
    )
    req(context.get("review_scope") == REVIEW_SCOPE, "enablement review scope")
    req(context.get("reviewer_claim") == REVIEWER_CLAIM, "enablement reviewer claim")
    req(context.get("independent_review_asserted") is True, "independent review assertion")
    req(context.get("challenge_scope") == item.get("challenge_scope"), "challenge scope provenance")
    req(
        context.get("requested_capability") == item.get("requested_capability"),
        "challenge capability provenance",
    )
    req(
        context.get("requested_duration") == item.get("requested_duration"),
        "challenge duration provenance",
    )
    req(
        context.get("human_decision_boundary") == HUMAN_DECISION_BOUNDARY,
        "human decision boundary",
    )
    for field in PROVENANCE_FIELDS:
        req(context.get(field) == item.get(field), f"review provenance: {field}")
    for reviewed, result in RESULT_BINDINGS:
        req(type(context.get(reviewed)) is bool, f"review marker: {reviewed}")
        req(type(context.get(result)) is bool, f"review result: {result}")
        if context[result]:
            req(context[reviewed] is True, f"result without review: {result}")
    for field in FORBIDDEN_CONTEXT_EFFECTS:
        req(context.get(field) is False, f"forbidden review context effect: {field}")
    req(
        context.get("authority_effect")
        == context.get("action_effect")
        == context.get("successor_effect")
        == "NONE",
        "review context causal effects",
    )
    if item["decision"] != "BOUNDED_ENABLEMENT_CHALLENGE_CREATED":
        for reviewed, result in RESULT_BINDINGS:
            req(context[reviewed] is False, "review before enablement challenge creation")
            req(context[result] is False, "review result before enablement challenge creation")


def review(item, review_context=None):
    validate_enablement_challenge(item)
    context = (
        default_review_context(item)
        if review_context is None
        else copy.deepcopy(review_context)
    )
    validate_review_context(item, context)

    applicable = item["decision"] == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
    all_reviewed = applicable and all(context[field] for field in REVIEW_DIMENSIONS)

    if not applicable:
        decision, reason = (
            "NOT_APPLICABLE",
            "BOUNDED_ENABLEMENT_CHALLENGE_REQUIRED",
        )
    elif not all_reviewed:
        decision, reason = (
            "ENABLEMENT_REVIEW_INCOMPLETE",
            "ONE_OR_MORE_ENABLEMENT_REVIEW_DIMENSIONS_INCOMPLETE",
        )
    elif not context["activation_provenance_valid"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_PROVENANCE",
            "ACTIVATION_STATE_OR_CHALLENGE_PROVENANCE_INVALID",
        )
    elif not context["network_contract_sufficient"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_NETWORK_CONTRACT",
            "NETWORK_CONTRACT_INSUFFICIENT_FOR_ENABLEMENT",
        )
    elif not context["user_surface_contract_sufficient"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_USER_SURFACE_CONTRACT",
            "USER_SURFACE_CONTRACT_INSUFFICIENT_FOR_ENABLEMENT",
        )
    elif not context["rollback_contract_sufficient"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_ROLLBACK",
            "ROLLBACK_CONTRACT_INSUFFICIENT_FOR_ENABLEMENT",
        )
    elif not context["delivery_audit_sink_sufficient"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_AUDIT_SINK",
            "DELIVERY_AUDIT_SINK_INSUFFICIENT_FOR_ENABLEMENT",
        )
    elif not context["lifecycle_freshness_valid"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_FRESHNESS",
            "ACTIVATION_STATE_OR_BINDING_FRESHNESS_INVALID",
        )
    elif not context["enablement_scope_valid"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_SCOPE",
            "ENABLEMENT_SCOPE_OUTSIDE_BOUNDED_REVIEW",
        )
    elif not context["requested_capability_valid"]:
        decision, reason = (
            "ENABLEMENT_REVIEW_REJECTED_CAPABILITY",
            "REQUESTED_CAPABILITY_OUTSIDE_BOUNDED_REVIEW",
        )
    else:
        decision, reason = (
            "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED",
            "ENABLEMENT_SUFFICIENCY_CONFIRMED_HUMAN_GRANT_DECISION_REQUIRED",
        )

    complete = decision == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
    out = {
        "schema_version": (
            "kontur-game-companion-network-user-surface-"
            "enablement-externalization-review-receipt-v0.1"
        ),
        "status": "SYNTHETIC_NON_EXECUTING",
        "scope_id": item.get("scope_id"),
        "source_turn": item.get("source_turn"),
        "source_enablement_challenge_receipt_digest": item[
            "enablement_challenge_receipt_digest"
        ],
        "review_context_digest": sha(context),
        "decision": decision,
        "reason": reason,
        "enablement_externalization_review_scope": REVIEW_SCOPE,
        "reviewer_claim": context["reviewer_claim"],
        "independent_review_asserted": True,
        "reviewer_identity_proven": False,
        "independent_review_proven": False,
        "challenge_scope": item.get("challenge_scope"),
        "requested_capability": item.get("requested_capability"),
        "requested_duration": item.get("requested_duration"),
        "enablement_review_completed": all_reviewed,
        "enablement_externalization_sufficiency_confirmed": complete,
        "separate_enablement_grant_required": complete,
        "human_enablement_grant_decision_required": complete,
        "human_enablement_grant_decision_present": False,
        "human_decision_boundary": HUMAN_DECISION_BOUNDARY,
        "review_is_enablement_grant": False,
        "review_is_enablement": False,
        "review_is_send_permit": False,
        "review_is_bearer_credential": False,
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "runtime_connectedness": "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
    }
    for field in PROVENANCE_FIELDS:
        out[field] = item.get(field)
    for reviewed, result in RESULT_BINDINGS:
        out[reviewed] = context[reviewed]
        out[result] = context[result]
    for field in FALSE_EFFECTS:
        out[field] = False

    validate_review_receipt(item, context, out)
    out["enablement_externalization_review_receipt_digest"] = sha(out)
    return out


def validate_review_receipt(item, context, out):
    validate_review_context(item, context)
    req(
        out.get("schema_version")
        == (
            "kontur-game-companion-network-user-surface-"
            "enablement-externalization-review-receipt-v0.1"
        ),
        "enablement review receipt schema",
    )
    req(out.get("status") == "SYNTHETIC_NON_EXECUTING", "enablement review status")
    req(
        out.get("scope_id") == item.get("scope_id")
        and out.get("source_turn") == item.get("source_turn"),
        "enablement review source",
    )
    req(
        out.get("source_enablement_challenge_receipt_digest")
        == item.get("enablement_challenge_receipt_digest"),
        "enablement challenge receipt provenance",
    )
    req(out.get("review_context_digest") == sha(context), "enablement review context digest")
    req(out.get("enablement_externalization_review_scope") == REVIEW_SCOPE, "receipt scope")
    req(out.get("reviewer_claim") == REVIEWER_CLAIM, "receipt reviewer claim")
    req(out.get("independent_review_asserted") is True, "receipt independent review assertion")
    req(
        out.get("reviewer_identity_proven") is False
        and out.get("independent_review_proven") is False,
        "reviewer proof overclaim",
    )
    req(out.get("challenge_scope") == item.get("challenge_scope"), "receipt challenge scope")
    req(
        out.get("requested_capability") == item.get("requested_capability"),
        "receipt requested capability",
    )
    req(
        out.get("requested_duration") == item.get("requested_duration"),
        "receipt requested duration",
    )
    req(
        out.get("human_decision_boundary") == HUMAN_DECISION_BOUNDARY,
        "receipt human decision boundary",
    )
    for field in PROVENANCE_FIELDS:
        req(out.get(field) == item.get(field), f"receipt provenance: {field}")
    for reviewed, result in RESULT_BINDINGS:
        req(out.get(reviewed) is context.get(reviewed), f"receipt review marker: {reviewed}")
        req(out.get(result) is context.get(result), f"receipt review result: {result}")

    applicable = item["decision"] == "BOUNDED_ENABLEMENT_CHALLENGE_CREATED"
    all_reviewed = applicable and all(context[field] for field in REVIEW_DIMENSIONS)
    if not applicable:
        expected = "NOT_APPLICABLE"
    elif not all_reviewed:
        expected = "ENABLEMENT_REVIEW_INCOMPLETE"
    elif not context["activation_provenance_valid"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_PROVENANCE"
    elif not context["network_contract_sufficient"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_NETWORK_CONTRACT"
    elif not context["user_surface_contract_sufficient"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_USER_SURFACE_CONTRACT"
    elif not context["rollback_contract_sufficient"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_ROLLBACK"
    elif not context["delivery_audit_sink_sufficient"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_AUDIT_SINK"
    elif not context["lifecycle_freshness_valid"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_FRESHNESS"
    elif not context["enablement_scope_valid"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_SCOPE"
    elif not context["requested_capability_valid"]:
        expected = "ENABLEMENT_REVIEW_REJECTED_CAPABILITY"
    else:
        expected = "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
    req(out.get("decision") == expected, "enablement review decision derivation")

    complete = expected == "ENABLEMENT_EXTERNALIZATION_REVIEW_COMPLETE_GRANT_REQUIRED"
    req(out.get("enablement_review_completed") is all_reviewed, "review completion marker")
    req(
        out.get("enablement_externalization_sufficiency_confirmed") is complete,
        "enablement sufficiency marker",
    )
    req(out.get("separate_enablement_grant_required") is complete, "separate grant marker")
    req(
        out.get("human_enablement_grant_decision_required") is complete,
        "human decision requirement marker",
    )
    req(out.get("human_enablement_grant_decision_present") is False, "human decision overclaim")
    for field in (
        "review_is_enablement_grant",
        "review_is_enablement",
        "review_is_send_permit",
        "review_is_bearer_credential",
    ):
        req(out.get(field) is False, f"review non-authority marker: {field}")
    for field in FALSE_EFFECTS:
        req(out.get(field) is False, f"enablement review external effect: {field}")
    req(
        out.get("authority_effect")
        == out.get("action_effect")
        == out.get("successor_effect")
        == "NONE",
        "enablement review causal effects",
    )
    req(
        out.get("runtime_connectedness")
        == "LOCAL_SYNTHETIC_ACTIVATION_STATE_ONLY_NOT_EXTERNAL",
        "enablement review connectedness",
    )
    receipt_digest = out.get("enablement_externalization_review_receipt_digest")
    if receipt_digest is not None:
        req(isinstance(receipt_digest, str) and len(receipt_digest) == 64, "receipt digest")
        req(
            receipt_digest == sha({
                key: value
                for key, value in out.items()
                if key != "enablement_externalization_review_receipt_digest"
            }),
            "receipt digest binding",
        )
