#!/usr/bin/env python3
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "uncertainty-repair-cases.json").read_text(encoding="utf-8"))

EXPECTED_PREDECESSORS = [
    "shared-discovery-memory",
    "interaction-receipt",
    "conversation-variety",
    "safety-boundary",
]
EXPECTED_REPAIR_MODES = [
    "ACKNOWLEDGE",
    "REVISE",
    "DOWNGRADE",
    "CONTEST",
    "ASK_EVIDENCE",
    "DEFER",
    "CONTINUE",
]
EXPECTED_CLAIM_STATES = [
    "ACTIVE",
    "CHALLENGED",
    "DISPROVED",
    "CONTESTED",
    "SUPERSEDED",
]
EXPECTED_INVARIANTS = [
    "Correction != Model Defeat",
    "Changed Claim != Rewritten History",
    "Player Disagreement != Automatic Fact",
    "Disproved Hypothesis != Reusable Fact",
    "Uncertainty Repair != Confidence Theater",
    "Apology != Required Ritual",
    "Correction != Conversation Reset",
    "Evidence Update != Authority Expansion",
    "Local Correction != Global Truth",
    "Contestation != Forced Resolution",
    "Repair != Spoiler Escalation",
    "Repair != Assistance Escalation",
    "Repair != Action Permit",
]
EXPECTED_NON_EFFECTS = {
    "live_response_generation",
    "proactive_messaging",
    "background_notification",
    "autonomous_gameplay",
    "game_account_control",
    "external_effect_authorized",
    "action_permit_created",
    "successor_permit_created",
    "response_authority_created",
    "behavioral_profile",
    "psychological_profile",
    "mood_inference",
    "engagement_optimization",
    "retention_optimization",
    "total_history_required",
    "cross_game_truth_profile",
    "stable_core_promotion",
}
EXPECTED_CASES = {
    "verified-local-correction-revises",
    "bare-disagreement-stays-challenged",
    "conflicting-evidence-stays-contested",
    "disproved-hypothesis-not-reused",
    "history-not-rewritten-after-correction",
    "challenge-causes-confidence-downgrade",
    "repair-without-apology-ritual",
    "correction-continues-thread",
    "repair-does-not-escalate-spoilers",
    "repair-does-not-escalate-help",
    "cross-scope-correction-not-imported",
    "player-correction-does-not-create-authority",
    "irreversible-risk-repair-defers",
}
EPISTEMIC_RANK = {
    "PLAYFUL_THEORY": 0,
    "GUESS": 1,
    "LIKELY": 2,
    "KNOWN": 3,
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(data):
    require(data.get("artifact_type") == "KonturGameCompanionUncertaintyRepairCases", "artifact identity")
    require(data.get("version") == "0.1", "version")
    require(data.get("status") == "synthetic_non_executing", "status")
    require(data.get("predecessor_layers") == EXPECTED_PREDECESSORS, "predecessor layers")
    require(data.get("repair_modes") == EXPECTED_REPAIR_MODES, "repair modes")
    require(data.get("claim_states") == EXPECTED_CLAIM_STATES, "claim states")
    require(data.get("invariants") == EXPECTED_INVARIANTS, "invariants")

    limits = data.get("limits", {})
    require(limits.get("repair_scope") == "CURRENT_LOCAL_CLAIM", "repair scope")
    require(limits.get("prior_claim_must_remain_provenance_visible") is True, "provenance visibility")
    for field in [
        "global_truth_transfer",
        "apology_required",
        "conversation_reset_required",
        "authority_expansion_allowed",
        "assistance_escalation_allowed",
        "spoiler_escalation_allowed",
        "focus_switch_for_repair_allowed",
    ]:
        require(limits.get(field) is False, f"unsafe limit {field}")

    non_effects = data.get("non_effects", {})
    require(set(non_effects) == EXPECTED_NON_EFFECTS, "non-effect field set")
    require(all(value is False for value in non_effects.values()), "non-effects must all be false")

    cases = data.get("cases")
    require(isinstance(cases, list) and len(cases) == 13, "canonical case count")
    require({case.get("id") for case in cases} == EXPECTED_CASES, "canonical case ids")

    for case in cases:
        prior = case.get("prior_claim", {})
        evidence = case.get("new_evidence", {})
        repair = case.get("repair_candidate", {})

        require(prior.get("claim_id") == f"claim:{case['id']}", f"{case['id']}: claim id")
        require(prior.get("epistemic_mode") in EPISTEMIC_RANK, f"{case['id']}: prior epistemic mode")
        require(prior.get("state") in EXPECTED_CLAIM_STATES, f"{case['id']}: prior state")
        require(prior.get("provenance_visible") is True, f"{case['id']}: provenance hidden")

        require(isinstance(evidence.get("source"), str) and evidence["source"], f"{case['id']}: evidence source")
        require(evidence.get("strength") in {"LOW", "MEDIUM", "MIXED", "VERIFIED_LOCAL"}, f"{case['id']}: evidence strength")
        require(type(evidence.get("scope_match")) is bool, f"{case['id']}: scope match")
        require(type(evidence.get("contradicts_prior")) is bool, f"{case['id']}: contradiction flag")
        require(evidence.get("canonicality_proven") is False, f"{case['id']}: universal canonicality claim")

        require(repair.get("mode") in EXPECTED_REPAIR_MODES, f"{case['id']}: repair mode")
        require(repair.get("resulting_claim_state") in EXPECTED_CLAIM_STATES, f"{case['id']}: result state")
        require(repair.get("current_epistemic_mode") in EPISTEMIC_RANK, f"{case['id']}: current epistemic")
        require(repair.get("decision") == "ALLOW_REPAIR", f"{case['id']}: canonical decision")
        require(repair.get("preserve_prior_claim") is True, f"{case['id']}: history rewrite")
        require(repair.get("player_claim_promoted_to_global_truth") is False, f"{case['id']}: global truth promotion")
        require(repair.get("apology_required") is False, f"{case['id']}: apology ritual")
        require(repair.get("conversation_reset") is False, f"{case['id']}: conversation reset")
        require(repair.get("authority_created") is False, f"{case['id']}: authority creation")
        require(repair.get("assistance_depth_increased") is False, f"{case['id']}: assistance escalation")
        require(repair.get("spoiler_depth_increased") is False, f"{case['id']}: spoiler escalation")
        require(repair.get("focus_changed") is False, f"{case['id']}: focus change")
        require(repair.get("prior_claim_active_reuse") is False, f"{case['id']}: prior claim remains active")

        if evidence.get("contradicts_prior") and evidence.get("strength") in {"MEDIUM", "VERIFIED_LOCAL", "MIXED"}:
            require(repair.get("resulting_claim_state") != "ACTIVE", f"{case['id']}: contradiction ignored")

        if evidence.get("strength") == "LOW":
            require(repair.get("resulting_claim_state") in {"CHALLENGED", "CONTESTED"}, f"{case['id']}: weak disagreement over-promoted")
            require(EPISTEMIC_RANK[repair["current_epistemic_mode"]] <= EPISTEMIC_RANK["GUESS"], f"{case['id']}: weak evidence confidence theater")

        if evidence.get("strength") == "MIXED":
            require(repair.get("resulting_claim_state") == "CONTESTED", f"{case['id']}: mixed evidence forced resolution")

        if evidence.get("scope_match") is False:
            require(repair.get("mode") in {"ASK_EVIDENCE", "DEFER", "CONTEST"}, f"{case['id']}: cross-scope overwrite")
            require(repair.get("resulting_claim_state") in {"CHALLENGED", "CONTESTED"}, f"{case['id']}: cross-scope resolution")

        if repair.get("resulting_claim_state") == "DISPROVED":
            require(repair.get("prior_claim_active_reuse") is False, f"{case['id']}: disproved active guidance")

        if prior.get("epistemic_mode") == "KNOWN" and evidence.get("contradicts_prior"):
            require(EPISTEMIC_RANK[repair["current_epistemic_mode"]] < EPISTEMIC_RANK["KNOWN"], f"{case['id']}: known claim not downgraded")

    by_id = {c["id"]: c for c in cases}
    require(by_id["verified-local-correction-revises"]["repair_candidate"]["resulting_claim_state"] == "DISPROVED", "verified correction must revise")
    require(by_id["bare-disagreement-stays-challenged"]["repair_candidate"]["resulting_claim_state"] == "CHALLENGED", "bare disagreement must remain challenged")
    require(by_id["conflicting-evidence-stays-contested"]["repair_candidate"]["resulting_claim_state"] == "CONTESTED", "conflict must remain contested")
    require(by_id["history-not-rewritten-after-correction"]["repair_candidate"]["preserve_prior_claim"] is True, "history must remain")
    require(by_id["challenge-causes-confidence-downgrade"]["repair_candidate"]["current_epistemic_mode"] == "LIKELY", "confidence downgrade")
    require(by_id["repair-without-apology-ritual"]["repair_candidate"]["apology_required"] is False, "apology ritual")
    require(by_id["correction-continues-thread"]["repair_candidate"]["conversation_reset"] is False, "correction reset")
    require(by_id["cross-scope-correction-not-imported"]["new_evidence"]["scope_match"] is False, "cross-scope fixture")
    require(by_id["irreversible-risk-repair-defers"]["repair_candidate"]["mode"] == "DEFER", "irreversible-risk defer")
    return True


validate(DATA)

MUTATIONS = [
    lambda x: x.update({"artifact_type": "Other"}),
    lambda x: x.update({"version": "9"}),
    lambda x: x.update({"status": "live"}),
    lambda x: x["predecessor_layers"].reverse(),
    lambda x: x["repair_modes"].append("OVERRIDE"),
    lambda x: x["claim_states"].append("ERASED"),
    lambda x: x["invariants"].remove("Changed Claim != Rewritten History"),
    lambda x: x["limits"].update({"repair_scope": "PLAYER_PROFILE"}),
    lambda x: x["limits"].update({"global_truth_transfer": True}),
    lambda x: x["limits"].update({"apology_required": True}),
    lambda x: x["limits"].update({"conversation_reset_required": True}),
    lambda x: x["limits"].update({"authority_expansion_allowed": True}),
    lambda x: x["limits"].update({"assistance_escalation_allowed": True}),
    lambda x: x["limits"].update({"spoiler_escalation_allowed": True}),
    lambda x: x["limits"].update({"focus_switch_for_repair_allowed": True}),
    lambda x: x["non_effects"].update({"live_response_generation": True}),
    lambda x: x["non_effects"].update({"action_permit_created": True}),
    lambda x: x["non_effects"].update({"stable_core_promotion": True}),
    lambda x: x["non_effects"].pop("psychological_profile"),
    lambda x: x["cases"].pop(),
    lambda x: x["cases"][0]["prior_claim"].update({"provenance_visible": False}),
    lambda x: x["cases"][0]["repair_candidate"].update({"preserve_prior_claim": False}),
    lambda x: x["cases"][0]["repair_candidate"].update({"player_claim_promoted_to_global_truth": True}),
    lambda x: x["cases"][0]["repair_candidate"].update({"authority_created": True}),
    lambda x: x["cases"][0]["repair_candidate"].update({"assistance_depth_increased": True}),
    lambda x: x["cases"][0]["repair_candidate"].update({"spoiler_depth_increased": True}),
    lambda x: x["cases"][0]["repair_candidate"].update({"focus_changed": True}),
    lambda x: x["cases"][1]["repair_candidate"].update({"resulting_claim_state": "DISPROVED"}),
    lambda x: x["cases"][1]["repair_candidate"].update({"current_epistemic_mode": "KNOWN"}),
    lambda x: x["cases"][2]["repair_candidate"].update({"resulting_claim_state": "DISPROVED"}),
    lambda x: x["cases"][3]["repair_candidate"].update({"prior_claim_active_reuse": True}),
    lambda x: x["cases"][5]["repair_candidate"].update({"current_epistemic_mode": "KNOWN"}),
    lambda x: x["cases"][6]["repair_candidate"].update({"apology_required": True}),
    lambda x: x["cases"][7]["repair_candidate"].update({"conversation_reset": True}),
    lambda x: x["cases"][10]["repair_candidate"].update({"mode": "REVISE"}),
    lambda x: x["cases"][10]["repair_candidate"].update({"resulting_claim_state": "DISPROVED"}),
    lambda x: x["cases"][11]["repair_candidate"].update({"authority_created": True}),
    lambda x: x["cases"][12]["repair_candidate"].update({"mode": "REVISE"}),
]

rejected = 0
for mutate in MUTATIONS:
    candidate = copy.deepcopy(DATA)
    mutate(candidate)
    try:
        validate(candidate)
    except (ValueError, KeyError, TypeError):
        rejected += 1
    else:
        raise SystemExit("unsafe mutation unexpectedly passed")

print(
    f"KONTUR Game Companion Uncertainty Repair v0.1: "
    f"{len(DATA['cases'])} canonical cases valid; {rejected} unsafe mutations rejected."
)
