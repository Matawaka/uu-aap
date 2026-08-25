#!/usr/bin/env python3
import copy
import json
from pathlib import Path

FIXTURE = Path(__file__).with_name("interaction-receipt-cases.json")
ORIGIN = "b45eaf9ba8864023d822340181ae129f1245beb1"

ASSISTANCE = {
    "COMMENT": 0,
    "NOTICE": 1,
    "QUESTION": 2,
    "THEORY": 3,
    "NUDGE": 4,
    "HINT": 5,
    "PARTIAL_SOLUTION": 6,
    "SOLUTION": 7,
}
INITIATIVE = {"NONE": -1, "NOTICE": 1, "QUESTION": 2, "THEORY": 3, "NUDGE": 4}
INTENT_CEILING = {
    "CONVERSATION": "THEORY",
    "HINT_REQUEST": "HINT",
    "PARTIAL_SOLUTION_REQUEST": "PARTIAL_SOLUTION",
    "SOLUTION_REQUEST": "SOLUTION",
}
EPISTEMIC = {"KNOWN", "LIKELY", "GUESS", "PLAYFUL_THEORY"}
REVERSIBILITY = {"REVERSIBLE", "COSTLY_RECOVERABLE", "IRREVERSIBLE"}
MEMORY_STATUS = {"NONE", "ACTIVE", "CONTESTED", "EXPIRED"}
MEMORY_CLASS = {
    "NONE",
    "HYPOTHESIS",
    "CORRECTION",
    "CONFIRMED_LOCAL_FACT",
    "OPEN_MYSTERY",
    "SHARED_LABEL",
    "SPOILER_EXPOSURE",
    "LOCAL_EXPERTISE_SIGNAL",
}
FOCUS_SOURCE = {"PLAYER_SELECTED", "CURRENT_SCENE", "SHARED_MEMORY", "PREDICTED_INTEREST", "NONE"}
CORRECTION_OUTCOME = {"NONE", "REVISED", "CONTESTED"}

DECISION_SEMANTICS = {
    "decision_field": "response_admissible",
    "scope": "THIS_CANDIDATE_ONLY",
    "authority_effect": "NONE",
    "action_effect": "NONE",
    "successor_effect": "NONE",
}

BOUNDARY_FALSE = {
    "live_kontur_response_generation",
    "live_proactive_messaging",
    "autonomous_gameplay",
    "game_account_control",
    "behavioral_profile",
    "psychological_inference",
    "attention_tracking",
    "engagement_optimization",
    "retention_optimization",
    "total_history_required",
    "cross_game_preference_profile",
    "stable_core_promotion",
    "external_effect_authorized",
    "response_authority_created",
    "action_permit_created",
    "successor_permit_created",
}

EXPECTED_IDS = {
    "player-led-conversation",
    "explicit-hint-request",
    "bounded-current-cue-question",
    "active-open-mystery-callback",
    "player-correction-revises-local-model",
    "unsolicited-deep-solution-blocked",
    "expired-cross-scope-memory-blocked",
    "predicted-interest-override-blocked",
    "uncertain-irreversible-proactive-nudge-blocked",
    "dependency-signal-shallower-help",
}

EXPECTED_ADMISSIBILITY = {
    "player-led-conversation": True,
    "explicit-hint-request": True,
    "bounded-current-cue-question": True,
    "active-open-mystery-callback": True,
    "player-correction-revises-local-model": True,
    "unsolicited-deep-solution-blocked": False,
    "expired-cross-scope-memory-blocked": False,
    "predicted-interest-override-blocked": False,
    "uncertain-irreversible-proactive-nudge-blocked": False,
    "dependency-signal-shallower-help": True,
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def must_block(condition, case, reason):
    if condition and case["response_admissible"]:
        raise AssertionError(f"{case['id']}: must be inadmissible: {reason}")


def index_cases(payload):
    return {case["id"]: case for case in payload["cases"]}


def validate(payload):
    require(payload.get("schema_version") == "0.2", "schema_version must be 0.2")
    require(payload.get("pilot_id") == "kontur-game-companion-interaction-receipt", "unexpected pilot_id")
    require(payload.get("origin_frontier") == ORIGIN, "origin frontier changed")
    require(payload.get("source_issue") == 445, "source issue must remain #445")
    require(payload.get("predecessor_prs") == [446, 452, 453, 454, 455], "predecessor chain changed")
    require(payload.get("mode") == "SYNTHETIC_COMPANION_INTERACTION_RECEIPT", "mode changed")
    require(
        payload.get("semantic_revision") == "F003_RECEIPT_AUTHORITY_SEPARATION",
        "semantic revision marker changed",
    )
    require(payload.get("decision_semantics") == DECISION_SEMANTICS, "decision semantics must remain exact")

    boundary = payload.get("boundary")
    require(isinstance(boundary, dict), "boundary must be an object")
    require(set(boundary) == BOUNDARY_FALSE, "boundary field set changed")
    for field in BOUNDARY_FALSE:
        require(boundary[field] is False, f"boundary leak: {field}=true")

    cases = payload.get("cases")
    require(isinstance(cases, list) and len(cases) == 10, "exactly ten canonical cases required")
    ids = [case.get("id") for case in cases]
    require(len(ids) == len(set(ids)), "case ids must be unique")
    require(set(ids) == EXPECTED_IDS, "canonical case set changed")

    required_bool = {
        "initiative_authorized",
        "memory_used",
        "memory_scope_match",
        "player_focus_present",
        "focus_overrides_player",
        "irreversible_loss_risk",
        "player_correction_received",
        "global_truth_promoted",
        "dependency_risk_signal",
        "help_refused",
        "durable_player_profile_created",
        "agency_preserved",
        "player_can_ignore",
        "receipt_complete",
        "response_admissible",
    }

    for case in cases:
        cid = case["id"]
        require("response_authorized" not in case, f"{cid}: legacy response_authorized field is forbidden")
        require(case.get("interaction_owner") in {"PLAYER_LED", "COMPANION_LED"}, f"{cid}: invalid interaction_owner")
        require(case.get("intent_class") in INTENT_CEILING, f"{cid}: invalid intent_class")
        require(case.get("epistemic_mode") in EPISTEMIC, f"{cid}: invalid epistemic_mode")
        require(case.get("assistance_depth") in ASSISTANCE, f"{cid}: invalid assistance_depth")
        require(case.get("max_assistance_depth") in ASSISTANCE, f"{cid}: invalid max_assistance_depth")
        require(case.get("initiative_depth") in INITIATIVE, f"{cid}: invalid initiative_depth")
        require(case.get("memory_status") in MEMORY_STATUS, f"{cid}: invalid memory_status")
        require(case.get("memory_class") in MEMORY_CLASS, f"{cid}: invalid memory_class")
        require(case.get("focus_source") in FOCUS_SOURCE, f"{cid}: invalid focus_source")
        require(case.get("reversibility") in REVERSIBILITY, f"{cid}: invalid reversibility")
        require(case.get("correction_outcome") in CORRECTION_OUTCOME, f"{cid}: invalid correction_outcome")

        for field in required_bool:
            require(type(case.get(field)) is bool, f"{cid}: {field} must be boolean")

        for field in ("spoiler_budget", "already_revealed_spoiler_level", "new_spoiler_level"):
            value = case.get(field)
            require(type(value) is int and 0 <= value <= 3, f"{cid}: {field} must be integer 0..3")

        chosen = ASSISTANCE[case["assistance_depth"]]
        maximum = ASSISTANCE[case["max_assistance_depth"]]
        must_block(chosen > maximum, case, "chosen assistance exceeds local maximum")

        if case["interaction_owner"] == "PLAYER_LED":
            require(
                case["initiative_authorized"] is False,
                f"{cid}: player-led receipt cannot carry initiative authorization",
            )
            require(case["initiative_depth"] == "NONE", f"{cid}: player-led initiative depth must be NONE")
            intent_max = ASSISTANCE[INTENT_CEILING[case["intent_class"]]]
            must_block(chosen > intent_max, case, "assistance exceeds current player intent")
        else:
            must_block(
                not case["initiative_authorized"],
                case,
                "companion-led candidate lacks upstream bounded-initiative allowance",
            )
            must_block(case["initiative_depth"] == "NONE", case, "companion-led candidate has no initiative depth")
            if case["initiative_depth"] != "NONE":
                must_block(
                    chosen > INITIATIVE[case["initiative_depth"]],
                    case,
                    "assistance exceeds upstream initiative depth",
                )
            must_block(chosen > ASSISTANCE["NUDGE"], case, "companion-led candidate exceeds proactive NUDGE ceiling")
            require(maximum <= ASSISTANCE["NUDGE"], f"{cid}: proactive maximum cannot exceed NUDGE")

        if case["memory_used"]:
            must_block(case["memory_status"] != "ACTIVE", case, "memory is not active")
            must_block(not case["memory_scope_match"], case, "memory scope does not match")
            require(case["memory_class"] != "NONE", f"{cid}: used memory needs a memory class")
        else:
            require(case["memory_status"] == "NONE", f"{cid}: unused memory status must be NONE")
            require(case["memory_class"] == "NONE", f"{cid}: unused memory class must be NONE")
            require(case["memory_scope_match"] is False, f"{cid}: unused memory cannot assert scope match")

        must_block(
            case["player_focus_present"] and case["focus_overrides_player"],
            case,
            "system focus overrides player-selected focus",
        )

        allowed_spoiler_level = max(case["already_revealed_spoiler_level"], case["spoiler_budget"])
        must_block(
            case["new_spoiler_level"] > allowed_spoiler_level,
            case,
            "spoiler disclosure exceeds budget/prior exposure",
        )

        uncertain = case["epistemic_mode"] in {"GUESS", "PLAYFUL_THEORY"}
        irreversible_uncertain_risk = (
            case["reversibility"] == "IRREVERSIBLE"
            and case["irreversible_loss_risk"]
            and uncertain
        )
        must_block(
            irreversible_uncertain_risk and chosen > ASSISTANCE["NUDGE"],
            case,
            "deep uncertain irreversible assistance",
        )
        must_block(
            irreversible_uncertain_risk
            and case["interaction_owner"] == "COMPANION_LED"
            and case["initiative_depth"] == "NUDGE",
            case,
            "proactive uncertain irreversible nudge",
        )

        if case["player_correction_received"]:
            must_block(
                case["correction_outcome"] not in {"REVISED", "CONTESTED"},
                case,
                "player correction not revised or contested",
            )
        else:
            require(case["correction_outcome"] == "NONE", f"{cid}: correction outcome without correction")
        must_block(case["global_truth_promoted"], case, "local correction promoted to global truth")

        must_block(case["durable_player_profile_created"], case, "durable player profile created")
        if case["dependency_risk_signal"]:
            must_block(case["help_refused"], case, "anti-dependency became refusal")
            must_block(not case["agency_preserved"], case, "anti-dependency reduced agency")
            must_block(not case["player_can_ignore"], case, "anti-dependency made candidate non-ignorable")

        if case["response_admissible"]:
            require(case["receipt_complete"], f"{cid}: admissible candidate requires complete receipt")
            require(case["agency_preserved"], f"{cid}: admissible candidate must preserve agency")
            require(case["player_can_ignore"], f"{cid}: admissible candidate must remain ignorable")
            require(case["help_refused"] is False, f"{cid}: admissible candidate cannot encode refusal")

    by_id = index_cases(payload)
    for cid, expected in EXPECTED_ADMISSIBILITY.items():
        require(by_id[cid]["response_admissible"] is expected, f"{cid}: canonical admissibility changed")

    require(by_id["explicit-hint-request"]["assistance_depth"] == "HINT", "hint case must remain HINT")
    require(
        by_id["bounded-current-cue-question"]["initiative_depth"] == "QUESTION",
        "current cue must remain bounded QUESTION",
    )
    require(by_id["active-open-mystery-callback"]["memory_status"] == "ACTIVE", "open mystery memory must be active")
    require(
        by_id["active-open-mystery-callback"]["memory_scope_match"] is True,
        "open mystery memory must be local",
    )
    require(
        by_id["player-correction-revises-local-model"]["correction_outcome"] == "REVISED",
        "correction must revise local model",
    )
    require(
        by_id["unsolicited-deep-solution-blocked"]["assistance_depth"] == "SOLUTION",
        "unsolicited candidate must test SOLUTION",
    )
    require(
        by_id["expired-cross-scope-memory-blocked"]["memory_status"] == "EXPIRED",
        "expired-memory boundary changed",
    )
    require(
        by_id["predicted-interest-override-blocked"]["focus_overrides_player"] is True,
        "focus override boundary changed",
    )
    require(
        by_id["uncertain-irreversible-proactive-nudge-blocked"]["epistemic_mode"] == "GUESS",
        "irreversible case must remain uncertain",
    )
    require(
        by_id["dependency-signal-shallower-help"]["dependency_risk_signal"] is True,
        "dependency signal boundary changed",
    )
    require(
        by_id["dependency-signal-shallower-help"]["assistance_depth"] == "QUESTION",
        "anti-dependency case must stay shallower",
    )


def mutate_boundary(field):
    def apply(payload):
        payload["boundary"][field] = True
    return apply


def mutate_case(case_id, field, value):
    def apply(payload):
        index_cases(payload)[case_id][field] = value
    return apply


def mutate_semantic(field, value):
    def apply(payload):
        payload["decision_semantics"][field] = value
    return apply


def reintroduce_legacy_field(payload):
    index_cases(payload)["player-led-conversation"]["response_authorized"] = True


NEGATIVE_MUTATIONS = [(f"boundary:{field}", mutate_boundary(field)) for field in sorted(BOUNDARY_FALSE)] + [
    ("decision-field-authorized", mutate_semantic("decision_field", "response_authorized")),
    ("decision-scope-future", mutate_semantic("scope", "CURRENT_AND_FUTURE")),
    ("decision-authority-effect", mutate_semantic("authority_effect", "RESPONSE_AUTHORITY")),
    ("decision-action-effect", mutate_semantic("action_effect", "ACTION_PERMIT")),
    ("decision-successor-effect", mutate_semantic("successor_effect", "SUCCESSOR_PERMIT")),
    ("legacy-response-authorized-field", reintroduce_legacy_field),
    ("admissible-incomplete-receipt", mutate_case("player-led-conversation", "receipt_complete", False)),
    ("admissible-agency-lost", mutate_case("player-led-conversation", "agency_preserved", False)),
    ("admissible-not-ignorable", mutate_case("player-led-conversation", "player_can_ignore", False)),
    ("hint-spoiler-overflow", mutate_case("explicit-hint-request", "new_spoiler_level", 2)),
    ("hint-escalates-to-solution", mutate_case("explicit-hint-request", "assistance_depth", "SOLUTION")),
    ("companion-initiative-without-upstream-allowance", mutate_case("bounded-current-cue-question", "initiative_authorized", False)),
    ("companion-initiative-depth-none", mutate_case("bounded-current-cue-question", "initiative_depth", "NONE")),
    ("companion-question-becomes-hint", mutate_case("bounded-current-cue-question", "assistance_depth", "HINT")),
    ("open-mystery-memory-expired", mutate_case("active-open-mystery-callback", "memory_status", "EXPIRED")),
    ("open-mystery-scope-mismatch", mutate_case("active-open-mystery-callback", "memory_scope_match", False)),
    ("correction-not-revised", mutate_case("player-correction-revises-local-model", "correction_outcome", "NONE")),
    ("correction-promoted-global", mutate_case("player-correction-revises-local-model", "global_truth_promoted", True)),
    ("unsolicited-solution-admissible", mutate_case("unsolicited-deep-solution-blocked", "response_admissible", True)),
    ("expired-memory-admissible", mutate_case("expired-cross-scope-memory-blocked", "response_admissible", True)),
    ("predicted-focus-override-admissible", mutate_case("predicted-interest-override-blocked", "response_admissible", True)),
    ("irreversible-uncertain-nudge-admissible", mutate_case("uncertain-irreversible-proactive-nudge-blocked", "response_admissible", True)),
    ("dependency-help-refused", mutate_case("dependency-signal-shallower-help", "help_refused", True)),
    ("dependency-durable-profile", mutate_case("dependency-signal-shallower-help", "durable_player_profile_created", True)),
    ("dependency-agency-lost", mutate_case("dependency-signal-shallower-help", "agency_preserved", False)),
    ("dependency-non-ignorable", mutate_case("dependency-signal-shallower-help", "player_can_ignore", False)),
]


def main():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    validate(payload)

    rejected = 0
    for name, mutate in NEGATIVE_MUTATIONS:
        candidate = copy.deepcopy(payload)
        mutate(candidate)
        try:
            validate(candidate)
        except AssertionError:
            rejected += 1
        else:
            raise AssertionError(f"negative mutation unexpectedly accepted: {name}")

    print(
        "OK: KONTUR Game Companion Interaction Receipt v0.2; "
        f"{len(payload['cases'])} canonical cases; "
        f"{rejected} fail-closed mutations rejected; "
        "response_admissible creates no authority"
    )


if __name__ == "__main__":
    main()
