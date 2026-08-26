#!/usr/bin/env python3
import argparse
import copy
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PILOT = HERE / "pilot.py"
UPSTREAM_VALIDATE = ROOT / "network-user-surface-enablement-materialization" / "validate.py"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pilot = loadmod("kontur_local_trial_pilot", PILOT)
upstream = loadmod("kontur_local_trial_pilot_materialization_validate", UPSTREAM_VALIDATE)


def build_local_synthetic_enablement_state():
    _, grants = upstream.active_grants()
    source_grant = copy.deepcopy(grants[-1])
    state = pilot.materialize.materialize(
        source_grant,
        upstream.ready_context(source_grant),
    )
    pilot.validate_enablement_state(state)
    return state


def ready_context(item, config):
    context = pilot.default_pilot_context(item, config)
    context["pilot_run_requested"] = True
    for field in pilot.PRECHECK_FIELDS:
        context[field] = True
    return context


def execute(scenario):
    config = pilot.load_config()
    pilot.validate_config(config)
    state = build_local_synthetic_enablement_state()
    context = None if scenario == "safe-default" else ready_context(state, config)
    return pilot.run_pilot(state, context, config)


def main():
    parser = argparse.ArgumentParser(
        description="Run the local synthetic KONTUR trial pilot with null transport."
    )
    parser.add_argument(
        "--scenario",
        choices=("safe-default", "synthetic-ready"),
        default="safe-default",
        help="safe-default creates no ready pilot; synthetic-ready emits a local-only ready receipt",
    )
    parser.add_argument("--pretty", action="store_true", help="pretty-print the JSON receipt")
    args = parser.parse_args()
    receipt = execute(args.scenario)
    print(
        json.dumps(
            receipt,
            ensure_ascii=False,
            sort_keys=True,
            indent=2 if args.pretty else None,
            separators=None if args.pretty else (",", ":"),
        )
    )


if __name__ == "__main__":
    main()
