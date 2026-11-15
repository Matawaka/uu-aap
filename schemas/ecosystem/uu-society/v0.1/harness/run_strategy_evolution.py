#!/usr/bin/env python3
"""Deterministic endogenous strategy evolution for UU Society v0.5.

No actor is pre-labelled adversarial or extractive. Actors learn utilities for
five strategies from their own synthetic outcomes and switch at epoch
boundaries with bounded exploration.

Strategies are behavioral policies, not moral identities.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from run_population_simulations import gini, pick_index, u64, unit
from run_scenarios import current_commit, digest, format_errors, load_json, validator

ROOT = Path(__file__).resolve().parents[1]
CONFIG_SCHEMA_PATH = ROOT / "strategy-evolution.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "strategy-evolution.receipt.schema.json"
EXPERIMENT_DIR = ROOT / "strategy_evolution"

STRATEGIES = ("COOPERATE", "EXTRACT", "REPAIR", "EXIT", "COALITION")


@dataclass
class Actor:
    actor_id: int
    strategy: str
    capability: dict[str, bool] = field(default_factory=dict)
    base_willingness: dict[str, float] = field(default_factory=dict)
    values: dict[str, float] = field(default_factory=dict)
    epoch_reward: float = 0.0
    epoch_exposures: int = 0
    total_reward: float = 0.0
    requested: int = 0
    received: int = 0
    provided: int = 0
    harmed: int = 0
    repaired: int = 0
    unmet: int = 0


def normalized_entropy(counts: dict[str, int]) -> float:
    total = sum(counts.values())
    if total <= 0:
        return 0.0
    h = 0.0
    for value in counts.values():
        if value <= 0:
            continue
        p = value / total
        h -= p * math.log(p)
    return h / math.log(len(STRATEGIES))


def build_population(config: dict[str, Any]) -> list[Actor]:
    seed = config["seed"]
    initial_value = config["learning"]["initial_strategy_value"]
    actors: list[Actor] = []
    for actor_id in range(config["actor_count"]):
        # Equal starting values; deterministic tie-break produces heterogeneous
        # initial strategies without assigning moral actor classes.
        initial = STRATEGIES[pick_index(seed, len(STRATEGIES), "initial-strategy", actor_id)]
        actor = Actor(
            actor_id=actor_id,
            strategy=initial,
            values={s: initial_value for s in STRATEGIES},
        )
        for category in config["categories"]:
            actor.capability[category] = (
                unit(seed, "strategy-capability", actor_id, category)
                < config["population"]["base_capability_probability"]
            )
            variation = (
                unit(seed, "strategy-willingness", actor_id, category) - 0.5
            ) * 0.2
            actor.base_willingness[category] = max(
                0.0,
                min(
                    1.0,
                    config["population"]["base_willingness_probability"] + variation,
                ),
            )
        actors.append(actor)
    return actors


def choose_requester(config: dict[str, Any], actors: list[Actor], step: int) -> Actor | None:
    weights = []
    for actor in actors:
        activity = config["strategy_parameters"][actor.strategy]["request_activity"]
        weights.append(max(0.0, activity))
    total = sum(weights)
    if total <= 0:
        return None
    target = unit(config["seed"], "strategy-requester", step) * total
    cursor = 0.0
    for actor, weight in zip(actors, weights):
        cursor += weight
        if target <= cursor:
            return actor
    return actors[-1]


def candidate_pool(
    config: dict[str, Any],
    actors: list[Actor],
    requester: Actor,
    category: str,
    step: int,
) -> list[Actor]:
    size = min(12, len(actors) - 1)
    seen = {requester.actor_id}
    pool: list[Actor] = []
    cursor = 0
    while len(pool) < size and cursor < len(actors) * 4:
        idx = pick_index(
            config["seed"], len(actors), "strategy-candidate", step, category, cursor
        )
        cursor += 1
        if idx in seen:
            continue
        seen.add(idx)
        pool.append(actors[idx])
    return pool


def choose_provider(
    config: dict[str, Any],
    actors: list[Actor],
    requester: Actor,
    category: str,
    step: int,
) -> Actor | None:
    candidates = [
        actor
        for actor in candidate_pool(config, actors, requester, category, step)
        if actor.capability[category]
    ]
    if not candidates:
        return None

    scored = []
    requester_coalition = requester.strategy == "COALITION"
    for provider in candidates:
        params = config["strategy_parameters"][provider.strategy]
        willingness = (
            provider.base_willingness[category]
            * params["provider_willingness_multiplier"]
        )
        if provider.strategy == "EXIT":
            willingness *= 0.20
        if requester_coalition and provider.strategy == "COALITION":
            willingness *= 1.35
        elif requester_coalition:
            willingness *= 0.75

        if (
            unit(
                config["seed"],
                "strategy-provider-willing",
                step,
                requester.actor_id,
                provider.actor_id,
                category,
            )
            > min(1.0, willingness)
        ):
            continue

        coalition_match = 1.0 if requester_coalition and provider.strategy == "COALITION" else 0.0
        score = (
            coalition_match
            + willingness
            + unit(
                config["seed"],
                "strategy-provider-tie",
                step,
                provider.actor_id,
                requester.actor_id,
            )
            * 1e-6
        )
        scored.append((score, provider))

    if not scored:
        return None
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1]


def reward(actor: Actor, value: float) -> None:
    actor.epoch_reward += value
    actor.total_reward += value
    actor.epoch_exposures += 1


def update_strategy_values_and_switch(
    config: dict[str, Any],
    actors: list[Actor],
    epoch_index: int,
    transitions: Counter[str],
) -> None:
    learn = config["learning"]
    economics = config["economics"]
    for actor in actors:
        observed = (
            actor.epoch_reward / actor.epoch_exposures
            if actor.epoch_exposures
            else 0.0
        )
        current = actor.strategy
        actor.values[current] = (
            (1.0 - learn["learning_rate"]) * actor.values[current]
            + learn["learning_rate"] * observed
        )

        # Exit has a small safety value when recent experienced utility is
        # negative; this lets withdrawal emerge rather than being assigned.
        if observed < 0:
            actor.values["EXIT"] = max(
                actor.values["EXIT"],
                economics["exit_safety_reward"],
            )

        explore = (
            unit(config["seed"], "strategy-explore", epoch_index, actor.actor_id)
            < learn["exploration_rate"]
        )
        if explore:
            candidate = STRATEGIES[
                pick_index(
                    config["seed"],
                    len(STRATEGIES),
                    "strategy-explore-pick",
                    epoch_index,
                    actor.actor_id,
                )
            ]
        else:
            def score(strategy: str) -> tuple[float, int]:
                switching = (
                    learn["switching_cost"] if strategy != current else 0.0
                )
                return (
                    actor.values[strategy] - switching,
                    -int(
                        u64(
                            config["seed"],
                            "strategy-switch-tie",
                            epoch_index,
                            actor.actor_id,
                            strategy,
                        )
                    ),
                )
            candidate = max(STRATEGIES, key=score)

        if candidate != current:
            transitions[f"{current}->{candidate}"] += 1
            actor.strategy = candidate

        actor.epoch_reward = 0.0
        actor.epoch_exposures = 0


def strategy_shares(actors: list[Actor]) -> dict[str, float]:
    counts = Counter(actor.strategy for actor in actors)
    return {strategy: counts[strategy] / len(actors) for strategy in STRATEGIES}


def simulate(
    config: dict[str, Any],
    enforce_expected: bool = True,
) -> tuple[dict[str, Any], list[str]]:
    actors = build_population(config)
    econ = config["economics"]
    transitions: Counter[str] = Counter()
    trace = hashlib.sha256()

    epoch_size = config["interaction_count"] // config["epoch_count"]
    epoch_stats = {
        "attempts":0,
        "fulfilled":0,
        "harms":0,
        "breaches":0,
        "repairs":0,
        "coalition_internal":0,
        "coalition_requests":0,
        "coalition_fulfilled":0,
        "outsider_requests":0,
        "outsider_fulfilled":0,
    }
    epoch_summaries: list[dict[str, Any]] = []
    dominant_history: list[str] = []

    def close_epoch(epoch_index: int) -> None:
        attempts = max(1, epoch_stats["attempts"])
        shares = strategy_shares(actors)
        dominant = max(STRATEGIES, key=lambda s: (shares[s], s))
        dominant_history.append(dominant)
        coalition_rate = (
            epoch_stats["coalition_fulfilled"]
            / max(1, epoch_stats["coalition_requests"])
        )
        outsider_rate = (
            epoch_stats["outsider_fulfilled"]
            / max(1, epoch_stats["outsider_requests"])
        )
        epoch_summaries.append({
            "epoch":epoch_index,
            "strategy_shares":shares,
            "dominant_strategy":dominant,
            "strategy_entropy":normalized_entropy(
                {s: round(shares[s] * len(actors)) for s in STRATEGIES}
            ),
            "fulfilled_rate":epoch_stats["fulfilled"] / attempts,
            "harm_rate":epoch_stats["harms"] / max(1, epoch_stats["fulfilled"]),
            "repair_rate":epoch_stats["repairs"] / max(
                1, epoch_stats["harms"] + epoch_stats["breaches"]
            ),
            "coalition_internal_share":epoch_stats["coalition_internal"] / max(
                1, epoch_stats["fulfilled"]
            ),
            "coalition_fulfillment_rate":coalition_rate,
            "outsider_fulfillment_rate":outsider_rate,
            "coalition_outsider_gap":max(0.0, coalition_rate - outsider_rate),
        })
        update_strategy_values_and_switch(
            config, actors, epoch_index, transitions
        )
        for key in epoch_stats:
            epoch_stats[key] = 0

    for step in range(config["interaction_count"]):
        if (
            step > 0
            and step % epoch_size == 0
            and len(epoch_summaries) < config["epoch_count"] - 1
        ):
            close_epoch(len(epoch_summaries))

        epoch_stats["attempts"] += 1
        requester = choose_requester(config, actors, step)
        if requester is None:
            trace.update(f"{step}|no-requester\n".encode())
            continue

        requester.requested += 1
        coalition_request = requester.strategy == "COALITION"
        if coalition_request:
            epoch_stats["coalition_requests"] += 1
        else:
            epoch_stats["outsider_requests"] += 1

        category = config["categories"][
            pick_index(config["seed"], len(config["categories"]), "strategy-category", step)
        ]
        provider = choose_provider(config, actors, requester, category, step)
        if provider is None:
            requester.unmet += 1
            reward(requester, -econ["unmet_cost"])
            trace.update(
                f"{step}|unmet|req={requester.actor_id}|strategy={requester.strategy}|cat={category}\n".encode()
            )
            continue

        epoch_stats["fulfilled"] += 1
        requester.received += 1
        provider.provided += 1
        reward(requester, econ["request_benefit"])
        reward(provider, -econ["provider_cost"])

        if requester.strategy == "EXTRACT":
            reward(requester, econ["extract_bonus"])
        if provider.strategy == "COOPERATE":
            reward(provider, econ["cooperation_reward"])

        internal_coalition = (
            requester.strategy == "COALITION"
            and provider.strategy == "COALITION"
        )
        if internal_coalition:
            epoch_stats["coalition_internal"] += 1
            reward(requester, econ["coalition_internal_bonus"])
            reward(provider, econ["coalition_internal_bonus"])
        if coalition_request:
            epoch_stats["coalition_fulfilled"] += 1
        else:
            epoch_stats["outsider_fulfilled"] += 1

        params = config["strategy_parameters"][provider.strategy]
        harm = (
            unit(
                config["seed"],
                "strategy-harm",
                step,
                provider.actor_id,
                requester.actor_id,
            )
            < params["harm_rate"]
        )
        breach = (
            unit(
                config["seed"],
                "strategy-breach",
                step,
                provider.actor_id,
                requester.actor_id,
            )
            < params["breach_rate"]
        )

        repaired = False
        if harm:
            epoch_stats["harms"] += 1
            requester.harmed += 1
            reward(requester, -econ["harm_cost"])
        if breach:
            epoch_stats["breaches"] += 1
            reward(requester, -econ["breach_victim_cost"])
            if provider.strategy == "EXTRACT":
                reward(provider, econ["extract_bonus"] * 0.5)

        if harm or breach:
            if (
                unit(
                    config["seed"],
                    "strategy-repair",
                    step,
                    provider.actor_id,
                    requester.actor_id,
                )
                < params["repair_probability"]
            ):
                repaired = True
                epoch_stats["repairs"] += 1
                provider.repaired += 1
                reward(provider, -econ["repair_cost"] + econ["repair_reward"])
                reward(requester, econ["repair_reward"] * 0.5)

        # Coalition maintenance is paid by coalition actors whenever they take
        # part in an interaction, allowing coalitions to dissolve when benefits
        # no longer exceed coordination costs.
        if requester.strategy == "COALITION":
            reward(requester, -econ["coalition_maintenance_cost"])
        if provider.strategy == "COALITION":
            reward(provider, -econ["coalition_maintenance_cost"])

        trace.update(
            (
                f"{step}|ok|req={requester.actor_id}:{requester.strategy}|"
                f"prov={provider.actor_id}:{provider.strategy}|cat={category}|"
                f"harm={int(harm)}|breach={int(breach)}|repair={int(repaired)}\n"
            ).encode()
        )

    close_epoch(len(epoch_summaries))

    first = epoch_summaries[0]
    tail = epoch_summaries[-1]
    tail_shares = tail["strategy_shares"]

    dominant_switches = sum(
        1 for a, b in zip(dominant_history, dominant_history[1:]) if a != b
    )
    coalition_outsider_gap = max(
        epoch["coalition_outsider_gap"] for epoch in epoch_summaries
    )
    fulfillment_drop = max(
        0.0, first["fulfilled_rate"] - tail["fulfilled_rate"]
    )

    metrics = {
        "tail_strategy_shares":tail_shares,
        "tail_strategy_entropy":tail["strategy_entropy"],
        "first_fulfilled_rate":first["fulfilled_rate"],
        "tail_fulfilled_rate":tail["fulfilled_rate"],
        "fulfillment_drop":fulfillment_drop,
        "first_harm_rate":first["harm_rate"],
        "tail_harm_rate":tail["harm_rate"],
        "dominant_switch_count":dominant_switches,
        "max_coalition_outsider_gap":coalition_outsider_gap,
        "access_gini":gini([a.received for a in actors]),
        "provision_gini":gini([a.provided for a in actors]),
        "mean_total_reward":sum(a.total_reward for a in actors) / len(actors),
        "min_total_reward":min(a.total_reward for a in actors),
        "max_total_reward":max(a.total_reward for a in actors),
    }

    th = config["diagnostic_thresholds"]
    patterns = set()
    if tail_shares["COOPERATE"] >= th["attractor_share_min"]:
        patterns.add("COOPERATION_ATTRACTOR")
    if tail_shares["EXTRACT"] >= th["attractor_share_min"]:
        patterns.add("EXTRACTION_ATTRACTOR")
    if tail_shares["REPAIR"] >= th["attractor_share_min"]:
        patterns.add("REPAIR_ATTRACTOR")
    if (
        tail_shares["EXIT"] >= th["exit_share_max"]
        and fulfillment_drop >= th["fulfillment_drop_max"]
    ):
        patterns.add("EXIT_CASCADE")
    if tail_shares["COALITION"] >= th["attractor_share_min"]:
        patterns.add("COALITION_ATTRACTOR")
    if coalition_outsider_gap >= th["coalition_outsider_gap_max"]:
        patterns.add("COALITION_OUTSIDER_EXCLUSION")
    if dominant_switches >= th["dominant_switch_count_min"]:
        patterns.add("CYCLIC_STRATEGY_DYNAMICS")
    if tail["strategy_entropy"] >= th["diversity_entropy_min"]:
        patterns.add("STRATEGY_DIVERSITY_PERSISTS")

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
        "receipt_version":"0.5",
        "experiment_id":config["experiment_id"],
        "experiment_version":"0.5",
        "model_commit_sha":current_commit(),
        "seed":config["seed"],
        "actor_count":config["actor_count"],
        "interaction_count":config["interaction_count"],
        "epoch_count":config["epoch_count"],
        "result":actual_result if not errors else "FAIL",
        "pattern_ids":sorted(patterns),
        "metrics":metrics,
        "epoch_summaries":epoch_summaries,
        "strategy_transition_counts":dict(sorted(transitions.items())),
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
    parser.add_argument("--write-receipts", action="store_true")
    args = parser.parse_args()

    paths = sorted(EXPERIMENT_DIR.glob("E*/config.json"))
    if args.experiment:
        wanted = set(args.experiment)
        paths = [p for p in paths if load_json(p)["experiment_id"] in wanted]
    if not paths:
        print("no strategy evolution experiments found", file=sys.stderr)
        return 2

    failures = []
    receipts = []
    for path in paths:
        receipt, errors = run_config(path)
        experiment_id = load_json(path)["experiment_id"]
        if errors:
            print(f"{experiment_id}: FAIL")
            if receipt:
                print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
                print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
                print("  transitions:", json.dumps(receipt["strategy_transition_counts"], sort_keys=True))
            for error in errors:
                print(f"  - {error}")
            failures.extend(f"{experiment_id}: {e}" for e in errors)
        else:
            print(f"{experiment_id}: {receipt['result']}")
            print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
            print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
            print("  transitions:", json.dumps(receipt["strategy_transition_counts"], sort_keys=True))
            print("  trace_digest:", receipt["trace_digest"])
            receipts.append(receipt)

    if args.write_receipts and receipts:
        out = ROOT / "harness" / ".artifacts" / "strategy-evolution"
        out.mkdir(parents=True, exist_ok=True)
        for receipt in receipts:
            (out / f"{receipt['experiment_id']}.receipt.json").write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(
        f"\nUU Society endogenous strategy evolution v0.5: "
        f"{len(receipts)}/{len(paths)} experiments conform"
    )
    if failures:
        print(f"unexpected failures: {len(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
