import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker, ValidationError

ROOT = Path(__file__).resolve().parent
SCHEMA = json.loads((ROOT / "kontur-human-activation-review-decision.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())


def digest(ch):
    return {
        "canonicalization": "RFC8785-JCS",
        "digest_algorithm": "SHA-256",
        "digest_encoding": "hex",
        "value": ch * 64,
    }


def confirmations(value):
    return {
        "exact_revision_and_review_packet_understood": value,
        "existing_permissions_only": value,
        "no_permission_bypass_or_escalation": value,
        "activation_intent_is_separate_future_artifact": value,
        "preflight_is_separate_and_must_be_fresh": value,
        "execute_command_requires_separate_human_step": value,
        "holder_scopes_and_lease_must_be_explicit_before_intent": value,
        "activation_does_not_establish_legal_truth_or_universal_authority": value,
    }


def base_decision(outcome):
    mapping = {
        "approve_intent_preparation": (
            "approve_intent_preparation_only",
            "APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY",
            "activation_intent_preparation_may_be_requested",
            True,
            confirmations(True),
        ),
        "defer": (
            "defer_activation_review",
            "DEFER_KONTUR_ACTIVATION_REVIEW",
            "no-action",
            False,
            confirmations(False),
        ),
        "reject": (
            "reject_activation_review",
            "REJECT_KONTUR_ACTIVATION_REVIEW",
            "no-action",
            False,
            confirmations(False),
        ),
    }
    declaration_type, token, safe_effect, positive, confirmation_set = mapping[outcome]
    return {
        "$schema": "./kontur-human-activation-review-decision.schema.json",
        "artifact_type": "KONTURHumanActivationReviewDecision",
        "artifact_version": "0.1",
        "decision_id": "urn:uu-aap:kontur:human-activation-review-decision:test",
        "reviewed_at": "2026-08-24T00:46:00Z",
        "review_packet_binding": {
            "artifact_type": "KONTURHumanActivationReviewPacket",
            "artifact_ref": "urn:uu-aap:kontur:human-activation-review-packet:test",
            "digest": digest("a"),
        },
        "reviewer_ref": "human:reviewer:test",
        "decision": outcome,
        "confirmations": confirmation_set,
        "human_declaration": {
            "declaration_type": declaration_type,
            "typed_confirmation": token,
            "nonce": "urn:uu-aap:kontur:human-activation-review-nonce:test",
            "explicit": True,
        },
        "review_context": {
            "observed_current_git_revision": "git:" + "b" * 40,
            "observed_at": "2026-08-24T00:47:00Z",
            "packet_expires_at": "2026-08-25T00:45:00Z",
            "prior_decisions_complete": True,
            "prior_decision_count": 0,
            "replay_guard": {
                "nonce_not_seen": True,
                "packet_not_previously_decided": True,
            },
        },
        "safe_effect": safe_effect,
        "claims": {
            "human_review_decision_recorded": True,
            "activation_intent_preparation_may_be_requested": positive,
            "activation_intent_created": False,
            "preflight_requested": False,
            "execute_command_created": False,
            "kernel_activated": False,
            "responsibility_state_created": False,
            "responsibility_accepted": False,
            "execution_authority_granted": False,
            "permission_expansion_authorized": False,
            "permission_bypass_authorized": False,
            "repository_ownership_transferred": False,
            "canonical_origin_mutated": False,
            "legal_authority_established": False,
            "truth_certified": False,
            "distributed_consensus_established": False,
        },
    }


def must_pass(label, value):
    VALIDATOR.validate(value)
    print("PASS:", label)


def must_fail(label, value):
    try:
        VALIDATOR.validate(value)
    except ValidationError:
        print("EXPECTED REJECTION:", label)
        return
    raise AssertionError(f"{label}: schema accepted invalid coupled decision")


for outcome in ("approve_intent_preparation", "defer", "reject"):
    must_pass(f"valid {outcome}", base_decision(outcome))

value = base_decision("approve_intent_preparation")
value["safe_effect"] = "no-action"
must_fail("approval safe_effect mismatch", value)

value = base_decision("approve_intent_preparation")
value["claims"]["activation_intent_preparation_may_be_requested"] = False
must_fail("approval positive claim mismatch", value)

value = base_decision("approve_intent_preparation")
value["human_declaration"]["declaration_type"] = "defer_activation_review"
must_fail("approval declaration mismatch", value)

value = base_decision("approve_intent_preparation")
value["human_declaration"]["typed_confirmation"] = "APPROVE"
must_fail("approval typed token mismatch", value)

value = base_decision("approve_intent_preparation")
value["confirmations"]["existing_permissions_only"] = False
must_fail("approval permission confirmation mismatch", value)

value = base_decision("defer")
value["safe_effect"] = "activation_intent_preparation_may_be_requested"
must_fail("defer positive safe_effect", value)

value = base_decision("defer")
value["claims"]["activation_intent_preparation_may_be_requested"] = True
must_fail("defer positive claim", value)

value = base_decision("reject")
value["human_declaration"]["typed_confirmation"] = "DEFER_KONTUR_ACTIVATION_REVIEW"
must_fail("reject typed token mismatch", value)

value = base_decision("reject")
value["review_packet_binding"]["artifact_type"] = "OtherArtifact"
must_fail("review packet binding type substitution", value)

value = base_decision("reject")
value["review_context"]["prior_decisions_complete"] = False
must_fail("incomplete decision history claim", value)

value = base_decision("reject")
value["review_context"]["replay_guard"]["nonce_not_seen"] = False
must_fail("failed replay guard", value)

print("KONTUR Human Activation Review decision schema coupling: PASS")
