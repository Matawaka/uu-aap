#!/usr/bin/env python3
"""Bounded, deterministic UU Society population phase-space exploration.

No moral ranking, optimization of people, or runtime policy decisions.
Independent diagnostics; multiple signals may coexist.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import itertools
import json
from collections import Counter
from pathlib import Path

from run_population_simulations import ROOT, simulate
from run_scenarios import digest, load_json, validator, format_errors

SPEC = ROOT / "phase_space" / "sweep-v0.2.json"
BASELINE = ROOT / "population_simulations" / "P00-balanced-baseline" / "config.json"
CONFIG_SCHEMA = ROOT / "population-simulation.config.schema.json"
OUT = ROOT / "harness" / ".artifacts" / "phase-space"

# Only explicit allowlisted numeric parameters can be changed by the sweep.
AXES = {
    "population.adversarial_fraction": (0.0, 0.5),
    "population.base_willingness_probability": (0.0, 1.0),
    "population.base_capability_probability": (0.0, 1.0),
    "dynamics.restriction_duration_interactions": (1, 10000),
    "dynamics.repair_probability_cooperative": (0.0, 1.0),
    "matching.feedback_strength": (0.0, 10.0),
}
METRICS = (
    "fulfilled_need_rate", "unmet_need_rate", "idle_capability_rate",
    "harm_rate", "repair_completion_rate", "recovery_rate",
    "restriction_actor_time_share", "authority_top10_share",
    "access_gini", "coalition_extraction_ratio",
)


def validate_spec(spec):
    if spec.get("version") != "0.2":
        raise ValueError("sweep version must be 0.2")
    axes = spec.get("axes")
    if not isinstance(axes, dict) or not (2 <= len(axes) <= 6):
        raise ValueError("expected 2-6 explicit axes")
    if not isinstance(spec.get("replicate_seeds"), list) or not (2 <= len(spec["replicate_seeds"]) <= 8):
        raise ValueError("expected 2-8 replicate seeds")
    if len(set(spec["replicate_seeds"])) != len(spec["replicate_seeds"]) or not all(
        isinstance(s, str) and s for s in spec["replicate_seeds"]
    ):
        raise ValueError("replicate seeds must be unique nonempty strings")
    count = len(spec["replicate_seeds"])
    for path, values in axes.items():
        if path not in AXES or not isinstance(values, list) or not (2 <= len(values) <= 6):
            raise ValueError(f"invalid axis {path}")
        if len(set(map(str, values))) != len(values):
            raise ValueError(f"duplicate axis value {path}")
        lo, hi = AXES[path]
        for value in values:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not lo <= value <= hi:
                raise ValueError(f"out-of-range value in {path}: {value}")
            if path.endswith("restriction_duration_interactions") and not isinstance(value, int):
                raise ValueError("restriction duration must be integer")
        count *= len(values)
    if count > 300:
        raise ValueError("bounded sweep exceeds 300 runs")
    if not isinstance(spec.get("interaction_count"), int) or not (200 <= spec["interaction_count"] <= 10000):
        raise ValueError("interaction_count outside bounded range")
    return count


def make_config(baseline, spec, coordinates, seed):
    config = copy.deepcopy(baseline)
    config["simulation_id"] = "P90-phase-space-experiment"
    config["title_en"] = "Phase-space exploration run"
    config["title_ru"] = "Прогон исследования пространства параметров"
    config["purpose"] = "Diagnostic parameter sweep, not an expected-result fixture."
    config["interaction_count"] = spec["interaction_count"]
    # Seed remains constant across parameter combinations within a replicate:
    # comparable environmental draws reduce incidental sampling differences.
    config["seed"] = seed
    for path, value in coordinates.items():
        section, field = path.split(".")
        config[section][field] = value
    config["expected"] = {"result": "PASS", "expected_signal_ids": []}
    return config


def run(spec, baseline):
    count = validate_spec(spec)
    axis_names = sorted(spec["axes"])
    schema = load_json(CONFIG_SCHEMA)
    rows = []
    for values in itertools.product(*(spec["axes"][key] for key in axis_names)):
        coords = dict(zip(axis_names, values))
        for seed in spec["replicate_seeds"]:
            config = make_config(baseline, spec, coords, seed)
            errors = format_errors(validator(schema).iter_errors(config))
            if errors:
                raise ValueError("invalid generated config: " + "; ".join(errors))
            receipt, _oracle_mismatch = simulate(config)
            # Expected signals are deliberately NOT an oracle in exploratory mode.
            rows.append({
                "coordinates": coords,
                "seed": seed,
                "signals": receipt["signal_ids"],
                "metrics": {k: receipt["metrics"][k] for k in METRICS},
                "trace_digest": receipt["trace_digest"],
                "config_digest": receipt["config_digest"],
            })
    if len(rows) != count:
        raise AssertionError("sweep cardinality mismatch")
    grouped = {}
    for row in rows:
        key = json.dumps(row["coordinates"], sort_keys=True, separators=(",", ":"))
        grouped.setdefault(key, []).append(row)
    cells = []
    for key, replicates in sorted(grouped.items()):
        union = sorted(set().union(*(set(r["signals"]) for r in replicates)))
        intersection = sorted(set(replicates[0]["signals"]).intersection(
            *(set(r["signals"]) for r in replicates[1:])
        ))
        means = {
            metric: (
                sum(r["metrics"][metric] for r in replicates if r["metrics"][metric] is not None)
                / len([r for r in replicates if r["metrics"][metric] is not None])
                if any(r["metrics"][metric] is not None for r in replicates) else None
            )
            for metric in METRICS
        }
        cells.append({
            "coordinates": json.loads(key),
            "replicates": len(replicates),
            "persistent_signals": intersection,
            "observed_signals": union,
            "signal_variability": union != intersection,
            "mean_metrics": means,
        })
    signal_counts = Counter(s for r in rows for s in r["signals"])
    summary = {
        "version": "0.2",
        "scope": "SYNTHETIC_DIAGNOSTIC_ONLY",
        "sweep_spec_digest": digest(spec),
        "baseline_config_digest": digest(baseline),
        "runs": len(rows),
        "cells": len(cells),
        "replicates_per_cell": len(spec["replicate_seeds"]),
        "signal_run_counts": dict(sorted(signal_counts.items())),
        "cells_with_any_signal": sum(bool(c["observed_signals"]) for c in cells),
        "cells_with_variable_signals": sum(c["signal_variability"] for c in cells),
        "cells": cells,
        "rows_digest": digest(rows),
    }
    return summary, rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write local JSON/CSV diagnostic artifacts")
    parser.add_argument("--check-replay", action="store_true", help="repeat sweep and compare exact digests")
    args = parser.parse_args()
    spec, baseline = load_json(SPEC), load_json(BASELINE)
    summary, rows = run(spec, baseline)
    if args.check_replay:
        replay, replay_rows = run(spec, baseline)
        if replay != summary or replay_rows != rows:
            raise AssertionError("deterministic replay mismatch")
    print("UU Society phase-space v0.2")
    print("runs:", summary["runs"], "cells:", len(summary["cells"]))
    print("signal run counts:", json.dumps(summary["signal_run_counts"], sort_keys=True))
    print("cells with signals:", summary["cells_with_any_signal"])
    print("variable-signal cells:", summary["cells_with_variable_signals"])
    print("rows digest:", summary["rows_digest"])
    for cell in summary["cells"]:
        print(json.dumps({
            "coordinates": cell["coordinates"],
            "persistent": cell["persistent_signals"],
            "variable": cell["signal_variability"],
            "unmet": round(cell["mean_metrics"]["unmet_need_rate"], 4),
            "harm": round(cell["mean_metrics"]["harm_rate"], 4),
            "restriction": round(cell["mean_metrics"]["restriction_actor_time_share"], 4),
        }, sort_keys=True))
    if args.write:
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "summary.json").write_text(
            json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        (OUT / "runs.json").write_text(
            json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
