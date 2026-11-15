#!/usr/bin/env python3
"""Deterministic population simulation for UU Society v0.1.

The simulator deliberately emits multiple independent diagnostics rather than
a universal society score or person score. It is a laboratory model, not a
runtime governance engine.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from run_scenarios import current_commit, digest, file_digest, load_json, validator, format_errors

ROOT = Path(__file__).resolve().parents[1]
CONFIG_SCHEMA_PATH = ROOT / "population-simulation.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "population-simulation.receipt.schema.json"
MANIFEST_PATH = ROOT / "uu-society-model.manifest.json"
SIM_DIR = ROOT / "population_simulations"


def u64(seed: str, *parts: Any) -> int:
    payload = "|".join([seed, *[str(x) for x in parts]]).encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")


def unit(seed: str, *parts: Any) -> float:
    return u64(seed, *parts) / float(2**64)


def pick_index(seed: str, size: int, *parts: Any) -> int:
    if size <= 0:
        raise ValueError("cannot pick from empty sequence")
    return u64(seed, *parts) % size


def gini(values: list[int]) -> float:
    if not values or sum(values) == 0:
        return 0.0
    ordered = sorted(values)
    n = len(ordered)
    total = sum(ordered)
    weighted = sum((i + 1) * value for i, value in enumerate(ordered))
    return (2 * weighted) / (n * total) - (n + 1) / n


@dataclass
class Actor:
    actor_id: int
    adversarial: bool = False
    coalition: bool = False
    capability: dict[str, bool] = field(default_factory=dict)
    willingness: dict[str, float] = field(default_factory=dict)
    context_success: dict[str, int] = field(default_factory=dict)
    provided: int = 0
    received: int = 0
    fulfilled_needs: int = 0
    harms: int = 0
    repairs: int = 0
    restrictions: int = 0
    restriction_remaining: int = 0
    renewal_count: int = 0


def build_population(config: dict[str, Any]) -> list[Actor]:
    seed = config["seed"]
    n = config["actor_count"]
    cats = config["categories"]
    pop = config["population"]
    actors = [Actor(actor_id=i) for i in range(n)]

    ranked_adv = sorted(range(n), key=lambda i: u64(seed, "adv-rank", i))
    adv_count = round(n * pop["adversarial_fraction"])
    adversarial = set(ranked_adv[:adv_count])

    ranked_coalition = sorted(adversarial, key=lambda i: u64(seed, "coal-rank", i))
    coalition_count = min(len(adversarial), round(n * pop["coalition_fraction"]))
    coalition = set(ranked_coalition[:coalition_count])

    for actor in actors:
        actor.adversarial = actor.actor_id in adversarial
        actor.coalition = actor.actor_id in coalition
        for category in cats:
            actor.capability[category] = (
                unit(seed, "capability", actor.actor_id, category)
                < pop["base_capability_probability"]
            )
            base = pop["base_willingness_probability"]
            variation = (unit(seed, "willingness", actor.actor_id, category) - 0.5) * 0.2
            actor.willingness[category] = max(0.0, min(1.0, base + variation))
            actor.context_success[category] = 0
    return actors


def choose_requester(config: dict[str, Any], actors: list[Actor], step: int) -> Actor:
    seed = config["seed"]
    coalition = [a for a in actors if a.coalition]
    bias = config["matching"]["coalition_request_bias"]
    if coalition and unit(seed, "coalition-request", step) < bias:
        return coalition[pick_index(seed, len(coalition), "coalition-requester", step)]
    return actors[pick_index(seed, len(actors), "requester", step)]


def candidate_pool(
    config: dict[str, Any], actors: list[Actor], requester: Actor, category: str, step: int
) -> list[Actor]:
    seed = config["seed"]
    pool_size = min(config["matching"]["candidate_pool_size"], len(actors) - 1)
    candidates = []
    seen = {requester.actor_id}
    cursor = 0
    while len(candidates) < pool_size and cursor < len(actors) * 3:
        idx = pick_index(seed, len(actors), "candidate", step, category, cursor)
        cursor += 1
        if idx in seen:
            continue
        seen.add(idx)
        candidates.append(actors[idx])
    return candidates


def choose_provider(
    config: dict[str, Any], candidates: list[Actor], category: str, step: int
) -> tuple[Actor | None, bool]:
    seed = config["seed"]
    capable = [a for a in candidates if a.capability[category]]
    if not capable:
        return None, False

    available = [
        a for a in capable
        if a.restriction_remaining <= 0
        and unit(seed, "willing", step, a.actor_id, category) < a.willingness[category]
    ]
    if not available:
        return None, True

    policy = config["matching"]["policy"]
    if policy == "uniform_capable":
        return available[pick_index(seed, len(available), "provider", step, category)], True

    if policy == "winner_reinforcing_context":
        # Deterministic positive-feedback stressor: prefer the currently most
        # evidenced provider in the same context. Ties are broken by a stable
        # hash so the result remains fully reproducible.
        ranked = sorted(
            available,
            key=lambda a: (
                -a.context_success[category],
                u64(seed, "winner-tie", step, category, a.actor_id),
            ),
        )
        return ranked[0], True

    strength = config["matching"]["feedback_strength"]
    weights = [
        1.0 + strength * math.log1p(a.context_success[category])
        for a in available
    ]
    total = sum(weights)
    target = unit(seed, "weighted-provider", step, category) * total
    cursor = 0.0
    for actor, weight in zip(available, weights):
        cursor += weight
        if target <= cursor:
            return actor, True
    return available[-1], True


def tick_restrictions(actors: list[Actor]) -> int:
    restricted = 0
    for actor in actors:
        if actor.restriction_remaining > 0:
            restricted += 1
            actor.restriction_remaining -= 1
    return restricted


def simulate(config: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    seed = config["seed"]
    actors = build_population(config)
    categories = config["categories"]
    dyn = config["dynamics"]

    successful_actions = 0
    unmet = 0
    idle_capability = 0
    harm_events = 0
    repair_events = 0
    restriction_events = 0
    repair_opportunities = 0
    recovery_events = 0
    restriction_actor_ticks = 0
    trace = hashlib.sha256()

    for step in range(config["interaction_count"]):
        restriction_actor_ticks += tick_restrictions(actors)
        requester = choose_requester(config, actors, step)
        category = categories[pick_index(seed, len(categories), "category", step)]
        candidates = candidate_pool(config, actors, requester, category, step)
        provider, had_capability = choose_provider(config, candidates, category, step)

        if provider is None:
            unmet += 1
            if had_capability:
                idle_capability += 1
            trace.update(f"{step}|unmet|{requester.actor_id}|{category}\n".encode())
            continue

        successful_actions += 1
        requester.received += 1
        requester.fulfilled_needs += 1
        provider.provided += 1
        provider.context_success[category] += 1

        harm_rate = (
            dyn["adversarial_harm_rate"] if provider.adversarial
            else dyn["accidental_harm_rate"]
        )
        breach_rate = (
            dyn["adversarial_breach_rate"] if provider.adversarial
            else dyn["ordinary_breach_rate"]
        )
        harm = unit(seed, "harm", step, provider.actor_id, requester.actor_id) < harm_rate
        breach = unit(seed, "breach", step, provider.actor_id, requester.actor_id) < breach_rate

        repaired = False
        if harm or breach:
            repair_opportunities += 1
            if harm:
                harm_events += 1
                provider.harms += 1

            provider.restrictions += 1
            provider.renewal_count += 1
            restriction_events += 1
            duration = dyn["restriction_duration_interactions"]
            if provider.renewal_count > dyn["restriction_renewal_limit"]:
                duration *= 2
            provider.restriction_remaining = max(provider.restriction_remaining, duration)

            repair_probability = (
                dyn["repair_probability_adversarial"] if provider.adversarial
                else dyn["repair_probability_cooperative"]
            )
            if unit(seed, "repair", step, provider.actor_id) < repair_probability:
                repaired = True
                repair_events += 1
                provider.repairs += 1
                if provider.restriction_remaining > 0:
                    provider.restriction_remaining = max(
                        0, provider.restriction_remaining // 4
                    )
                    recovery_events += 1

        trace.update(
            (
                f"{step}|ok|req={requester.actor_id}|prov={provider.actor_id}|"
                f"cat={category}|harm={int(harm)}|breach={int(breach)}|"
                f"repair={int(repaired)}\n"
            ).encode()
        )

    interactions = config["interaction_count"]
    top_count = max(1, math.ceil(len(actors) * 0.10))
    provided = sorted((a.provided for a in actors), reverse=True)
    total_provided = sum(provided)
    authority_top10_share = (
        sum(provided[:top_count]) / total_provided if total_provided else 0.0
    )

    access_values = [a.fulfilled_needs for a in actors]
    coalition = [a for a in actors if a.coalition]
    coalition_received = sum(a.received for a in coalition)
    coalition_provided = sum(a.provided for a in coalition)
    coalition_ratio = None
    if coalition:
        coalition_ratio = coalition_received / max(1, coalition_provided)

    metrics = {
        "fulfilled_need_rate": successful_actions / interactions,
        "unmet_need_rate": unmet / interactions,
        "idle_capability_rate": idle_capability / interactions,
        "harm_rate": harm_events / max(1, successful_actions),
        "repair_completion_rate": repair_events / max(1, repair_opportunities),
        "recovery_rate": recovery_events / max(1, restriction_events),
        "restriction_actor_time_share": (
            restriction_actor_ticks / (interactions * len(actors))
        ),
        "authority_top10_share": authority_top10_share,
        "access_gini": gini(access_values),
        "coalition_extraction_ratio": coalition_ratio,
        "successful_actions": successful_actions,
        "harm_events": harm_events,
        "repair_events": repair_events,
        "restriction_events": restriction_events,
    }

    thresholds = config["diagnostic_thresholds"]
    signals = set()
    if metrics["authority_top10_share"] > thresholds["authority_top10_share_max"]:
        signals.add("AUTHORITY_CONCENTRATION")
    if metrics["access_gini"] > thresholds["access_gini_max"]:
        signals.add("ACCESS_INEQUALITY")
    if (
        metrics["restriction_actor_time_share"]
        > thresholds["restriction_actor_time_share_max"]
    ):
        signals.add("RESTRICTION_INERTIA")
    if metrics["harm_rate"] > thresholds["harm_rate_max"]:
        signals.add("HARM_PRESSURE")
    if metrics["unmet_need_rate"] > thresholds["unmet_need_rate_max"]:
        signals.add("UNMET_NEED_PRESSURE")
    if metrics["idle_capability_rate"] > thresholds["idle_capability_rate_max"]:
        signals.add("IDLE_CAPABILITY_STRANDING")
    if (
        coalition_ratio is not None
        and coalition_ratio > thresholds["coalition_extraction_ratio_max"]
    ):
        signals.add("COALITION_EXTRACTION")

    actual_result = "EXPECTED_DETECTION" if signals else "PASS"
    expected_signals = set(config["expected"]["expected_signal_ids"])
    errors = []
    if actual_result != config["expected"]["result"]:
        errors.append(
            f"result expected={config['expected']['result']} actual={actual_result}"
        )
    if signals != expected_signals:
        errors.append(
            f"signals expected={sorted(expected_signals)} actual={sorted(signals)}"
        )

    receipt = {
        "receipt_version":"0.1",
        "simulation_id":config["simulation_id"],
        "simulation_version":config["simulation_version"],
        "model_commit_sha":current_commit(),
        "seed":config["seed"],
        "actor_count":config["actor_count"],
        "interaction_count":config["interaction_count"],
        "result":actual_result if not errors else "FAIL",
        "signal_ids":sorted(signals),
        "metrics":metrics,
        "trace_digest":trace.hexdigest(),
        "config_digest":digest(config),
        "model_manifest_digest":file_digest(MANIFEST_PATH),
    }
    return receipt, errors


def run_config(path: Path) -> tuple[dict[str, Any], list[str]]:
    config_schema = load_json(CONFIG_SCHEMA_PATH)
    receipt_schema = load_json(RECEIPT_SCHEMA_PATH)
    config = load_json(path)
    config_errors = format_errors(validator(config_schema).iter_errors(config))
    if config_errors:
        return {}, [f"config schema: {e}" for e in config_errors]
    receipt, errors = simulate(config)
    receipt_errors = format_errors(validator(receipt_schema).iter_errors(receipt))
    return receipt, [*errors, *[f"receipt schema: {e}" for e in receipt_errors]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulation", action="append")
    parser.add_argument("--write-receipts", action="store_true")
    args = parser.parse_args()

    paths = sorted(SIM_DIR.glob("P*/config.json"))
    if args.simulation:
        wanted = set(args.simulation)
        paths = [p for p in paths if load_json(p)["simulation_id"] in wanted]

    if not paths:
        print("no population simulations found", file=sys.stderr)
        return 2

    receipts = []
    failures = []
    for path in paths:
        receipt, errors = run_config(path)
        sim_id = load_json(path)["simulation_id"]
        if errors:
            print(f"{sim_id}: FAIL")
            if receipt:
                print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
                print("  signals:", ",".join(receipt["signal_ids"]) or "<none>")
            for error in errors:
                print(f"  - {error}")
            failures.extend(f"{sim_id}: {e}" for e in errors)
        else:
            print(f"{sim_id}: {receipt['result']}")
            print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
            print("  signals:", ",".join(receipt["signal_ids"]) or "<none>")
            receipts.append(receipt)

    if args.write_receipts and receipts:
        out = ROOT / "harness" / ".artifacts" / "population"
        out.mkdir(parents=True, exist_ok=True)
        for receipt in receipts:
            (out / f"{receipt['simulation_id']}.receipt.json").write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(
        f"\nUU Society v0.1 population simulation suite: "
        f"{len(receipts)}/{len(paths)} simulations conform"
    )
    if failures:
        print(f"unexpected failures: {len(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
