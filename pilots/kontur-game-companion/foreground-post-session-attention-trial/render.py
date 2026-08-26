#!/usr/bin/env python3
"""Pure renderer for a bounded post-session context card.

The renderer deliberately receives already-validated identities and statuses.  It
does not read files, call a model, contact a process, persist state, or render any
aggregate value.
"""


SCHEMA_VERSION = "kontur-game-companion-foreground-post-session-context-card-v0.1"
STATUS = "FOREGROUND_ONE_SHOT_COMPLETED_OBSERVATION_CONTEXT"


class ContextCardError(ValueError):
    pass


def _require(condition, message):
    if not condition:
        raise ContextCardError(message)


def _reject_numeric_values(value):
    """Fail closed if a count or any other numeric value reaches the card."""

    if type(value) in {int, float}:
        raise ContextCardError("numeric values are not renderable")
    if isinstance(value, dict):
        for nested in value.values():
            _reject_numeric_values(nested)
    elif isinstance(value, list):
        for nested in value:
            _reject_numeric_values(nested)


def build_context_card(
    *,
    input_status,
    cue_identity,
    selected_category_identity,
    available_category_identities,
    bridge_receipt,
):
    """Return a deterministic, value-free view of the bridge evaluation."""

    _require(
        input_status
        in {
            "REPOSITORY_OWNED_SYNTHETIC_SCENARIO",
            "SUPPLIED_COMPLETED_INGEST_RECEIPT",
            "STDIN_COMPLETED_INGEST_RECEIPT",
        },
        "input status",
    )
    _require(isinstance(cue_identity, str), "cue identity")
    _require(
        selected_category_identity is None
        or isinstance(selected_category_identity, str),
        "selected category identity",
    )
    _require(
        isinstance(available_category_identities, list)
        and all(isinstance(item, str) for item in available_category_identities),
        "available category identities",
    )
    _require(isinstance(bridge_receipt, dict), "bridge receipt")

    event_status = (
        "CREATED_NOT_ADMITTED"
        if bridge_receipt["player_event_candidate_created"]
        else "NOT_CREATED"
    )
    card = {
        "schema_version": SCHEMA_VERSION,
        "status": STATUS,
        "input_status": input_status,
        "cue_identity": cue_identity,
        "category_identities": {
            "available": list(available_category_identities),
            "selected": selected_category_identity,
            "bridged": list(bridge_receipt["focus_candidate_categories"]),
        },
        "provenance_status": {
            "source_ingest_receipt_digest": bridge_receipt[
                "source_ingest_receipt_digest"
            ],
            "source_external_session_evidence_ref": bridge_receipt[
                "source_external_session_evidence_ref"
            ],
            "source_summary_digest": bridge_receipt["source_summary_digest"],
            "state_anchor_digest": bridge_receipt["source_state_anchor_digest"],
            "structured_cue_digest": bridge_receipt["structured_cue_digest"],
            "bridge_receipt_digest": bridge_receipt["bridge_receipt_digest"],
            "source_integrity": "VALIDATED",
            "source_authenticity": "NOT_PROVEN",
            "runtime_state_authentication": "NOT_PROVEN",
            "cue_authentication": "NOT_PROVEN",
            "source_currentness": "COMPLETED_SESSION_NOT_CURRENT_GAME_EVENT",
        },
        "bridge_status": {
            "decision": bridge_receipt["decision"],
            "reason": bridge_receipt["reason"],
            "event_candidate": event_status,
            "runtime_eligibility": "DENIED",
            "semantic_game_fact": "NOT_CLAIMED",
            "next_boundary": bridge_receipt["next_boundary"],
            "next_human_decision": bridge_receipt["next_human_decision"],
        },
        "effect_status": {
            "authority": "NONE",
            "action": "NONE",
            "successor": "NONE",
            "external": "NONE",
            "persistence": "NONE",
        },
    }
    _reject_numeric_values(card)
    return card
