#!/usr/bin/env python3
import argparse
import json

import ingest


def ready_context(pilot_receipt, sidecar_root, session_id, expected_policy_sha256):
    context = ingest.default_ingest_context(pilot_receipt)
    context["external_sandbox_ingest_requested"] = True
    context["human_external_sandbox_decision"] = ingest.HUMAN_DECISION
    context["session_id"] = session_id
    context["expected_policy_sha256"] = expected_policy_sha256
    context["sidecar_root_reference_digest"] = ingest.sidecar_root_reference_digest(sidecar_root)
    for field in ingest.PRECHECK_FIELDS:
        context[field] = True
    return context


def execute(scenario, sidecar_root=None, session_id=None, expected_policy_sha256=None):
    pilot_receipt = ingest.local_run.execute("synthetic-ready")
    if scenario == "safe-default":
        return ingest.ingest_completed_session(pilot_receipt)
    context = ready_context(pilot_receipt, sidecar_root, session_id, expected_policy_sha256)
    return ingest.ingest_completed_session(pilot_receipt, context, sidecar_root)


def main():
    parser = argparse.ArgumentParser(
        description="Run one bounded read-only ingest of a completed KONTUR external sidecar session."
    )
    parser.add_argument(
        "--scenario",
        choices=("safe-default", "external-read-only"),
        default="safe-default",
    )
    parser.add_argument("--sidecar-root")
    parser.add_argument("--session-id")
    parser.add_argument("--expected-policy-sha256")
    parser.add_argument("--human-decision", choices=(ingest.HUMAN_DECISION,))
    parser.add_argument("--confirm-game-stopped", action="store_true")
    parser.add_argument("--confirm-read-only-completed-session", action="store_true")
    parser.add_argument("--confirm-no-raw-log-process-network-or-write", action="store_true")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    external_values = (
        args.sidecar_root,
        args.session_id,
        args.expected_policy_sha256,
        args.human_decision,
        args.confirm_game_stopped,
        args.confirm_read_only_completed_session,
        args.confirm_no_raw_log_process_network_or_write,
    )
    if args.scenario == "safe-default":
        if any(external_values):
            parser.error("safe-default does not accept external target or decision arguments")
    else:
        if not all(external_values):
            parser.error("external-read-only requires the target, decision, and all three confirmations")
        if args.human_decision != ingest.HUMAN_DECISION:
            parser.error("exact bounded human decision required")

    receipt = execute(
        args.scenario,
        args.sidecar_root,
        args.session_id,
        args.expected_policy_sha256,
    )
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
