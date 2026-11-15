#!/usr/bin/env python3
"""Deterministic phase-space exploration for UU Society v0.1.

The sweep maps independent diagnostic signatures and neighboring regime
boundaries. It does not compute a universal social score and does not select a
single morally "optimal" society.
"""

from __future__ import annotations

import argparse
import itertools
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from run_scenarios import current_commit, digest, format_errors, load_json, validator
from run_population_simulations import simulate

ROOT = Path(__file__).resolve().parents[1]
SWEEP_SCHEMA_PATH = ROOT / "phase-space-sweep.config.schema.json"
RECEIPT_SCHEMA_PATH = ROOT / "phase-space-sweep.receipt.schema.json"
SWEEP_DIR = ROOT / "phase_space_sweeps"

AXES = [
    "adversarial_fraction",
    "repair_probability_adversarial",
    "restriction_duration_interactions",
    "feedback_strength",
    "base_willingness_probability",
    "coalition_fraction",
    "coalition_request_bias",
]

AXIS_CODES = {
    "adversarial_fraction": "af",
    "repair_probability_adversarial": "rp",
    "restriction_duration_interactions": "rd",
    "feedback_strength": "fb",
    "base_willingness_probability": "bw",
    "coalition_fraction": "cf",
    "coalition_request_bias": "cb",
}

SIGNALS = [
    "AUTHORITY_CONCENTRATION",
    "ACCESS_INEQUALITY",
    "RESTRICTION_INERTIA",
    "HARM_PRESSURE",
    "UNMET_NEED_PRESSURE",
    "IDLE_CAPABILITY_STRANDING",
    "COALITION_EXTRACTION",
]


def cell_id(indices: tuple[int, ...]) -> str:
    return "c-" + "-".join(
        f"{AXIS_CODES[name]}{idx}" for name, idx in zip(AXES, indices)
    )


def signature(signal_ids: list[str]) -> str:
    return "STABLE" if not signal_ids else "+".join(sorted(signal_ids))


def build_population_config(
    sweep: dict[str, Any],
    indices: tuple[int, ...],
    values: tuple[Any, ...],
) -> dict[str, Any]:
    axis = dict(zip(AXES, values))
    fixed = sweep["fixed"]
    cid = cell_id(indices)
    return {
        "simulation_id": f"P99-{cid}",
        "simulation_version": "0.1",
        "title_en": f"Phase-space cell {cid}",
        "title_ru": f"Клетка фазового пространства {cid}",
        "purpose": "Generated deterministic phase-space cell.",
        "seed": f"{sweep['seed']}|{cid}",
        "actor_count": sweep["actor_count"],
        "interaction_count": sweep["interactions_per_cell"],
        "categories": sweep["categories"],
        "population": {
            "adversarial_fraction": axis["adversarial_fraction"],
            "coalition_fraction": axis["coalition_fraction"],
            "base_capability_probability": fixed["population"]["base_capability_probability"],
            "base_willingness_probability": axis["base_willingness_probability"],
        },
        "matching": {
            "candidate_pool_size": fixed["matching"]["candidate_pool_size"],
            "policy": fixed["matching"]["policy"],
            "feedback_strength": axis["feedback_strength"],
            "coalition_request_bias": axis["coalition_request_bias"],
        },
        "dynamics": {
            "accidental_harm_rate": fixed["dynamics"]["accidental_harm_rate"],
            "adversarial_harm_rate": fixed["dynamics"]["adversarial_harm_rate"],
            "ordinary_breach_rate": fixed["dynamics"]["ordinary_breach_rate"],
            "adversarial_breach_rate": fixed["dynamics"]["adversarial_breach_rate"],
            "repair_probability_cooperative": fixed["dynamics"]["repair_probability_cooperative"],
            "repair_probability_adversarial": axis["repair_probability_adversarial"],
            "restriction_duration_interactions": axis["restriction_duration_interactions"],
            "restriction_renewal_limit": fixed["dynamics"]["restriction_renewal_limit"],
        },
        "diagnostic_thresholds": fixed["diagnostic_thresholds"],
        "expected": {"result": "PASS", "expected_signal_ids": []},
    }


def pareto_frontier(cells: list[dict[str, Any]]) -> list[str]:
    """Return nondominated cells over independent loss dimensions.

    No scalar weighting is used.
    """
    dims = [
        "harm_rate",
        "restriction_actor_time_share",
        "unmet_need_rate",
        "idle_capability_rate",
        "authority_top10_share",
        "access_gini",
    ]
    frontier = []
    for candidate in cells:
        cm = candidate["metrics"]
        dominated = False
        for other in cells:
            if other is candidate:
                continue
            om = other["metrics"]
            weakly_better = all(om[d] <= cm[d] for d in dims)
            strictly_better = any(om[d] < cm[d] for d in dims)
            if weakly_better and strictly_better:
                dominated = True
                break
        if not dominated:
            frontier.append(candidate["cell_id"])
    return sorted(frontier)


def neighboring_edges(
    cells_by_index: dict[tuple[int, ...], dict[str, Any]],
    axis_lengths: list[int],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    edges = []
    per_axis = Counter()
    for indices, cell in cells_by_index.items():
        for axis_pos, axis_name in enumerate(AXES):
            if indices[axis_pos] + 1 >= axis_lengths[axis_pos]:
                continue
            neighbor_idx = list(indices)
            neighbor_idx[axis_pos] += 1
            neighbor = cells_by_index[tuple(neighbor_idx)]
            if cell["signature"] != neighbor["signature"]:
                edges.append({
                    "axis": axis_name,
                    "from_cell": cell["cell_id"],
                    "to_cell": neighbor["cell_id"],
                    "from_signature": cell["signature"],
                    "to_signature": neighbor["signature"],
                })
                per_axis[axis_name] += 1
    return edges, {axis: per_axis.get(axis, 0) for axis in AXES}


def run_sweep(config_path: Path) -> tuple[dict[str, Any], list[str], list[dict[str, Any]]]:
    sweep_schema = load_json(SWEEP_SCHEMA_PATH)
    receipt_schema = load_json(RECEIPT_SCHEMA_PATH)
    sweep = load_json(config_path)
    errors = format_errors(validator(sweep_schema).iter_errors(sweep))
    if errors:
        return {}, [f"sweep schema: {e}" for e in errors], []

    axis_values = [sweep["axes"][name] for name in AXES]
    axis_lengths = [len(values) for values in axis_values]
    cells = []
    cells_by_index = {}

    for indices in itertools.product(*[range(n) for n in axis_lengths]):
        values = tuple(axis_values[pos][idx] for pos, idx in enumerate(indices))
        pop_config = build_population_config(sweep, indices, values)
        sim_receipt, _ = simulate(pop_config, enforce_expected=False)
        cell = {
            "cell_id": cell_id(indices),
            "indices": list(indices),
            "parameters": dict(zip(AXES, values)),
            "signal_ids": sim_receipt["signal_ids"],
            "signature": signature(sim_receipt["signal_ids"]),
            "metrics": sim_receipt["metrics"],
            "trace_digest": sim_receipt["trace_digest"],
        }
        cells.append(cell)
        cells_by_index[indices] = cell

    sig_counts = Counter(cell["signature"] for cell in cells)
    signal_counts = {
        signal: sum(signal in cell["signal_ids"] for cell in cells)
        for signal in SIGNALS
    }
    edges, axis_transition_counts = neighboring_edges(cells_by_index, axis_lengths)
    frontier = pareto_frontier(cells)

    expected = sweep["expected"]
    actual_cell_count = len(cells)
    covered = {signal for signal, count in signal_counts.items() if count > 0}
    expected_errors = []
    if actual_cell_count != expected["cell_count"]:
        expected_errors.append(
            f"cell_count expected={expected['cell_count']} actual={actual_cell_count}"
        )
    if len(sig_counts) < expected["min_signature_count"]:
        expected_errors.append(
            f"signature_count expected>={expected['min_signature_count']} actual={len(sig_counts)}"
        )
    if len(edges) < expected["min_boundary_edge_count"]:
        expected_errors.append(
            f"boundary_edge_count expected>={expected['min_boundary_edge_count']} actual={len(edges)}"
        )
    missing_coverage = set(expected["required_signal_coverage"]) - covered
    if missing_coverage:
        expected_errors.append(
            f"missing required signal coverage: {sorted(missing_coverage)}"
        )

    receipt = {
        "receipt_version": "0.1",
        "sweep_id": sweep["sweep_id"],
        "sweep_version": sweep["sweep_version"],
        "model_commit_sha": current_commit(),
        "cell_count": actual_cell_count,
        "stable_cell_count": sig_counts.get("STABLE", 0),
        "signature_count": len(sig_counts),
        "signature_counts": dict(sorted(sig_counts.items())),
        "signal_cell_counts": signal_counts,
        "boundary_edge_count": len(edges),
        "pareto_frontier_cell_ids": frontier,
        "axis_transition_counts": axis_transition_counts,
        "result": "PASS" if not expected_errors else "FAIL",
        "config_digest": digest(sweep),
        "cells_digest": digest(cells),
    }
    receipt_errors = format_errors(validator(receipt_schema).iter_errors(receipt))
    return receipt, [*expected_errors, *[f"receipt schema: {e}" for e in receipt_errors]], cells


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sweep", action="append")
    parser.add_argument("--write-artifacts", action="store_true")
    args = parser.parse_args()

    paths = sorted(SWEEP_DIR.glob("W*/config.json"))
    if args.sweep:
        wanted = set(args.sweep)
        paths = [p for p in paths if load_json(p)["sweep_id"] in wanted]

    if not paths:
        print("no phase-space sweeps found", file=sys.stderr)
        return 2

    failures = []
    for path in paths:
        sweep_id = load_json(path)["sweep_id"]
        receipt, errors, cells = run_sweep(path)
        if errors:
            print(f"{sweep_id}: FAIL")
            if receipt:
                print("  summary:", json.dumps(receipt, sort_keys=True))
            for error in errors:
                print(f"  - {error}")
            failures.extend(f"{sweep_id}: {e}" for e in errors)
        else:
            print(f"{sweep_id}: PASS")
            print("  cells:", receipt["cell_count"])
            print("  stable_cells:", receipt["stable_cell_count"])
            print("  signature_count:", receipt["signature_count"])
            print("  signal_cell_counts:", json.dumps(receipt["signal_cell_counts"], sort_keys=True))
            print("  boundary_edge_count:", receipt["boundary_edge_count"])
            print("  axis_transition_counts:", json.dumps(receipt["axis_transition_counts"], sort_keys=True))
            print("  pareto_frontier_size:", len(receipt["pareto_frontier_cell_ids"]))
            print("  cells_digest:", receipt["cells_digest"])

        if args.write_artifacts and receipt:
            out = ROOT / "harness" / ".artifacts" / "phase-space" / sweep_id
            out.mkdir(parents=True, exist_ok=True)
            (out / "receipt.json").write_text(
                json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            (out / "cells.json").write_text(
                json.dumps(cells, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(
        f"\nUU Society v0.1 phase-space sweep suite: "
        f"{len(paths) - len(failures)}/{len(paths)} sweeps conform"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
