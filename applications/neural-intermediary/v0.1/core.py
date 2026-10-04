# SPDX-License-Identifier: Apache-2.0
"""Offline corporate evidence intermediary. Caller-owned policy is the trust input.

No provider calls, credentials, execution, learning, or inferred authorization.
Correlation labels are declared administrative metadata, not independence proof.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import re

POLICY = "matawaka.intermediary.policy/v0.1"
OBSERVATION = "matawaka.intermediary.observation/v0.1"
REPORT = "matawaka.intermediary.report/v0.1"
MAX_BYTES = 262144
MAX_ROWS = 256
MAX_SENSORS = 16
BOUNDARY = {
    "truth_established": False,
    "independence_authenticated": False,
    "external_action_authorized": False,
    "provider_called": False,
    "runtime_isolation_established": False,
}


class Refused(ValueError):
    """A fixed machine code, never rejected user text."""


def require(condition, code):
    if not condition:
        raise Refused(code)


def exact(value, keys, code):
    require(type(value) is dict and set(value) == set(keys.split()), code)


def token(value):
    require(type(value) is str and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}", value), "invalid_identifier")
    return value


def bounded_int(value, low, high):
    require(type(value) is int and low <= value <= high, "invalid_integer")


def timestamp(value):
    require(type(value) is str and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value), "invalid_time")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        raise Refused("invalid_time") from None


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("ascii")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def parse(data):
    require(type(data) is bytes and len(data) <= MAX_BYTES, "input_byte_limit")
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate_json_key")
            result[key] = value
        return result
    def reject_number(_):
        raise Refused("unsupported_number")
    try:
        result = json.loads(data.decode("utf-8"), object_pairs_hook=pairs,
                            parse_constant=reject_number, parse_float=reject_number)
    except Refused:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise Refused("invalid_json") from None
    stack = [(result, 0)]
    count = 0
    while stack:
        value, depth = stack.pop()
        count += 1
        require(depth <= 16 and count <= 12000, "json_structure_limit")
        if type(value) is dict:
            stack.extend((v, depth + 1) for v in value.values())
        elif type(value) is list:
            stack.extend((v, depth + 1) for v in value)
        elif type(value) is str:
            try:
                require(len(value.encode("utf-8")) <= 4096, "string_limit")
            except UnicodeError:
                raise Refused("invalid_unicode") from None
        elif type(value) is int:
            require(abs(value) <= 2**53 - 1, "integer_range")
        else:
            require(value is None or type(value) is bool, "unsupported_json_type")
    return result


def validate_policy(policy):
    exact(policy, "schema tenant compartment purpose subject claim evaluation_time max_age_seconds quorum max_observations max_per_sensor allowed_values sensors", "policy_shape")
    require(policy["schema"] == POLICY, "policy_version")
    for field in ("tenant", "compartment", "purpose", "subject", "claim"):
        token(policy[field])
    timestamp(policy["evaluation_time"])
    bounded_int(policy["max_age_seconds"], 1, 86400)
    bounded_int(policy["max_observations"], 1, MAX_ROWS)
    bounded_int(policy["max_per_sensor"], 1, MAX_ROWS)
    bounded_int(policy["quorum"], 2, MAX_SENSORS)
    values = policy["allowed_values"]
    require(type(values) is list and 2 <= len(values) <= 8, "value_inventory")
    for value in values:
        token(value)
    require(len(set(values)) == len(values) and "unknown" not in values, "value_inventory")
    sensors = policy["sensors"]
    require(type(sensors) is list and 1 <= len(sensors) <= MAX_SENSORS, "sensor_inventory")
    ids = []
    for sensor in sensors:
        exact(sensor, "id provider operator model_family source_root independence", "sensor_shape")
        for field in ("id", "provider", "operator", "model_family", "source_root"):
            token(sensor[field])
        require(sensor["independence"] in ("declared", "unknown"), "independence_status")
        ids.append(sensor["id"])
    require(len(set(ids)) == len(ids), "duplicate_sensor")
    return policy


def correlation_groups(policy):
    """Conservative transitive components over the whole configured inventory."""
    sensors = policy["sensors"]
    roots = {s["id"]: s["id"] for s in sensors}
    def root(key):
        while roots[key] != key:
            key = roots[key]
        return key
    fields = ("provider", "operator", "model_family", "source_root")
    for left in sensors:
        for right in sensors:
            if any(left[field] == right[field] for field in fields):
                a, b = root(left["id"]), root(right["id"])
                roots[max(a, b)] = min(a, b)
    return {key: root(key) for key in sorted(roots)}


def validate_observations(policy, observations):
    require(type(observations) is list, "observations_shape")
    require(len(observations) <= policy["max_observations"], "batch_pressure_limit")
    known = {s["id"] for s in policy["sensors"]}
    ids = []
    for row in observations:
        exact(row, "schema id tenant compartment purpose subject claim sensor_id value observed_at note", "observation_shape")
        require(row["schema"] == OBSERVATION, "observation_version")
        token(row["id"])
        for field in ("tenant", "compartment", "purpose", "subject", "claim"):
            require(row[field] == policy[field], "flow_boundary_mismatch")
        require(type(row["sensor_id"]) is str and row["sensor_id"] in known, "unknown_sensor")
        require(type(row["value"]) is str and row["value"] in policy["allowed_values"] + ["unknown"], "unknown_value")
        timestamp(row["observed_at"])
        require(type(row["note"]) is str and len(row["note"].encode("utf-8")) <= 2048, "note_limit")
        ids.append(row["id"])
    require(len(set(ids)) == len(ids), "duplicate_observation_id")


def evaluate(policy, observations):
    validate_policy(policy)
    validate_observations(policy, observations)
    groups = correlation_groups(policy)
    sensors = {s["id"]: s for s in policy["sensors"]}
    now = timestamp(policy["evaluation_time"])
    counts = {key: 0 for key in sensors}
    active = []
    excluded = []
    for row in observations:
        age = (now - timestamp(row["observed_at"])).total_seconds()
        if age < 0 or age > policy["max_age_seconds"]:
            excluded.append({"id": row["id"], "reason": "FUTURE" if age < 0 else "STALE"})
            continue
        counts[row["sensor_id"]] += 1
        active.append(row)
    overloaded = sorted(key for key, count in counts.items() if count > policy["max_per_sensor"])
    # Never truncate observations before checking contradictions.
    distinct = sorted({row["value"] for row in active if row["value"] != "unknown"})
    support = {}
    for value in distinct:
        support[value] = sorted({groups[row["sensor_id"]] for row in active
                                 if row["value"] == value and sensors[row["sensor_id"]]["independence"] == "declared"})
    seen = {row["sensor_id"] for row in active if row["value"] != "unknown"}
    missing = sorted(set(sensors) - seen)
    unresolved = sorted({row["sensor_id"] for row in active if row["value"] == "unknown"})
    undeclared = sorted({row["sensor_id"] for row in active if sensors[row["sensor_id"]]["independence"] == "unknown"})
    if len(distinct) > 1:
        decision = "DISPUTED"
    elif overloaded:
        decision = "PRESSURE_LIMITED"
    elif not distinct or missing or unresolved or undeclared:
        decision = "INSUFFICIENT_EVIDENCE"
    elif len(support[distinct[0]]) >= policy["quorum"]:
        decision = "CORROBORATED_UNDER_DECLARED_MODEL"
    else:
        decision = "INSUFFICIENT_EVIDENCE"
    unique = {(row["sensor_id"], row["value"]) for row in active}
    report = {
        "schema": REPORT,
        "scope": {k: policy[k] for k in ("tenant", "compartment", "purpose", "subject", "claim")},
        "policy_sha256": digest(policy), "observations_sha256": digest(observations),
        "evaluation_time": policy["evaluation_time"], "decision": decision,
        "value": distinct[0] if decision == "CORROBORATED_UNDER_DECLARED_MODEL" else None,
        "observed_values": distinct, "support_groups": support, "sensor_groups": groups,
        "missing_sensors": missing, "unknown_sensors": unresolved,
        "undeclared_independence": undeclared, "pressure_sensors": overloaded,
        "excluded": sorted(excluded, key=lambda x: x["id"]),
        "counts": {"received": len(observations), "fresh": len(active),
                   "operational_relations": len(unique), "repeated_relations": len(active) - len(unique)},
        "boundaries": dict(BOUNDARY),
    }
    report["report_sha256"] = digest(report)
    return report


def prepare_egress(policy, request):
    """Build a minimized, non-actuating request from a separately selected policy.

    No free text is sent: policy-bound public subject/claim tokens only. A tenant
    must explicitly approve even these values before a real transport is added.
    """
    exact(policy, "schema tenant purpose compartment provider subject claim allowed_request_fields", "egress_policy_shape")
    require(policy["schema"] == "matawaka.intermediary.egress-policy/v0.1", "egress_policy_version")
    for key in ("tenant", "purpose", "compartment", "provider", "subject", "claim"):
        token(policy[key])
    require(policy["allowed_request_fields"] == ["subject", "claim"], "egress_field_allowlist")
    exact(request, "tenant purpose compartment subject claim", "egress_request_shape")
    require(all(request[k] == policy[k] for k in request), "egress_scope_mismatch")
    return {"schema": "matawaka.intermediary.egress-candidate/v0.1",
            "provider": policy["provider"], "payload": {k: request[k] for k in ("subject", "claim")},
            "policy_sha256": digest(policy), "request_sha256": digest(request),
            "network_send_authorized": False}


def join_reports(policy, reports):
    """A scoped conjunction; no global trust score or automatic external action."""
    exact(policy, "schema tenant purpose destination inputs", "join_policy_shape")
    require(policy["schema"] == "matawaka.intermediary.join-policy/v0.1", "join_policy_version")
    for key in ("tenant", "purpose", "destination"):
        token(policy[key])
    require(type(policy["inputs"]) is list and 2 <= len(policy["inputs"]) <= 8, "join_inventory")
    required = []
    for item in policy["inputs"]:
        exact(item, "compartment subject claim report_sha256", "join_input_shape")
        require(type(item["report_sha256"]) is str and re.fullmatch(r"[0-9a-f]{64}", item["report_sha256"]), "join_pin_shape")
        required.append(tuple(token(item[k]) for k in ("compartment", "subject", "claim")))
    require(len(set(required)) == len(required), "join_duplicate_input")
    require(type(reports) is list and len(reports) == len(required), "join_report_inventory")
    seen = []
    selected = []
    for report in reports:
        require(type(report) is dict, "join_report_shape")
        unsigned = {k: v for k, v in report.items() if k != "report_sha256"}
        require(report.get("schema") == REPORT and report.get("report_sha256") == digest(unsigned), "join_report_integrity")
        require(report.get("boundaries") == BOUNDARY and all(v is False for v in report["boundaries"].values()), "join_boundary_escalation")
        scope = report.get("scope")
        exact(scope, "tenant compartment purpose subject claim", "join_scope_shape")
        require(scope["tenant"] == policy["tenant"] and scope["purpose"] == policy["purpose"], "join_scope_mismatch")
        identity = tuple(scope[k] for k in ("compartment", "subject", "claim"))
        require(identity in required and identity not in seen, "join_unselected_input")
        selected_pin = policy["inputs"][required.index(identity)]["report_sha256"]
        require(report["report_sha256"] == selected_pin, "join_report_pin_mismatch")
        seen.append(identity)
        selected.append({"compartment": scope["compartment"], "subject": scope["subject"], "claim": scope["claim"],
                         "decision": report["decision"], "value": report["value"], "report_sha256": report["report_sha256"]})
    result = {"schema": "matawaka.intermediary.join/v0.1", "tenant": policy["tenant"],
              "purpose": policy["purpose"], "destination": policy["destination"],
              "policy_sha256": digest(policy), "items": sorted(selected, key=lambda x: (x["compartment"], x["claim"])),
              "decision": "READY_FOR_HUMAN_REVIEW" if all(r["decision"] == "CORROBORATED_UNDER_DECLARED_MODEL" for r in reports) else "HOLD",
              "input_integrity_only": True, "input_origin_authenticated": False,
              "external_action_authorized": False}
    return result
