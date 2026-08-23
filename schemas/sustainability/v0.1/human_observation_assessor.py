#!/usr/bin/env python3

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_WINDOW_SECONDS = 60 * 60


def parse_time(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("timestamps must be timezone-aware")
    return dt.astimezone(timezone.utc)


def expected_assessment(signals):
    signal_set = set(signals)
    if "explicit_pause_request" in signal_set:
        return "explicit-pause", "honor-explicit-pause"
    if "explicit_reduce_pace_request" in signal_set:
        return "adaptation-suggested", "reduce-decision-density"
    if signal_set.intersection({"repeated_retries", "repeated_corrections", "interaction_looping"}):
        return "adaptation-suggested", "suggest-checkpoint"
    if "high_decision_density" in signal_set:
        return "adaptation-suggested", "reduce-decision-density"
    return "stable", "no-change"


def assess(payload):
    if payload.get("document_type") != "uu-aap.sustainability-human-observation":
        raise ValueError("unexpected document_type")
    if payload.get("version") != "0.1":
        raise ValueError("unexpected version")

    subject = payload["subject"]
    if subject.get("scope") != "interaction-process-only":
        raise ValueError("observation scope must remain interaction-process-only")

    window = payload["observation_window"]
    if window.get("bounded") is not True:
        raise ValueError("observation must be bounded")
    if window.get("continuous_monitoring") is not False:
        raise ValueError("continuous monitoring is forbidden")
    if not isinstance(window.get("event_count"), int) or not (0 <= window["event_count"] <= 100):
        raise ValueError("event_count outside v0.1 bound")

    started = parse_time(window["started_at"])
    ended = parse_time(window["ended_at"])
    if ended < started:
        raise ValueError("observation window ends before it starts")
    if (ended - started).total_seconds() > MAX_WINDOW_SECONDS:
        raise ValueError("observation window exceeds 60 minutes")

    policy = payload["policy"]
    required_false = [
        "provocation_used",
        "medical_inference",
        "biometric_inference",
        "hidden_psychological_scoring",
        "fitness_determination",
        "authority_reduction_allowed",
        "automatic_external_action",
        "continuous_monitoring",
        "stores_sensitive_health_data",
    ]
    for key in required_false:
        if policy.get(key) is not False:
            raise ValueError(f"unsafe policy flag: {key}")
    if policy.get("user_visible_adaptation_only") is not True:
        raise ValueError("adaptation must remain user-visible")

    allowed_signals = {
        "explicit_pause_request",
        "explicit_reduce_pace_request",
        "repeated_retries",
        "repeated_corrections",
        "interaction_looping",
        "high_decision_density",
    }
    signals = payload["signals"]
    if len(signals) != len(set(signals)):
        raise ValueError("duplicate signals")
    unknown = set(signals) - allowed_signals
    if unknown:
        raise ValueError(f"unsupported interaction signals: {sorted(unknown)}")

    expected_result, expected_effect = expected_assessment(signals)
    assessment = payload["assessment"]
    if assessment.get("result") != expected_result:
        raise ValueError("assessment result does not match observable interaction signals")
    if assessment.get("safe_effect") != expected_effect:
        raise ValueError("safe_effect does not match observable interaction signals")

    if payload.get("authority_effect") != "none":
        raise ValueError("human observation cannot change authority")
    if payload.get("capability_effect") != "none":
        raise ValueError("human observation cannot change capability")
    if payload.get("external_execution_authorized") is not False:
        raise ValueError("human observation cannot authorize external execution")
    if payload.get("kontur_activation_authorized") is not False:
        raise ValueError("human observation cannot authorize KONTUR activation")

    return {"result": expected_result, "safe_effect": expected_effect}


def main(argv):
    if len(argv) != 2:
        raise SystemExit("usage: human_observation_assessor.py <contract.json>")
    payload = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    print(json.dumps(assess(payload), sort_keys=True))


if __name__ == "__main__":
    main(sys.argv)
