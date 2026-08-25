#!/usr/bin/env python3
import copy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FIXTURE = HERE / "safety-boundary-cases.json"

ORIGIN = "af14ba8154665db069055d9cc8b6f27d7aa51063"
LAYERS = [
    "observational-lane",
    "assistance-gate",
    "shared-discovery-memory",
    "bounded-initiative",
    "focus-diversity",
    "interaction-receipt",
    "pause-resume",
]
NON_EFFECTS = {
    "live_response_generation",
    "proactive_messaging",
    "background_activity",
    "autonomous_gameplay",
    "game_account_control",
    "external_effect",
    "action_permit",
    "successor_permit",
    "response_authority_created",
    "behavioral_profile",
    "psychological_inference",
    "mood_inference",
    "attention_tracking",
    "engagement_maximization",
    "retention_optimization",
    "cross_game_preference_profile",
    "total_history_capture",
    "stable_core_promotion",
}
INVARIANTS = [
    "Advice != Command",
    "Correction by Player != Model Defeat",
]
SOURCE_EVIDENCE = {
    "advice_not_command": [
        "pilots/kontur-game-companion/observational-lane/README.md",
        "pilots/kontur-game-companion/assistance-gate/README.md",
    ],
    "correction_not_model_defeat": [
        "pilots/kontur-game-companion/observational-lane/README.md",
        "pilots/kontur-game-companion/shared-discovery-memory/README.md",
    ],
}
EXPECTED = {
    "optional-advice-remains-ignorable": True,
    "mandatory-command-framing-blocked": False,
    "advice-cannot-create-action-permit": False,
    "player-correction-revises-local-model": True,
    "player-correction-may-remain-contested": True,
    "model-defeat-framing-blocked": False,
    "correction-global-authority-transfer-blocked": False,
    "correction-provenance-erasure-blocked": False,
}


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def index_cases(data):
    return {case["id"]: case for case in data["cases"]}


def expected_boundary(case):
    kind = case.get("kind")
    if kind == "ADVICE":
        return (
            case.get("advice_present") is True
            and case.get("command_semantics") is False
            and case.get("compliance_required") is False
            and case.get("player_can_ignore") is True
            and case.get("external_control") is False
            and case.get("action_permit_created") is False
        )
    if kind == "CORRECTION":
        revised = case.get("local_model_revised") is True
        contested = case.get("correction_contested") is True
        return (
            case.get("player_correction_received") is True
            and revised != contested
            and case.get("model_defeat_declared") is False
            and case.get("global_truth_promoted") is False
            and case.get("player_authority_generalized") is False
            and case.get("historical_hypothesis_erased") is False
        )
    return False


def validate(data, repo_checks=True):
    require(data.get("schema_version") == "0.1", "schema_version must be 0.1")
    require(data.get("pilot_id") == "kontur-game-companion-cross-cutting-safety-boundary", "pilot_id changed")
    require(data.get("origin_frontier") == ORIGIN, "origin frontier changed")
    require(data.get("audit_findings") == ["F-005", "F-007"], "audit findings changed")
    require(data.get("mode") == "SYNTHETIC_CROSS_CUTTING_CONSTRAINT", "mode changed")
    require(data.get("causal_layer") is False, "cross-cutting constraint cannot become causal layer")
    require(data.get("authority_effect") == "NONE", "safety boundary cannot create authority")
    require(data.get("applies_to_layers") == LAYERS, "exact seven-layer scope/order required")

    source = data.get("source_evidence")
    require(source == SOURCE_EVIDENCE, "source evidence set changed")
    if repo_checks:
        for paths in source.values():
            for path in paths:
                require((ROOT / path).is_file(), f"source evidence missing: {path}")

    non_effects = data.get("non_effects")
    require(isinstance(non_effects, dict), "non_effects must be object")
    require(set(non_effects) == NON_EFFECTS, "non-effect field set changed")
    for field in NON_EFFECTS:
        require(non_effects[field] is False, f"non-effect leak: {field}=true")

    require(data.get("invariants") == INVARIANTS, "invariant set/order changed")

    cases = data.get("cases")
    require(isinstance(cases, list) and len(cases) == 8, "exactly eight canonical cases required")
    ids = [case.get("id") for case in cases]
    require(len(ids) == len(set(ids)), "case ids must be unique")
    require(set(ids) == set(EXPECTED), "canonical case set changed")

    for case in cases:
        cid = case["id"]
        require(type(case.get("boundary_satisfied")) is bool, f"{cid}: boundary_satisfied must be boolean")
        if case.get("kind") == "ADVICE":
            fields = {
                "advice_present",
                "command_semantics",
                "compliance_required",
                "player_can_ignore",
                "external_control",
                "action_permit_created",
            }
            for field in fields:
                require(type(case.get(field)) is bool, f"{cid}: {field} must be boolean")
        elif case.get("kind") == "CORRECTION":
            fields = {
                "player_correction_received",
                "local_model_revised",
                "correction_contested",
                "model_defeat_declared",
                "global_truth_promoted",
                "player_authority_generalized",
                "historical_hypothesis_erased",
            }
            for field in fields:
                require(type(case.get(field)) is bool, f"{cid}: {field} must be boolean")
        else:
            raise AssertionError(f"{cid}: invalid kind")

        require(
            case["boundary_satisfied"] is expected_boundary(case),
            f"{cid}: boundary result does not match semantic rule",
        )

    by_id = index_cases(data)
    for cid, expected in EXPECTED.items():
        require(by_id[cid]["boundary_satisfied"] is expected, f"{cid}: canonical outcome changed")

    require(by_id["mandatory-command-framing-blocked"]["command_semantics"] is True, "command case lost command semantics")
    require(by_id["mandatory-command-framing-blocked"]["compliance_required"] is True, "command case lost compliance requirement")
    require(by_id["advice-cannot-create-action-permit"]["action_permit_created"] is True, "permit case must exercise action permit")
    require(by_id["player-correction-revises-local-model"]["local_model_revised"] is True, "revision case must revise local model")
    require(by_id["player-correction-may-remain-contested"]["correction_contested"] is True, "contested case must stay contested")
    require(by_id["model-defeat-framing-blocked"]["model_defeat_declared"] is True, "defeat case must exercise model-defeat framing")
    require(by_id["correction-global-authority-transfer-blocked"]["global_truth_promoted"] is True, "global transfer case must promote truth")
    require(by_id["correction-global-authority-transfer-blocked"]["player_authority_generalized"] is True, "global transfer case must generalize authority")
    require(by_id["correction-provenance-erasure-blocked"]["historical_hypothesis_erased"] is True, "provenance case must exercise erasure")


def mutate_case(case_id, field, value):
    def apply(data):
        index_cases(data)[case_id][field] = value
    return apply


def mutation_suite(base):
    mutations = []

    def add(name, fn, repo=False):
        item = copy.deepcopy(base)
        fn(item)
        mutations.append((name, item, repo))

    add("schema", lambda d: d.__setitem__("schema_version", "0.2"))
    add("frontier", lambda d: d.__setitem__("origin_frontier", "0" * 40))
    add("finding-scope", lambda d: d.__setitem__("audit_findings", ["F-005"]))
    add("mode", lambda d: d.__setitem__("mode", "RUNTIME"))
    add("causal-layer", lambda d: d.__setitem__("causal_layer", True))
    add("authority-effect", lambda d: d.__setitem__("authority_effect", "GRANT"))
    add("missing-layer", lambda d: d["applies_to_layers"].pop())
    add("reordered-layer", lambda d: d["applies_to_layers"].__setitem__(slice(0, 2), list(reversed(d["applies_to_layers"][:2]))))
    add("missing-source", lambda d: d["source_evidence"]["advice_not_command"].pop())
    add("wrong-source-path", lambda d: d["source_evidence"]["advice_not_command"].__setitem__(0, "missing.md"), True)
    add("missing-invariant", lambda d: d["invariants"].pop())
    add("renamed-invariant", lambda d: d["invariants"].__setitem__(0, "Advice equals Command"))
    add("missing-case", lambda d: d["cases"].pop())
    add("duplicate-case", lambda d: d["cases"].__setitem__(1, copy.deepcopy(d["cases"][0])))

    for field in sorted(NON_EFFECTS):
        add(f"non-effect:{field}", lambda d, f=field: d["non_effects"].__setitem__(f, True))

    add("optional-advice-command", mutate_case("optional-advice-remains-ignorable", "command_semantics", True))
    add("optional-advice-compliance", mutate_case("optional-advice-remains-ignorable", "compliance_required", True))
    add("optional-advice-nonignorable", mutate_case("optional-advice-remains-ignorable", "player_can_ignore", False))
    add("optional-advice-control", mutate_case("optional-advice-remains-ignorable", "external_control", True))
    add("optional-advice-permit", mutate_case("optional-advice-remains-ignorable", "action_permit_created", True))
    add("command-allowed", mutate_case("mandatory-command-framing-blocked", "boundary_satisfied", True))
    add("permit-allowed", mutate_case("advice-cannot-create-action-permit", "boundary_satisfied", True))
    add("revision-defeat", mutate_case("player-correction-revises-local-model", "model_defeat_declared", True))
    add("revision-global-truth", mutate_case("player-correction-revises-local-model", "global_truth_promoted", True))
    add("revision-global-authority", mutate_case("player-correction-revises-local-model", "player_authority_generalized", True))
    add("revision-erases-history", mutate_case("player-correction-revises-local-model", "historical_hypothesis_erased", True))
    add("revision-neither-revise-nor-contest", mutate_case("player-correction-revises-local-model", "local_model_revised", False))
    add("contested-also-revised", mutate_case("player-correction-may-remain-contested", "local_model_revised", True))
    add("defeat-allowed", mutate_case("model-defeat-framing-blocked", "boundary_satisfied", True))
    add("authority-transfer-allowed", mutate_case("correction-global-authority-transfer-blocked", "boundary_satisfied", True))
    add("provenance-erasure-allowed", mutate_case("correction-provenance-erasure-blocked", "boundary_satisfied", True))

    for name, mutated, repo_checks in mutations:
        try:
            validate(mutated, repo_checks=repo_checks)
        except AssertionError:
            continue
        raise AssertionError(f"mutation unexpectedly accepted: {name}")

    return len(mutations)


def main():
    try:
        data = json.loads(FIXTURE.read_text(encoding="utf-8"))
        validate(data, repo_checks=True)
        count = mutation_suite(data)
    except (OSError, json.JSONDecodeError, AssertionError) as exc:
        print(f"FAIL: {exc}")
        return 1

    print(
        "OK: Game Companion cross-cutting safety boundary; "
        f"{len(data['non_effects'])} non-effects, {len(data['invariants'])} invariants, "
        f"{len(data['cases'])} cases, {count} fail-closed mutations rejected"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
