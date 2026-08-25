#!/usr/bin/env python3
import copy
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
TRACE = ROOT / "integrated-conversation-trace.json"

ASSISTANCE = ["COMMENT", "NOTICE", "QUESTION", "THEORY", "NUDGE", "HINT", "PARTIAL_SOLUTION", "SOLUTION"]
INITIATIVE = ["NONE", "NOTICE", "QUESTION", "THEORY", "NUDGE"]

REQUIRED_COMPONENTS = [
    "observational-lane", "assistance-gate", "shared-discovery-memory",
    "bounded-initiative", "focus-diversity", "interaction-receipt",
    "pause-resume", "conversation-variety", "uncertainty-repair",
    "self-discovery-gate", "bounded-playfulness", "safety-boundary",
    "dependency-contract",
]

INVARIANTS = [
    "Composed Admissibility != Runtime Authority",
    "Layer Pass != Global Permission",
    "Cross-Layer Consistency != Correct Game Answer",
    "Continuity != Intent Carryover",
    "Humor != Hidden Hint",
    "Repair != History Rewrite",
    "Discovery Prompt != Mandatory Pedagogy",
    "Explicit Solution Request != Permanent Solver Mode",
    "One Allowed Solution != Future Solution Authority",
    "Integrated Trace != Runtime Connectedness",
]

NON_EFFECTS = [
    "live_response_generation", "proactive_messaging", "background_activity",
    "autonomous_gameplay", "game_account_control", "external_effect",
    "response_authority_created", "action_permit_created", "successor_permit_created",
    "behavioral_profile", "psychological_inference", "mood_inference",
    "attention_tracking", "engagement_maximization", "retention_optimization",
    "total_history_capture", "cross_game_preference_profile", "stable_core_promotion",
]

EXPECTED_EVENTS = [
    "PLAYER_HYPOTHESIS",
    "PLAYFUL_THEORY_RESPONSE",
    "PLAYER_CORRECTION",
    "CORRECTION_REPAIR_AND_DISCOVERY_PROMPT",
    "PLAYER_OBSERVATION",
    "MINIMAL_DISCOVERY_CUE",
    "PAUSE",
    "RESUME",
    "NEUTRAL_RESUME_CHECKIN",
    "EXPLICIT_HINT_REQUEST",
    "BOUNDED_HINT",
    "PLAYER_REJECTS_HINT_HYPOTHESIS",
    "CONTESTED_REPAIR",
    "EXPLICIT_SOLUTION_REQUEST",
    "EXPLICIT_SOLUTION_AFTER_BYPASS",
]

ALLOWED_PLAYFUL_TARGETS = {
    "GAME_SITUATION", "GAME_MECHANIC", "COMPANION_HYPOTHESIS",
    "LOCAL_SHARED_LABEL", "NEUTRAL_EVENT",
}
BLOCKED_PLAYFUL_TARGETS = {
    "PLAYER_ABILITY", "PLAYER_INTELLIGENCE", "PLAYER_PERSONALITY",
    "PLAYER_IDENTITY", "PLAYER_WORTH", "PLAYER_REFUSAL",
    "PLAYER_FRUSTRATION", "PLAYER_MISTAKE_AS_TRAIT",
}

def fail(message):
    raise AssertionError(message)

def rank(value, ladder, name):
    if value not in ladder:
        fail(f"unknown {name}: {value}")
    return ladder.index(value)

def validate(data):
    if data.get("schema_version") != "kontur-game-companion-integrated-conversation-trace-v0.1":
        fail("schema_version")
    if data.get("status") != "SYNTHETIC_NON_EXECUTING":
        fail("status")
    if data.get("origin_frontier") != "8a6848b0eb56f4e471d5995155e39e852b28de45":
        fail("origin_frontier")
    if data.get("runtime_connectedness") != "NOT_PROVEN":
        fail("runtime_connectedness")

    if data.get("composition_semantics", {}) != {
        "decision": "TRACE_CONSISTENT",
        "authority_effect": "NONE",
        "action_effect": "NONE",
        "successor_effect": "NONE",
        "stable_core_effect": "NONE",
    }:
        fail("composition_semantics")

    if data.get("required_components") != REQUIRED_COMPONENTS:
        fail("required_components")
    for component in REQUIRED_COMPONENTS:
        readme = REPO / "pilots" / "kontur-game-companion" / component / "README.md"
        validator = REPO / "pilots" / "kontur-game-companion" / component / "validate.py"
        if not readme.is_file():
            fail(f"missing component README: {component}")
        if not validator.is_file():
            fail(f"missing component validator: {component}")

    if data.get("invariants") != INVARIANTS:
        fail("invariants")

    non_effects = data.get("non_effects")
    if set(non_effects or {}) != set(NON_EFFECTS):
        fail("non_effect keys")
    if any(non_effects[name] is not False for name in NON_EFFECTS):
        fail("non_effect must remain false")

    turns = data.get("turns")
    if not isinstance(turns, list) or len(turns) != 15:
        fail("turn count")
    if [t.get("turn") for t in turns] != list(range(1, 16)):
        fail("turn numbering")
    if [t.get("event") for t in turns] != EXPECTED_EVENTS:
        fail("event sequence")

    by_turn = {t["turn"]: t for t in turns}

    for t in turns:
        speaker = t.get("speaker")
        if speaker == "PLAYER":
            if t.get("companion_response", None) is not None:
                fail(f"player turn {t['turn']} contains companion response")
            continue
        if speaker != "COMPANION":
            fail(f"unknown speaker at turn {t['turn']}")

        receipt = t.get("interaction_receipt", {})
        if receipt.get("response_admissible") is not True:
            fail(f"turn {t['turn']} not admissible")
        if receipt.get("scope") != "THIS_CANDIDATE_ONLY":
            fail(f"turn {t['turn']} receipt scope")
        if receipt.get("authority_effect") != "NONE":
            fail(f"turn {t['turn']} receipt authority")
        if receipt.get("response_authority_created") is not False:
            fail(f"turn {t['turn']} response authority created")

        assistance = t.get("assistance", {})
        ceiling = assistance.get("ceiling")
        selected = assistance.get("selected")
        if rank(selected, ASSISTANCE, "selected assistance") > rank(ceiling, ASSISTANCE, "assistance ceiling"):
            fail(f"turn {t['turn']} assistance escalation")
        if assistance.get("new_spoiler_level", 0) > assistance.get("spoiler_budget", -1):
            fail(f"turn {t['turn']} spoiler escalation")

        initiative = t.get("initiative", {})
        if initiative.get("companion_led"):
            if rank(initiative.get("selected_depth"), INITIATIVE, "selected initiative") > rank(initiative.get("authorized_depth"), INITIATIVE, "initiative ceiling"):
                fail(f"turn {t['turn']} initiative escalation")
        elif initiative.get("selected_depth") != "NONE":
            fail(f"turn {t['turn']} player-led response has initiative depth")

        variety = t.get("variety")
        if variety:
            if variety.get("objective") in {"ENGAGEMENT_MAXIMIZATION", "RETENTION_OPTIMIZATION", "ATTENTION_CAPTURE"}:
                fail(f"turn {t['turn']} invalid variety objective")
            if variety.get("focus_preserved") is not True:
                fail(f"turn {t['turn']} variety redirects focus")

        playful = t.get("playfulness")
        if playful:
            target = playful.get("target")
            if target in BLOCKED_PLAYFUL_TARGETS or target not in ALLOWED_PLAYFUL_TARGETS:
                fail(f"turn {t['turn']} invalid humor target")
            if playful.get("hidden_hint") is not False:
                fail(f"turn {t['turn']} hidden hint")
            if playful.get("pressure_to_continue") is not False:
                fail(f"turn {t['turn']} pressure to continue")
            if playful.get("mode") == "PLAYFUL_HYPOTHESIS" and playful.get("epistemic_mode") != "PLAYFUL_THEORY":
                fail(f"turn {t['turn']} playful hypothesis false certainty")

        discovery = t.get("discovery")
        if discovery:
            if discovery.get("hidden_answer") is not False:
                fail(f"turn {t['turn']} hidden answer")
            outcome = discovery.get("outcome")
            if outcome == "ALLOW_PROMPT":
                if discovery.get("reversible") is not True or discovery.get("low_cost") is not True:
                    fail(f"turn {t['turn']} unsafe discovery experiment")
                if discovery.get("focus_preserved") is not True:
                    fail(f"turn {t['turn']} discovery redirects focus")
            if outcome == "BYPASS_DISCOVERY":
                if t.get("player_intent") != "SOLUTION_REQUEST":
                    fail(f"turn {t['turn']} invalid discovery bypass")
                if assistance.get("ceiling") != "SOLUTION" or assistance.get("selected") != "SOLUTION":
                    fail(f"turn {t['turn']} bypass without solution ceiling")

        memory = t.get("memory_reuse")
        if memory and (memory.get("active") is not True or memory.get("scope_match") is not True):
            fail(f"turn {t['turn']} invalid memory reuse")

        repair = t.get("uncertainty_repair")
        if repair:
            if repair.get("history_rewritten") is not False:
                fail(f"turn {t['turn']} history rewritten")
            if repair.get("player_claim_promoted_global") is not False:
                fail(f"turn {t['turn']} player claim promoted global")

    if by_turn[3]["correction"]["target_turn"] != 2 or by_turn[4]["uncertainty_repair"]["target_turn"] != 2:
        fail("first correction/repair linkage")
    if by_turn[4]["uncertainty_repair"]["new_state"] != "DISPROVED":
        fail("first repair state")

    if by_turn[7]["pause_resume"] != {"transition":"SESSION_BREAK","help_authority_carried":False,"intent_carried":False,"focus_carried":False}:
        fail("pause boundary")
    if by_turn[8]["pause_resume"] != {"transition":"LIGHT_RECALL","help_authority_carried":False,"intent_carried":False,"focus_carried":False}:
        fail("resume boundary")
    if by_turn[9]["pause_resume"].get("old_help_reused") is not False or by_turn[9]["pause_resume"].get("old_focus_forced") is not False:
        fail("stale resume authority/focus")

    if by_turn[10]["player_intent"] != "HINT_REQUEST":
        fail("hint intent")
    if by_turn[11]["assistance"]["selected"] != "HINT" or by_turn[11]["assistance"]["ceiling"] != "HINT":
        fail("bounded hint")

    if by_turn[12]["correction"]["target_turn"] != 11 or by_turn[13]["uncertainty_repair"]["target_turn"] != 11:
        fail("second correction/repair linkage")
    if by_turn[13]["uncertainty_repair"]["new_state"] != "CHALLENGED":
        fail("second repair state")

    if by_turn[14]["player_intent"] != "SOLUTION_REQUEST":
        fail("solution intent")
    if by_turn[15]["discovery"]["outcome"] != "BYPASS_DISCOVERY":
        fail("solution discovery bypass")
    solution_scope = by_turn[15].get("solution_scope", {})
    if solution_scope.get("this_request_only") is not True:
        fail("solution not scoped to current request")
    if solution_scope.get("future_solution_authority") is not False:
        fail("solution authority leaked forward")

    return True

def mutation_cases(base):
    mutations = []
    def add(name, fn):
        data = copy.deepcopy(base)
        fn(data)
        mutations.append((name, data))

    add("runtime_connectedness", lambda d: d.__setitem__("runtime_connectedness", "PROVEN"))
    add("authority_effect", lambda d: d["composition_semantics"].__setitem__("authority_effect", "GRANTED"))
    add("action_effect", lambda d: d["composition_semantics"].__setitem__("action_effect", "ACTION_PERMIT"))
    add("successor_effect", lambda d: d["composition_semantics"].__setitem__("successor_effect", "SUCCESSOR_PERMIT"))
    add("stable_core_effect", lambda d: d["composition_semantics"].__setitem__("stable_core_effect", "PROMOTE"))
    add("non_effect_external", lambda d: d["non_effects"].__setitem__("external_effect", True))
    add("non_effect_profile", lambda d: d["non_effects"].__setitem__("psychological_inference", True))
    add("non_effect_retention", lambda d: d["non_effects"].__setitem__("retention_optimization", True))
    add("event_sequence", lambda d: d["turns"][0].__setitem__("event", "OTHER"))
    add("receipt_blocked", lambda d: d["turns"][1]["interaction_receipt"].__setitem__("response_admissible", False))
    add("receipt_authority", lambda d: d["turns"][1]["interaction_receipt"].__setitem__("authority_effect", "GRANT"))
    add("response_authority", lambda d: d["turns"][1]["interaction_receipt"].__setitem__("response_authority_created", True))
    add("assistance_escalation", lambda d: d["turns"][3]["assistance"].__setitem__("selected", "HINT"))
    add("spoiler_escalation", lambda d: d["turns"][5]["assistance"].__setitem__("new_spoiler_level", 3))
    add("initiative_escalation", lambda d: d["turns"][8]["initiative"].__setitem__("selected_depth", "THEORY"))
    add("player_led_initiative", lambda d: d["turns"][10]["initiative"].__setitem__("selected_depth", "NOTICE"))
    add("variety_engagement", lambda d: d["turns"][5]["variety"].__setitem__("objective", "ENGAGEMENT_MAXIMIZATION"))
    add("variety_focus", lambda d: d["turns"][5]["variety"].__setitem__("focus_preserved", False))
    add("humor_player_ability", lambda d: d["turns"][5]["playfulness"].__setitem__("target", "PLAYER_ABILITY"))
    add("humor_hidden_hint", lambda d: d["turns"][1]["playfulness"].__setitem__("hidden_hint", True))
    add("humor_pressure", lambda d: d["turns"][5]["playfulness"].__setitem__("pressure_to_continue", True))
    add("playful_false_certainty", lambda d: d["turns"][1]["playfulness"].__setitem__("epistemic_mode", "KNOWN"))
    add("discovery_hidden_answer", lambda d: d["turns"][3]["discovery"].__setitem__("hidden_answer", True))
    add("discovery_irreversible", lambda d: d["turns"][3]["discovery"].__setitem__("reversible", False))
    add("discovery_costly", lambda d: d["turns"][3]["discovery"].__setitem__("low_cost", False))
    add("discovery_focus", lambda d: d["turns"][3]["discovery"].__setitem__("focus_preserved", False))
    add("invalid_bypass_intent", lambda d: d["turns"][14].__setitem__("player_intent", "CONVERSATION"))
    add("invalid_bypass_ceiling", lambda d: d["turns"][14]["assistance"].__setitem__("ceiling", "HINT"))
    add("memory_inactive", lambda d: d["turns"][5]["memory_reuse"].__setitem__("active", False))
    add("memory_scope", lambda d: d["turns"][10]["memory_reuse"].__setitem__("scope_match", False))
    add("repair_history", lambda d: d["turns"][3]["uncertainty_repair"].__setitem__("history_rewritten", True))
    add("repair_global_truth", lambda d: d["turns"][12]["uncertainty_repair"].__setitem__("player_claim_promoted_global", True))
    add("pause_help_carry", lambda d: d["turns"][6]["pause_resume"].__setitem__("help_authority_carried", True))
    add("resume_intent_carry", lambda d: d["turns"][7]["pause_resume"].__setitem__("intent_carried", True))
    add("resume_old_help", lambda d: d["turns"][8]["pause_resume"].__setitem__("old_help_reused", True))
    add("resume_old_focus", lambda d: d["turns"][8]["pause_resume"].__setitem__("old_focus_forced", True))
    add("hint_overdepth", lambda d: d["turns"][10]["assistance"].__setitem__("selected", "SOLUTION"))
    add("wrong_first_repair_target", lambda d: d["turns"][3]["uncertainty_repair"].__setitem__("target_turn", 3))
    add("wrong_second_repair_state", lambda d: d["turns"][12]["uncertainty_repair"].__setitem__("new_state", "DISPROVED"))
    add("solution_future_authority", lambda d: d["turns"][14]["solution_scope"].__setitem__("future_solution_authority", True))
    add("solution_not_scoped", lambda d: d["turns"][14]["solution_scope"].__setitem__("this_request_only", False))
    add("component_removed", lambda d: d.__setitem__("required_components", d["required_components"][:-1]))
    add("invariant_removed", lambda d: d.__setitem__("invariants", d["invariants"][:-1]))
    return mutations

def main():
    data = json.loads(TRACE.read_text(encoding="utf-8"))
    validate(data)

    accepted = []
    mutations = mutation_cases(data)
    for name, mutated in mutations:
        try:
            validate(mutated)
        except AssertionError:
            continue
        accepted.append(name)

    if accepted:
        print("Unsafe mutations accepted: " + ", ".join(accepted), file=sys.stderr)
        return 1

    print(f"Integrated conversation trace valid: {len(data['turns'])} turns; {len(mutations)} fail-closed mutations rejected.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
