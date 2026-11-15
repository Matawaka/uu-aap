#!/usr/bin/env python3
"""Deterministic endogenous-adaptation experiments for UU Society v0.4.

Actors adapt through local contextual relationship memory, bilateral reciprocity
and repair. A deliberately bad global-generalization policy is available as a
comparison surface. No universal person score is created.
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

from run_population_simulations import gini, pick_index, u64, unit
from run_scenarios import current_commit, digest, format_errors, load_json, validator

ROOT = Path(__file__).resolve().parents[1]
CONFIG_SCHEMA_PATH = ROOT / "adaptive-simulation.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "adaptive-simulation.receipt.schema.json"
SIM_DIR = ROOT / "adaptive_simulations"


@dataclass
class Actor:
    actor_id: int
    adversarial: bool = False
    extractor: bool = False
    protected_need: bool = False
    capability: dict[str, bool] = field(default_factory=dict)
    base_willingness: dict[str, float] = field(default_factory=dict)
    provided: int = 0
    received: int = 0
    harm_caused: int = 0
    repairs: int = 0


@dataclass
class EdgeMemory:
    affinity: float
    successes: int = 0
    harms: int = 0
    breaches: int = 0
    repairs: int = 0
    recovered_after_adverse: bool = False
    had_adverse: bool = False


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def percentile95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, math.ceil(len(ordered) * 0.95) - 1)
    return float(ordered[idx])


def build_population(config: dict[str, Any]) -> list[Actor]:
    seed = config["seed"]
    n = config["actor_count"]
    pop = config["population"]
    actors = [Actor(actor_id=i) for i in range(n)]

    adv_count = round(n * pop["adversarial_fraction"])
    extractor_count = round(n * pop["extractor_fraction"])
    protected_count = round(n * pop["protected_need_fraction"])
    adv_rank = sorted(range(n), key=lambda i: u64(seed, "adaptive-adv", i))
    ext_rank = sorted(range(n), key=lambda i: u64(seed, "adaptive-ext", i))
    protected_rank = sorted(range(n), key=lambda i: u64(seed, "adaptive-protected", i))
    adversarial = set(adv_rank[:adv_count])
    extractors = set(ext_rank[:extractor_count])
    protected_need = set(protected_rank[:protected_count])

    for actor in actors:
        actor.adversarial = actor.actor_id in adversarial
        actor.extractor = actor.actor_id in extractors
        actor.protected_need = actor.actor_id in protected_need
        for category in config["categories"]:
            actor.capability[category] = (
                unit(seed, "adaptive-cap", actor.actor_id, category)
                < pop["base_capability_probability"]
            )
            variation = (
                unit(seed, "adaptive-will", actor.actor_id, category) - 0.5
            ) * 0.2
            actor.base_willingness[category] = clamp(
                pop["base_willingness_probability"] + variation
            )
    return actors


def edge_key(observer: int, subject: int, category: str) -> tuple[int, int, str]:
    return (observer, subject, category)


def relationship(
    memories: dict[tuple[int, int, str], EdgeMemory],
    observer: int,
    subject: int,
    category: str,
    initial: float,
) -> EdgeMemory:
    key = edge_key(observer, subject, category)
    if key not in memories:
        memories[key] = EdgeMemory(affinity=initial)
    return memories[key]


def all_subject_edges(
    memories: dict[tuple[int, int, str], EdgeMemory],
    observer: int,
    subject: int,
) -> list[EdgeMemory]:
    return [
        memory
        for (obs, sub, _cat), memory in memories.items()
        if obs == observer and sub == subject
    ]


def apply_affinity_delta(
    config: dict[str, Any],
    memories: dict[tuple[int, int, str], EdgeMemory],
    observer: int,
    subject: int,
    category: str,
    delta: float,
) -> int:
    """Apply a relationship update and return count of cross-context updates."""
    policy = config["adaptation"]["policy"]
    initial = config["adaptation"]["initial_affinity"]
    if policy == "no_adaptation":
        return 0

    cross_context = 0
    if policy == "local_contextual":
        edge = relationship(memories, observer, subject, category, initial)
        edge.affinity = clamp(edge.affinity + delta)
        return 0

    # Deliberately bad comparison policy: generalize one contextual event to
    # every category for the same observer->subject relationship.
    for cat in config["categories"]:
        edge = relationship(memories, observer, subject, cat, initial)
        edge.affinity = clamp(edge.affinity + delta)
        if cat != category:
            cross_context += 1
    return cross_context


def decay_memories(config: dict[str, Any], memories: dict[tuple[int, int, str], EdgeMemory]) -> None:
    rate = config["adaptation"]["forgetting_rate"]
    if rate <= 0:
        return
    baseline = config["adaptation"]["initial_affinity"]
    for memory in memories.values():
        memory.affinity += (baseline - memory.affinity) * rate
        memory.affinity = clamp(memory.affinity)


def requester_for(config: dict[str, Any], actors: list[Actor], step: int) -> Actor:
    return actors[pick_index(config["seed"], len(actors), "adaptive-requester", step)]


def candidate_pool(
    config: dict[str, Any],
    actors: list[Actor],
    requester: Actor,
    category: str,
    step: int,
) -> list[Actor]:
    seed = config["seed"]
    size = min(config["matching"]["candidate_pool_size"], len(actors) - 1)
    out: list[Actor] = []
    seen = {requester.actor_id}
    cursor = 0
    while len(out) < size and cursor < len(actors) * 4:
        idx = pick_index(seed, len(actors), "adaptive-candidate", step, category, cursor)
        cursor += 1
        if idx in seen:
            continue
        seen.add(idx)
        out.append(actors[idx])
    return out


def bilateral_balance(
    balances: dict[tuple[int, int, str], int],
    provider: int,
    requester: int,
    category: str,
) -> int:
    # Positive means provider has already given more to requester than received
    # back from that requester in this context.
    return balances.get((provider, requester, category), 0)


def choose_provider(
    config: dict[str, Any],
    actors: list[Actor],
    memories: dict[tuple[int, int, str], EdgeMemory],
    balances: dict[tuple[int, int, str], int],
    context_balance: dict[tuple[int, str], int],
    requester: Actor,
    category: str,
    step: int,
) -> Actor | None:
    candidates = [
        a for a in candidate_pool(config, actors, requester, category, step)
        if a.capability[category]
    ]
    if not candidates:
        return None

    seed = config["seed"]
    adap = config["adaptation"]
    matching = config["matching"]
    scored = []
    for provider in candidates:
        base = provider.base_willingness[category]
        if provider.extractor:
            base *= adap["extractor_provider_multiplier"]
        if provider.protected_need:
            base *= adap["protected_need_provider_multiplier"]

        provider_memory = relationship(
            memories,
            provider.actor_id,
            requester.actor_id,
            category,
            adap["initial_affinity"],
        )
        requester_memory = relationship(
            memories,
            requester.actor_id,
            provider.actor_id,
            category,
            adap["initial_affinity"],
        )

        owed = bilateral_balance(
            balances, provider.actor_id, requester.actor_id, category
        )
        reciprocity_factor = 1.0
        if owed > adap["reciprocity_threshold"]:
            excess = owed - adap["reciprocity_threshold"]
            reciprocity_factor = max(
                0.0, 1.0 - adap["reciprocity_penalty"] * excess
            )

        contribution_factor = 1.0
        if adap["contextual_contribution_enabled"] and not requester.protected_need:
            net = context_balance.get((requester.actor_id, category), 0)
            debt = max(0, -net - adap["contextual_contribution_threshold"])
            contribution_factor = max(
                0.0, 1.0 - adap["contextual_contribution_penalty"] * debt
            )

        willingness = (
            base
            * provider_memory.affinity
            * reciprocity_factor
            * contribution_factor
        )
        if unit(seed, "adaptive-willing", step, provider.actor_id, requester.actor_id, category) > willingness:
            continue

        score = (
            matching["affinity_weight"] * requester_memory.affinity
            + matching["reciprocity_weight"] * reciprocity_factor
            + unit(seed, "adaptive-provider-tie", step, provider.actor_id, requester.actor_id) * 1e-6
        )
        scored.append((score, provider))

    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def simulate(config: dict[str, Any], enforce_expected: bool = True) -> tuple[dict[str, Any], list[str]]:
    actors = build_population(config)
    seed = config["seed"]
    adap = config["adaptation"]
    dyn = config["dynamics"]
    memories: dict[tuple[int, int, str], EdgeMemory] = {}
    balances: dict[tuple[int, int, str], int] = {}
    context_balance: dict[tuple[int, str], int] = {}
    trace = hashlib.sha256()

    epoch_size = config["interaction_count"] // config["epoch_count"]
    epoch_summaries = []
    epoch = {
        "attempts":0, "fulfilled":0, "harms":0, "repeat_harms":0,
        "repairs":0, "spillover_updates":0, "adverse_updates":0
    }

    total_harms = 0
    repeat_harms = 0
    repairs = 0
    repair_opportunities = 0
    cross_context_updates = 0
    adverse_updates = 0
    fulfilled = 0
    group_attempts = {"protected": 0, "extractor": 0, "ordinary": 0}
    group_fulfilled = {"protected": 0, "extractor": 0, "ordinary": 0}

    for step in range(config["interaction_count"]):
        if step > 0 and step % epoch_size == 0 and len(epoch_summaries) < config["epoch_count"] - 1:
            epoch_summaries.append(dict(epoch))
            epoch = {
                "attempts":0, "fulfilled":0, "harms":0, "repeat_harms":0,
                "repairs":0, "spillover_updates":0, "adverse_updates":0
            }
            decay_memories(config, memories)

        epoch["attempts"] += 1
        requester = requester_for(config, actors, step)
        requester_group = (
            "protected" if requester.protected_need
            else "extractor" if requester.extractor
            else "ordinary"
        )
        group_attempts[requester_group] += 1
        category = config["categories"][
            pick_index(seed, len(config["categories"]), "adaptive-category", step)
        ]
        provider = choose_provider(
            config, actors, memories, balances, context_balance,
            requester, category, step
        )
        if provider is None:
            trace.update(f"{step}|unmet|{requester.actor_id}|{category}\n".encode())
            continue

        fulfilled += 1
        group_fulfilled[requester_group] += 1
        epoch["fulfilled"] += 1
        provider.provided += 1
        requester.received += 1

        # Provider has given one unit to requester in this context; reverse
        # direction is simultaneously one unit less owed if it later occurs.
        balances[(provider.actor_id, requester.actor_id, category)] = (
            balances.get((provider.actor_id, requester.actor_id, category), 0) + 1
        )
        balances[(requester.actor_id, provider.actor_id, category)] = (
            balances.get((requester.actor_id, provider.actor_id, category), 0) - 1
        )
        context_balance[(provider.actor_id, category)] = (
            context_balance.get((provider.actor_id, category), 0) + 1
        )
        context_balance[(requester.actor_id, category)] = (
            context_balance.get((requester.actor_id, category), 0) - 1
        )

        harm_rate = (
            dyn["adversarial_harm_rate"] if provider.adversarial
            else dyn["ordinary_harm_rate"]
        )
        breach_rate = (
            dyn["adversarial_breach_rate"] if provider.adversarial
            else dyn["ordinary_breach_rate"]
        )
        harm = unit(seed, "adaptive-harm", step, provider.actor_id, requester.actor_id) < harm_rate
        breach = unit(seed, "adaptive-breach", step, provider.actor_id, requester.actor_id) < breach_rate

        req_edge = relationship(
            memories, requester.actor_id, provider.actor_id, category,
            adap["initial_affinity"]
        )
        prov_edge = relationship(
            memories, provider.actor_id, requester.actor_id, category,
            adap["initial_affinity"]
        )

        repaired = False
        if harm or breach:
            repair_opportunities += 1
            req_edge.had_adverse = True
            prov_edge.had_adverse = True
            if harm:
                total_harms += 1
                epoch["harms"] += 1
                provider.harm_caused += 1
                if req_edge.harms > 0:
                    repeat_harms += 1
                    epoch["repeat_harms"] += 1
                req_edge.harms += 1
                adverse_updates += 1
                epoch["adverse_updates"] += 1
                spill = apply_affinity_delta(
                    config, memories, requester.actor_id, provider.actor_id,
                    category, -adap["harm_penalty"]
                )
                cross_context_updates += spill
                epoch["spillover_updates"] += spill

            if breach:
                req_edge.breaches += 1
                adverse_updates += 1
                epoch["adverse_updates"] += 1
                spill = apply_affinity_delta(
                    config, memories, requester.actor_id, provider.actor_id,
                    category, -adap["breach_penalty"]
                )
                cross_context_updates += spill
                epoch["spillover_updates"] += spill

            repair_prob = (
                dyn["repair_probability_adversarial"] if provider.adversarial
                else dyn["repair_probability_cooperative"]
            )
            if unit(seed, "adaptive-repair", step, provider.actor_id, requester.actor_id) < repair_prob:
                repaired = True
                repairs += 1
                epoch["repairs"] += 1
                provider.repairs += 1
                req_edge.repairs += 1
                prov_edge.repairs += 1
                spill = apply_affinity_delta(
                    config, memories, requester.actor_id, provider.actor_id,
                    category, adap["repair_restore"]
                )
                cross_context_updates += spill
                epoch["spillover_updates"] += spill
                refreshed = relationship(
                    memories, requester.actor_id, provider.actor_id, category,
                    adap["initial_affinity"]
                )
                if refreshed.affinity >= adap["initial_affinity"] * 0.8:
                    refreshed.recovered_after_adverse = True
        else:
            req_edge.successes += 1
            prov_edge.successes += 1
            apply_affinity_delta(
                config, memories, requester.actor_id, provider.actor_id,
                category, adap["positive_step"]
            )
            apply_affinity_delta(
                config, memories, provider.actor_id, requester.actor_id,
                category, adap["positive_step"] * 0.5
            )

        trace.update(
            (
                f"{step}|ok|req={requester.actor_id}|prov={provider.actor_id}|"
                f"cat={category}|harm={int(harm)}|breach={int(breach)}|"
                f"repair={int(repaired)}\n"
            ).encode()
        )

    epoch_summaries.append(dict(epoch))

    # Normalize epochs into rates.
    normalized_epochs = []
    for idx, item in enumerate(epoch_summaries):
        attempts = max(1, item["attempts"])
        fulfilled_epoch = max(1, item["fulfilled"])
        normalized_epochs.append({
            "epoch":idx,
            "attempts":item["attempts"],
            "fulfilled_rate":item["fulfilled"] / attempts,
            "harm_rate":item["harms"] / fulfilled_epoch,
            "repeat_harm_share":item["repeat_harms"] / max(1, item["harms"]),
            "repair_rate":item["repairs"] / max(1, item["adverse_updates"]),
            "context_spillover_updates":item["spillover_updates"],
        })

    first = normalized_epochs[0]
    tail = normalized_epochs[-1]
    tail_harm_ratio = tail["harm_rate"] / max(first["harm_rate"], 1e-9)
    tail_fulfillment_drop = max(0.0, first["fulfilled_rate"] - tail["fulfilled_rate"])

    observed_memories = list(memories.values())
    recovered_edges = sum(
        1 for m in observed_memories if m.had_adverse and m.recovered_after_adverse
    )
    adverse_edges = sum(1 for m in observed_memories if m.had_adverse)

    # Isolation proxy: actor has no outgoing contextual edge above 0.25 among
    # relationships that were actually observed.
    outgoing: dict[int, list[float]] = {a.actor_id: [] for a in actors}
    for (observer, _subject, _cat), memory in memories.items():
        outgoing[observer].append(memory.affinity)
    isolated = sum(
        1 for actor in actors
        if outgoing[actor.actor_id] and max(outgoing[actor.actor_id]) < 0.25
    )

    imbalance_values = [
        abs(actor.received - actor.provided) for actor in actors
    ]
    extractor_imbalance_values = [
        abs(actor.received - actor.provided) for actor in actors if actor.extractor
    ]
    protected_rate = (
        group_fulfilled["protected"] / max(1, group_attempts["protected"])
    )
    ordinary_rate = (
        group_fulfilled["ordinary"] / max(1, group_attempts["ordinary"])
    )

    metrics = {
        "fulfilled_need_rate": fulfilled / config["interaction_count"],
        "harm_rate": total_harms / max(1, fulfilled),
        "repeat_harm_share": repeat_harms / max(1, total_harms),
        "repair_completion_rate": repairs / max(1, repair_opportunities),
        "relationship_recovery_rate": recovered_edges / max(1, adverse_edges),
        "context_spillover_share": cross_context_updates / max(1, adverse_updates),
        "isolation_fraction": isolated / len(actors),
        "extraction_imbalance_p95": percentile95(imbalance_values),
        "extractor_imbalance_p95": percentile95(extractor_imbalance_values),
        "protected_need_fulfillment_rate": protected_rate,
        "ordinary_fulfillment_rate": ordinary_rate,
        "protected_need_fulfillment_gap": max(0.0, ordinary_rate - protected_rate),
        "access_gini": gini([a.received for a in actors]),
        "provision_gini": gini([a.provided for a in actors]),
        "tail_harm_ratio": tail_harm_ratio,
        "tail_fulfillment_drop": tail_fulfillment_drop,
        "first_epoch_harm_rate": first["harm_rate"],
        "tail_epoch_harm_rate": tail["harm_rate"],
        "first_epoch_fulfilled_rate": first["fulfilled_rate"],
        "tail_epoch_fulfilled_rate": tail["fulfilled_rate"],
    }

    th = config["diagnostic_thresholds"]
    patterns = set()
    if tail_harm_ratio < th["tail_harm_ratio_max"]:
        patterns.add("ADAPTIVE_HARM_REDUCTION")
    if metrics["repeat_harm_share"] > th["repeat_harm_share_max"]:
        patterns.add("REPEAT_HARM_PERSISTS")
    if (
        metrics["isolation_fraction"] > th["isolation_fraction_max"]
        or metrics["tail_fulfillment_drop"] > th["tail_fulfillment_drop_max"]
    ):
        patterns.add("GLOBAL_WITHDRAWAL_FRAGMENTATION")
    if metrics["relationship_recovery_rate"] >= th["relationship_recovery_rate_min"]:
        patterns.add("REPAIR_REOPENS_RELATIONSHIPS")
    if (
        config["population"]["extractor_fraction"] > 0
        and metrics["extractor_imbalance_p95"] > th["extraction_imbalance_p95_max"]
    ):
        patterns.add("EXTRACTION_IMBALANCE")
    if (
        config["population"]["extractor_fraction"] > 0
        and adap["reciprocity_penalty"] > 0
        and not adap["contextual_contribution_enabled"]
        and metrics["extractor_imbalance_p95"] > th["extraction_imbalance_p95_max"]
    ):
        patterns.add("RECIPROCITY_EVASION_BY_ROTATION")
    if (
        config["population"]["extractor_fraction"] > 0
        and adap["contextual_contribution_enabled"]
        and metrics["extractor_imbalance_p95"] <= th["extraction_imbalance_p95_max"]
    ):
        patterns.add("CONTEXTUAL_CONTRIBUTION_CONTAINS_ROTATION")
    if (
        config["population"]["protected_need_fraction"] > 0
        and metrics["protected_need_fulfillment_gap"]
        <= th["protected_need_fulfillment_gap_max"]
    ):
        patterns.add("LEGITIMATE_ASYMMETRY_PRESERVED")
    if metrics["context_spillover_share"] > th["context_spillover_share_max"]:
        patterns.add("CONTEXT_SPILLOVER")

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
        "receipt_version":"0.4",
        "simulation_id":config["simulation_id"],
        "simulation_version":"0.4",
        "model_commit_sha":current_commit(),
        "seed":config["seed"],
        "actor_count":config["actor_count"],
        "interaction_count":config["interaction_count"],
        "epoch_count":config["epoch_count"],
        "result":actual_result if not errors else "FAIL",
        "pattern_ids":sorted(patterns),
        "metrics":metrics,
        "epoch_summaries":normalized_epochs,
        "trace_digest":trace.hexdigest(),
        "config_digest":digest(config),
    }
    return receipt, errors


def run_config(path: Path) -> tuple[dict[str, Any], list[str]]:
    config_schema = load_json(CONFIG_SCHEMA_PATH)
    receipt_schema = load_json(RECEIPT_SCHEMA_PATH)
    config = load_json(path)
    errors = format_errors(validator(config_schema).iter_errors(config))
    if errors:
        return {}, [f"config schema: {e}" for e in errors]
    receipt, run_errors = simulate(config)
    receipt_errors = format_errors(validator(receipt_schema).iter_errors(receipt))
    return receipt, [*run_errors, *[f"receipt schema: {e}" for e in receipt_errors]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulation", action="append")
    parser.add_argument("--write-receipts", action="store_true")
    args = parser.parse_args()

    paths = sorted(SIM_DIR.glob("A*/config.json"))
    if args.simulation:
        wanted = set(args.simulation)
        paths = [p for p in paths if load_json(p)["simulation_id"] in wanted]

    if not paths:
        print("no adaptive simulations found", file=sys.stderr)
        return 2

    failures = []
    receipts = []
    for path in paths:
        receipt, errors = run_config(path)
        sim_id = load_json(path)["simulation_id"]
        if errors:
            print(f"{sim_id}: FAIL")
            if receipt:
                print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
                print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
            for error in errors:
                print(f"  - {error}")
            failures.extend(f"{sim_id}: {e}" for e in errors)
        else:
            print(f"{sim_id}: {receipt['result']}")
            print("  metrics:", json.dumps(receipt["metrics"], sort_keys=True))
            print("  patterns:", ",".join(receipt["pattern_ids"]) or "<none>")
            print("  trace_digest:", receipt["trace_digest"])
            receipts.append(receipt)

    if args.write_receipts and receipts:
        out = ROOT / "harness" / ".artifacts" / "adaptive"
        out.mkdir(parents=True, exist_ok=True)
        for receipt in receipts:
            (out / f"{receipt['simulation_id']}.receipt.json").write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(
        f"\nUU Society endogenous adaptation v0.4: "
        f"{len(receipts)}/{len(paths)} simulations conform"
    )
    if failures:
        print(f"unexpected failures: {len(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
