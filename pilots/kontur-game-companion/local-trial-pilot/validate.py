#!/usr/bin/env python3
import copy
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PILOT = HERE / "pilot.py"
RUN = HERE / "run.py"
UPSTREAM_VALIDATE = ROOT / "network-user-surface-enablement-materialization" / "validate.py"


def loadmod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pilot = loadmod("kontur_local_trial_pilot_validate", PILOT)
upstream = loadmod("kontur_local_trial_pilot_validate_upstream", UPSTREAM_VALIDATE)


def active_states():
    _, grants = upstream.active_grants()
    _, grants2 = upstream.active_grants()
    assert grants == grants2
    assert len(grants) == 7
    states = [
        pilot.materialize.materialize(
            copy.deepcopy(item),
            upstream.ready_context(item),
        )
        for item in grants
    ]
    states2 = [
        pilot.materialize.materialize(
            copy.deepcopy(item),
            upstream.ready_context(item),
        )
        for item in grants
    ]
    assert states == states2
    for state in states:
        assert state["decision"] == "LOCAL_SYNTHETIC_ENABLEMENT_STATE_MATERIALIZED"
        pilot.validate_enablement_state(state)
    return grants, states


def ready_context(item, config):
    context = pilot.default_pilot_context(item, config)
    context["pilot_run_requested"] = True
    for field in pilot.PRECHECK_FIELDS:
        context[field] = True
    return context


def main():
    config = pilot.load_config()
    pilot.validate_config(config)
    grants, states = active_states()

    defaults = [pilot.run_pilot(copy.deepcopy(item), config=config) for item in states]
    defaults2 = [pilot.run_pilot(copy.deepcopy(item), config=config) for item in states]
    assert defaults == defaults2
    for receipt in defaults:
        assert receipt["decision"] == "TRIAL_PILOT_NOT_STARTED"
        assert receipt["trial_pilot_ready"] is False
        assert receipt["pilot_run_ref"] is None
        assert receipt["network_io_performed"] is False
        assert receipt["game_process_accessed"] is False
        assert receipt["audio_capture_started"] is False
        assert receipt["background_activity_started"] is False

    ready_receipts = []
    for item in states:
        context = ready_context(item, config)
        receipt = pilot.run_pilot(copy.deepcopy(item), context, config)
        ready_receipts.append(receipt)
        assert receipt["decision"] == "LOCAL_SYNTHETIC_TRIAL_PILOT_READY"
        assert receipt["trial_pilot_ready"] is True
        assert receipt["stdout_receipt_ready"] is True
        assert len(receipt["pilot_run_ref"]) == 64
        assert receipt["human_external_sandbox_pilot_decision_required"] is True
        assert receipt["human_external_sandbox_pilot_decision_present"] is False
        assert receipt["pilot_mode"] == "LOCAL_SYNTHETIC_NULL_TRANSPORT"
        assert receipt["input_source"] == "DETERMINISTIC_SYNTHETIC_FIXTURE_ONLY"
        assert receipt["cpu_profile"] == "BOUNDED_SINGLE_SHOT_NO_POLLING"
        assert receipt["transport_mode"] == "NULL_TRANSPORT"
        assert receipt["game_integration_mode"] == "NONE"
        assert receipt["audio_mode"] == "NONE"
        assert receipt["network_access"] is False
        assert receipt["game_process_access"] is False
        assert receipt["game_file_modification"] is False
        assert receipt["audio_capture"] is False
        assert receipt["microphone_capture"] is False
        assert receipt["background_loop"] is False
        assert receipt["polling"] is False
        assert receipt["persistent_output"] is False
        assert receipt["network_io_performed"] is False
        assert receipt["game_process_accessed"] is False
        assert receipt["game_files_modified"] is False
        assert receipt["audio_capture_started"] is False
        assert receipt["microphone_capture_started"] is False
        assert receipt["background_activity_started"] is False
        assert receipt["polling_started"] is False
        assert receipt["persistent_output_written"] is False
        assert receipt["network_enabled"] is False
        assert receipt["user_surface_enabled"] is False
        assert receipt["external_transport_bound"] is False
        assert receipt["send_permit"] is False
        assert receipt["transport_invoked"] is False
        assert receipt["copyright_process_modified"] is False
        assert receipt["license_or_notice_modified"] is False
        assert receipt["legal_author_identity_modified"] is False
        assert receipt["pseudonym_publication_process_modified"] is False
        assert receipt["authority_effect"] == "NONE"
        assert receipt["action_effect"] == "NONE"
        assert receipt["successor_effect"] == "NONE"
        assert receipt["runtime_connectedness"] == "LOCAL_SYNTHETIC_TRIAL_ONLY_NOT_EXTERNAL"
        assert len(receipt["local_trial_pilot_receipt_digest"]) == 64
        pilot.validate_pilot_receipt(item, config, context, receipt)

    partial_context = pilot.default_pilot_context(states[-1], config)
    partial_context["pilot_run_requested"] = True
    partial = pilot.run_pilot(copy.deepcopy(states[-1]), partial_context, config)
    assert partial["decision"] == "PILOT_PRECHECK_REQUIRED"
    assert partial["trial_pilot_ready"] is False

    inactive_state = pilot.materialize.materialize(copy.deepcopy(grants[-1]))
    assert inactive_state["decision"] == "ENABLEMENT_NOT_MATERIALIZED"
    not_applicable = pilot.run_pilot(copy.deepcopy(inactive_state), config=config)
    assert not_applicable["decision"] == "NOT_APPLICABLE"
    assert not_applicable["trial_pilot_ready"] is False

    for scenario, expected in (
        ("safe-default", "TRIAL_PILOT_NOT_STARTED"),
        ("synthetic-ready", "LOCAL_SYNTHETIC_TRIAL_PILOT_READY"),
    ):
        completed = subprocess.run(
            [sys.executable, str(RUN), "--scenario", scenario],
            check=True,
            capture_output=True,
            text=True,
        )
        cli_receipt = json.loads(completed.stdout)
        assert cli_receipt["decision"] == expected
        assert cli_receipt["network_io_performed"] is False
        assert cli_receipt["game_process_accessed"] is False
        assert cli_receipt["audio_capture_started"] is False
        assert cli_receipt["background_activity_started"] is False

    rejected_mutations = 0

    def reject_output(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(states[-1])
        context = ready_context(item, config)
        output = pilot.run_pilot(copy.deepcopy(item), copy.deepcopy(context), config)
        try:
            mutate(output)
            pilot.validate_pilot_receipt(item, config, context, output)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe trial pilot output mutation accepted")

    def reject_context(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(states[-1])
        context = ready_context(item, config)
        try:
            mutate(context)
            pilot.run_pilot(copy.deepcopy(item), context, config)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe trial pilot context mutation accepted")

    def reject_config(mutate):
        nonlocal rejected_mutations
        bad_config = copy.deepcopy(config)
        try:
            mutate(bad_config)
            pilot.run_pilot(copy.deepcopy(states[-1]), config=bad_config)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe trial pilot config mutation accepted")

    def reject_source(mutate):
        nonlocal rejected_mutations
        item = copy.deepcopy(states[-1])
        try:
            mutate(item)
            pilot.run_pilot(item, config=config)
        except (ValueError, AssertionError, KeyError, TypeError):
            rejected_mutations += 1
            return
        raise AssertionError("unsafe trial pilot source mutation accepted")

    output_mutations = [
        lambda receipt: receipt.__setitem__("decision", "EXTERNAL_PILOT_STARTED"),
        lambda receipt: receipt.__setitem__("pilot_scope", "ALL_SESSIONS"),
        lambda receipt: receipt.__setitem__("pilot_mode", "LIVE_GAME_NETWORK"),
        lambda receipt: receipt.__setitem__("input_source", "LIVE_GAME_OBSERVATION"),
        lambda receipt: receipt.__setitem__("session_scope", "PERSISTENT"),
        lambda receipt: receipt.__setitem__("output_mode", "NETWORK_DELIVERY"),
        lambda receipt: receipt.__setitem__("cpu_profile", "CONTINUOUS_POLLING"),
        lambda receipt: receipt.__setitem__("transport_mode", "EXTERNAL_TRANSPORT"),
        lambda receipt: receipt.__setitem__("game_integration_mode", "PROCESS_INJECTION"),
        lambda receipt: receipt.__setitem__("audio_mode", "MICROPHONE_CAPTURE"),
        lambda receipt: receipt.__setitem__("pilot_run_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("human_external_sandbox_pilot_decision_present", True),
        lambda receipt: receipt.__setitem__("source_enablement_materialization_receipt_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("enablement_state_ref", "0" * 64),
        lambda receipt: receipt.__setitem__("pilot_context_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("pilot_config_digest", "0" * 64),
        lambda receipt: receipt.__setitem__("pilot_effect", "SEND_MESSAGE"),
        lambda receipt: receipt.__setitem__("authority_effect", "CREATE_AUTHORITY"),
        lambda receipt: receipt.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda receipt: receipt.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
        lambda receipt: receipt.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for field in pilot.FALSE_CONFIG_FIELDS + pilot.FALSE_EFFECTS:
        output_mutations.append(
            lambda receipt, key=field: receipt.__setitem__(key, True)
        )
    for mutation in output_mutations:
        reject_output(mutation)

    context_mutations = [
        lambda context: context.__setitem__("source_enablement_materialization_receipt_digest", "0" * 64),
        lambda context: context.__setitem__("pilot_config_digest", "0" * 64),
        lambda context: context.__setitem__("pilot_scope", "ALL_SESSIONS"),
        lambda context: context.__setitem__("next_decision_boundary", "DECISION_NOT_REQUIRED"),
        lambda context: context.__setitem__("enablement_state_ref", "0" * 64),
        lambda context: context.__setitem__("materialized_state_current_confirmed", "yes"),
        lambda context: context.__setitem__("authority_effect", "CREATE_AUTHORITY"),
        lambda context: context.__setitem__("action_effect", "CREATE_ACTION_PERMIT"),
        lambda context: context.__setitem__("successor_effect", "CREATE_SUCCESSOR_PERMIT"),
    ]
    for field in pilot.FORBIDDEN_REQUESTS:
        context_mutations.append(
            lambda context, key=field: context.__setitem__(key, True)
        )
    for mutation in context_mutations:
        reject_context(mutation)

    config_mutations = [
        lambda value: value.__setitem__("pilot_mode", "LIVE_GAME_NETWORK"),
        lambda value: value.__setitem__("input_source", "LIVE_GAME_OBSERVATION"),
        lambda value: value.__setitem__("session_scope", "PERSISTENT"),
        lambda value: value.__setitem__("output_mode", "NETWORK_DELIVERY"),
        lambda value: value.__setitem__("cpu_profile", "CONTINUOUS_POLLING"),
        lambda value: value.__setitem__("transport_mode", "EXTERNAL_TRANSPORT"),
        lambda value: value.__setitem__("game_integration_mode", "PROCESS_INJECTION"),
        lambda value: value.__setitem__("audio_mode", "MICROPHONE_CAPTURE"),
        lambda value: value.__setitem__("unexpected_capability", True),
    ]
    for field in pilot.FALSE_CONFIG_FIELDS:
        config_mutations.append(
            lambda value, key=field: value.__setitem__(key, True)
        )
    for mutation in config_mutations:
        reject_config(mutation)

    source_mutations = [
        lambda item: item.__setitem__("decision", "ENABLEMENT_NOT_MATERIALIZED"),
        lambda item: item.__setitem__("enablement_materialization_receipt_digest", "0" * 64),
        lambda item: item.__setitem__("enablement_state_ref", "0" * 64),
        lambda item: item.__setitem__("enablement_state_local_only", False),
        lambda item: item.__setitem__("enablement_state_reversible", False),
        lambda item: item.__setitem__("network_enabled", True),
        lambda item: item.__setitem__("user_surface_enabled", True),
        lambda item: item.__setitem__("send_permit", True),
        lambda item: item.__setitem__("copyright_process_modified", True),
        lambda item: item.__setitem__("runtime_connectedness", "EXTERNAL_CONNECTED"),
    ]
    for mutation in source_mutations:
        reject_source(mutation)

    final = ready_receipts[-1]
    print(
        "KONTUR local synthetic trial pilot validation: PASS; "
        f"pilot_runs={len(ready_receipts)}; cli_scenarios=2; "
        f"fail_closed_mutations={rejected_mutations}; "
        f"final_local_trial_pilot_receipt_digest={final['local_trial_pilot_receipt_digest']}"
    )


if __name__ == "__main__":
    main()
