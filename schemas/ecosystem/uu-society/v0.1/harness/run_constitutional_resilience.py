#!/usr/bin/env python3
"""Deterministic constitutional resilience experiments for UU Society v0.7.

This layer tests sequences of constitutional amendments rather than individual
institution rules. A locally lawful amendment may still contribute to an
unlawful cumulative concentration of authority.

The rights-floor and constitutional limits are experimental proxies, not a
complete constitutional or human-rights theory.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from run_scenarios import current_commit, digest, format_errors, load_json, validator

ROOT = Path(__file__).resolve().parents[1]
CONFIG_SCHEMA_PATH = ROOT / "constitutional-resilience.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "constitutional-resilience.receipt.schema.json"
EXPERIMENT_DIR = ROOT / "constitutional_resilience"

STATE_KEYS = (
    "authority_scope",
    "review_independence",
    "rights_floor_strength",
    "amendment_friction",
    "transparency",
    "revocability",
)
OUTCOME_KEYS = ("fulfillment", "harm", "exit_share", "access_gini", "outsider_gap")


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def add_delta(values: dict[str, float], delta: dict[str, float], keys: tuple[str, ...]) -> dict[str, float]:
    return {key: clamp(values[key] + delta[key]) for key in keys}


def inverse_delta(delta: dict[str, float], keys: tuple[str, ...]) -> dict[str, float]:
    return {key: -delta[key] for key in keys}


def reference_rights_floor_ok(config: dict[str, Any], outcome: dict[str, float]) -> bool:
    floor = config["rights_floor_proxy"]
    return (
        outcome["fulfillment"] >= floor["min_fulfillment"]
        and outcome["harm"] <= floor["max_harm"]
        and outcome["exit_share"] <= floor["max_exit_share"]
        and outcome["access_gini"] <= floor["max_access_gini"]
        and outcome["outsider_gap"] <= floor["max_outsider_gap"]
    )


def effective_rights_floor_ok(
    config: dict[str, Any],
    state: dict[str, float],
    outcome: dict[str, float],
) -> bool:
    """Legal floor after constitutional weakening.

    A weaker rights_floor_strength makes the operative legal test more
    permissive. The immutable reference floor remains separately observable.
    """
    floor = config["rights_floor_proxy"]
    strength = state["rights_floor_strength"]
    weakness = 1.0 - strength
    return (
        outcome["fulfillment"] >= max(0.0, floor["min_fulfillment"] - 0.20 * weakness)
        and outcome["harm"] <= min(1.0, floor["max_harm"] + 0.20 * weakness)
        and outcome["exit_share"] <= min(1.0, floor["max_exit_share"] + 0.25 * weakness)
        and outcome["access_gini"] <= min(1.0, floor["max_access_gini"] + 0.20 * weakness)
        and outcome["outsider_gap"] <= min(1.0, floor["max_outsider_gap"] + 0.20 * weakness)
    )


def structural_limits_ok(config: dict[str, Any], state: dict[str, float]) -> tuple[bool, list[str]]:
    limits = config["constitutional_limits"]
    failures = []
    if state["authority_scope"] > limits["max_authority_scope"]:
        failures.append("authority_scope")
    if state["review_independence"] < limits["min_review_independence"]:
        failures.append("review_independence")
    if state["rights_floor_strength"] < limits["min_rights_floor_strength"]:
        failures.append("rights_floor_strength")
    if state["amendment_friction"] < limits["min_amendment_friction"]:
        failures.append("amendment_friction")
    if state["transparency"] < limits["min_transparency"]:
        failures.append("transparency")
    if state["revocability"] < limits["min_revocability"]:
        failures.append("revocability")
    return not failures, failures


def locally_bounded(config: dict[str, Any], proposal: dict[str, Any]) -> bool:
    bound = config["constitutional_limits"]["max_local_structural_step"]
    return all(abs(proposal["structural_delta"][key]) <= bound for key in STATE_KEYS)


def power_expanding(proposal: dict[str, Any]) -> bool:
    d = proposal["structural_delta"]
    return (
        d["authority_scope"] > 0
        or d["review_independence"] < 0
        or d["rights_floor_strength"] < 0
        or d["amendment_friction"] < 0
        or d["transparency"] < 0
        or d["revocability"] < 0
    )


def captured_structurally(config: dict[str, Any], state: dict[str, float]) -> bool:
    ok, _ = structural_limits_ok(config, state)
    return not ok


def apply_expiries(
    cycle: int,
    state: dict[str, float],
    outcome: dict[str, float],
    active_sunsets: list[dict[str, Any]],
) -> tuple[dict[str, float], dict[str, float], int]:
    remaining = []
    reversals = 0
    for item in active_sunsets:
        if item["expires_at"] <= cycle:
            state = add_delta(state, inverse_delta(item["structural_delta"], STATE_KEYS), STATE_KEYS)
            outcome = add_delta(outcome, inverse_delta(item["outcome_delta"], OUTCOME_KEYS), OUTCOME_KEYS)
            reversals += 1
        else:
            remaining.append(item)
    active_sunsets[:] = remaining
    return state, outcome, reversals


def proposal_decision(
    config: dict[str, Any],
    state: dict[str, float],
    outcome: dict[str, float],
    proposal: dict[str, Any],
) -> tuple[bool, str, dict[str, float], dict[str, float]]:
    mode = config["mode"]
    candidate_state = add_delta(state, proposal["structural_delta"], STATE_KEYS)
    candidate_outcome = add_delta(outcome, proposal["outcome_delta"], OUTCOME_KEYS)

    if mode == "frozen":
        return False, "frozen", candidate_state, candidate_outcome

    if not locally_bounded(config, proposal):
        return False, "local_step_too_large", candidate_state, candidate_outcome

    if not effective_rights_floor_ok(config, candidate_state, candidate_outcome):
        return False, "operative_rights_floor", candidate_state, candidate_outcome

    if mode in ("local_legality_only", "captured_review"):
        return True, "local_legality", candidate_state, candidate_outcome

    if mode in ("cumulative_guard", "sunset_guard"):
        limits_ok, failed = structural_limits_ok(config, candidate_state)
        if not limits_ok:
            return False, "cumulative_limit:" + ",".join(failed), candidate_state, candidate_outcome

        if proposal["reviewer_conflict"] and candidate_state["review_independence"] < 0.80:
            return False, "conflicted_review", candidate_state, candidate_outcome

        if (
            config["constitutional_limits"]["require_sunset_for_power_expansion"]
            and power_expanding(proposal)
            and proposal["sunset_cycles"] is None
        ):
            return False, "missing_sunset", candidate_state, candidate_outcome

        return True, "cumulative_guard", candidate_state, candidate_outcome

    raise ValueError(f"unknown mode {mode}")


def simulate(config: dict[str, Any], enforce_expected: bool = True) -> tuple[dict[str, Any], list[str]]:
    state = copy.deepcopy(config["initial_state"])
    outcome = copy.deepcopy(config["baseline_outcome"])
    initial_state = copy.deepcopy(state)
    rejection_counts: Counter[str] = Counter()
    active_sunsets: list[dict[str, Any]] = []
    trace = hashlib.sha256()
    cycles = []
    adoption_count = 0
    sunset_reversal_count = 0
    ever_capture = captured_structurally(config, state)
    ever_reference_rights_ok = reference_rights_floor_ok(config, outcome)
    saw_general_capture_path = False
    saw_conflicted_approval = False
    saw_recovery_action = False

    proposals = config["proposals"]

    for cycle in range(config["cycle_count"]):
        state, outcome, reversals = apply_expiries(
            cycle, state, outcome, active_sunsets
        )
        sunset_reversal_count += reversals

        proposal = proposals[cycle] if cycle < len(proposals) else None
        before_state = copy.deepcopy(state)
        before_outcome = copy.deepcopy(outcome)

        if proposal is None:
            cycles.append({
                "cycle":cycle,
                "proposal_id":None,
                "adopted":False,
                "reason":"no_proposal",
                "state_before":before_state,
                "state_after":copy.deepcopy(state),
                "outcome_after":copy.deepcopy(outcome),
                "reference_rights_floor_after":reference_rights_floor_ok(config, outcome),
                "structural_limits_after":structural_limits_ok(config, state)[0],
                "sunset_reversals":reversals,
            })
            continue

        adopted, reason, candidate_state, candidate_outcome = proposal_decision(
            config, state, outcome, proposal
        )

        if adopted:
            state = candidate_state
            outcome = candidate_outcome
            adoption_count += 1

            if proposal["sunset_cycles"] is not None:
                active_sunsets.append({
                    "proposal_id":proposal["proposal_id"],
                    "expires_at":cycle + proposal["sunset_cycles"],
                    "structural_delta":copy.deepcopy(proposal["structural_delta"]),
                    "outcome_delta":copy.deepcopy(proposal["outcome_delta"]),
                })

            if proposal["reviewer_conflict"]:
                saw_conflicted_approval = True

            if (
                proposal["stated_general_purpose"]
                and proposal["beneficiary_alignment"] >= 0.70
                and power_expanding(proposal)
            ):
                saw_general_capture_path = True

            d = proposal["structural_delta"]
            if (
                d["authority_scope"] < 0
                or d["review_independence"] > 0
                or d["rights_floor_strength"] > 0
                or d["amendment_friction"] > 0
                or d["transparency"] > 0
                or d["revocability"] > 0
            ):
                saw_recovery_action = True
        else:
            rejection_counts[reason.split(":")[0]] += 1

        capture_now = captured_structurally(config, state)
        ever_capture |= capture_now
        ever_reference_rights_ok |= reference_rights_floor_ok(config, outcome)

        cycles.append({
            "cycle":cycle,
            "proposal_id":proposal["proposal_id"],
            "adopted":adopted,
            "reason":reason,
            "state_before":before_state,
            "state_after":copy.deepcopy(state),
            "outcome_after":copy.deepcopy(outcome),
            "reference_rights_floor_after":reference_rights_floor_ok(config, outcome),
            "structural_limits_after":not capture_now,
            "sunset_reversals":reversals,
        })

        trace.update(
            (
                f"{cycle}|proposal={proposal['proposal_id']}|adopted={int(adopted)}|"
                f"reason={reason}|state={json.dumps(state,sort_keys=True)}|"
                f"outcome={json.dumps(outcome,sort_keys=True)}|reversals={reversals}\n"
            ).encode()
        )

    # Expire anything due exactly at the horizon.
    state, outcome, reversals = apply_expiries(
        config["cycle_count"], state, outcome, active_sunsets
    )
    sunset_reversal_count += reversals

    limits = config["constitutional_limits"]
    patterns = set()
    if adoption_count == 0:
        patterns.add("STABLE_CONSTITUTION")
    else:
        patterns.add("CONSTITUTIONAL_ADAPTATION")

    final_capture = captured_structurally(config, state)
    if ever_capture and config["mode"] in ("local_legality_only", "captured_review"):
        patterns.add("LEGITIMATE_STEPS_ACCUMULATE_CAPTURE")
    if state["review_independence"] < limits["min_review_independence"]:
        patterns.add("REVIEW_INDEPENDENCE_ERODED")
    if state["rights_floor_strength"] < limits["min_rights_floor_strength"]:
        patterns.add("RIGHTS_FLOOR_WEAKENED")
    if state["amendment_friction"] < limits["min_amendment_friction"]:
        patterns.add("AMENDMENT_RATCHET")
    if state["revocability"] < limits["min_revocability"]:
        patterns.add("REVOCABILITY_ERODED")
    if saw_conflicted_approval:
        patterns.add("CONFLICTED_REVIEW_APPROVAL")
    if (
        rejection_counts["cumulative_limit"] > 0
        or rejection_counts["conflicted_review"] > 0
        or rejection_counts["missing_sunset"] > 0
    ):
        patterns.add("CUMULATIVE_GUARD_BLOCKED_AMENDMENT")
    if sunset_reversal_count > 0:
        patterns.add("SUNSET_REVERSED_POWER")
    if final_capture and reference_rights_floor_ok(config, outcome):
        patterns.add("CAPTURE_WITHOUT_RIGHTS_FLOOR_BREACH")
    if saw_general_capture_path:
        patterns.add("GENERAL_PURPOSE_CAPTURE_PATH")
    initial_capture = captured_structurally(config, initial_state)
    if initial_capture and saw_recovery_action and not final_capture:
        patterns.add("CONSTITUTIONAL_RECOVERY")

    actual_result = "EXPECTED_DETECTION" if patterns else "PASS"
    errors = []
    if enforce_expected:
        expected = set(config["expected"]["expected_pattern_ids"])
        if actual_result != config["expected"]["result"]:
            errors.append(
                f"result expected={config['expected']['result']} actual={actual_result}"
            )
        if patterns != expected:
            errors.append(
                f"patterns expected={sorted(expected)} actual={sorted(patterns)}"
            )

    receipt = {
        "receipt_version":"0.7",
        "experiment_id":config["experiment_id"],
        "experiment_version":"0.7",
        "model_commit_sha":current_commit(),
        "seed":config["seed"],
        "mode":config["mode"],
        "result":actual_result if not errors else "FAIL",
        "pattern_ids":sorted(patterns),
        "final_state":state,
        "final_outcome":outcome,
        "cycle_summaries":cycles,
        "adoption_count":adoption_count,
        "rejection_counts":dict(sorted(rejection_counts.items())),
        "sunset_reversal_count":sunset_reversal_count,
        "trace_digest":trace.hexdigest(),
        "config_digest":digest(config),
    }
    return receipt, errors


def run_config(path: Path) -> tuple[dict[str, Any], list[str]]:
    config = load_json(path)
    config_errors = format_errors(
        validator(load_json(CONFIG_SCHEMA_PATH)).iter_errors(config)
    )
    if config_errors:
        return {}, [f"config schema: {e}" for e in config_errors]
    receipt, errors = simulate(config)
    receipt_errors = format_errors(
        validator(load_json(RECEIPT_SCHEMA_PATH)).iter_errors(receipt)
    )
    return receipt, [*errors, *[f"receipt schema: {e}" for e in receipt_errors]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--experiment", action="append")
    args = parser.parse_args()

    paths = sorted(EXPERIMENT_DIR.glob("C*/config.json"))
    if args.experiment:
        wanted = set(args.experiment)
        paths = [p for p in paths if load_json(p)["experiment_id"] in wanted]

    if not paths:
        print("no constitutional resilience experiments found", file=sys.stderr)
        return 2

    failures = []
    receipts = []
    for path in paths:
        receipt, errors = run_config(path)
        eid = load_json(path)["experiment_id"]
        if errors:
            print(f"{eid}: FAIL")
            if receipt:
                print("  final_state:", json.dumps(receipt["final_state"], sort_keys=True))
                print("  final_outcome:", json.dumps(receipt["final_outcome"], sort_keys=True))
                print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
                print("  adoptions:", receipt["adoption_count"])
                print("  rejections:", json.dumps(receipt["rejection_counts"], sort_keys=True))
                print("  sunset_reversals:", receipt["sunset_reversal_count"])
            for error in errors:
                print(f"  - {error}")
            failures.extend(f"{eid}: {e}" for e in errors)
        else:
            print(f"{eid}: {receipt['result']}")
            print("  final_state:", json.dumps(receipt["final_state"], sort_keys=True))
            print("  final_outcome:", json.dumps(receipt["final_outcome"], sort_keys=True))
            print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
            print("  adoptions:", receipt["adoption_count"])
            print("  rejections:", json.dumps(receipt["rejection_counts"], sort_keys=True))
            print("  sunset_reversals:", receipt["sunset_reversal_count"])
            print("  trace_digest:", receipt["trace_digest"])
            receipts.append(receipt)

    print(
        f"\nUU Society constitutional resilience v0.7: "
        f"{len(receipts)}/{len(paths)} experiments conform"
    )
    if failures:
        print(f"unexpected failures: {len(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
