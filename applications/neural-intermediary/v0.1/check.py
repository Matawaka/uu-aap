# SPDX-License-Identifier: Apache-2.0
"""Small independent report checker. Never imports the producer or its verdict logic.

Checks finite semantic invariants against caller-selected source inputs. This is
implementation diversity, not an independent organization or proof of truth.
"""
from datetime import datetime, timezone
import hashlib
import json


def _hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=True, sort_keys=True,
                                    separators=(",", ":"), allow_nan=False).encode("ascii")).hexdigest()


def verify(policy, observations, report):
    problems = []
    def expect(ok, code):
        if not ok:
            problems.append(code)
    try:
        expected_keys = {"schema", "scope", "policy_sha256", "observations_sha256", "evaluation_time", "decision", "value",
                         "observed_values", "support_groups", "sensor_groups", "missing_sensors", "unknown_sensors",
                         "undeclared_independence", "pressure_sensors", "excluded", "counts", "boundaries", "report_sha256"}
        expect(type(report) is dict and set(report) == expected_keys, "REPORT_FIELDS")
        if problems:
            return {"status": "REJECTED", "problems": problems}
        expect(type(report["counts"]) is dict and all(type(v) is int for v in report["counts"].values()), "COUNT_TYPES")
        expect(type(report["boundaries"]) is dict and all(v is False for v in report["boundaries"].values()), "BOUNDARY_TYPES")
        expect(policy["schema"] == "matawaka.intermediary.policy/v0.1", "SOURCE_POLICY_VERSION")
        expect(type(policy["quorum"]) is int and 2 <= policy["quorum"] <= 16, "SOURCE_QUORUM")
        expect(all(type(policy[k]) is int and policy[k] > 0 for k in ("max_age_seconds", "max_observations", "max_per_sensor")), "SOURCE_LIMITS")
        expect(report["schema"] == "matawaka.intermediary.report/v0.1", "REPORT_VERSION")
        expect(report["policy_sha256"] == _hash(policy), "POLICY_BINDING")
        expect(report["observations_sha256"] == _hash(observations), "OBSERVATION_BINDING")
        expect(report["report_sha256"] == _hash({k: v for k, v in report.items() if k != "report_sha256"}), "REPORT_DIGEST")
        expect(report["scope"] == {k: policy[k] for k in ("tenant", "compartment", "purpose", "subject", "claim")}, "SCOPE")
        expect(report["evaluation_time"] == policy["evaluation_time"], "TIME_BINDING")
        expect(report["boundaries"] == {"truth_established": False, "independence_authenticated": False,
                                       "external_action_authorized": False, "provider_called": False,
                                       "runtime_isolation_established": False}, "BOUNDARY_ESCALATION")
        expect(type(observations) is list and len(observations) <= policy["max_observations"], "SOURCE_BUDGET")
        inventory = {sensor["id"]: sensor for sensor in policy["sensors"]}
        expect(len(inventory) == len(policy["sensors"]), "SOURCE_DUPLICATE_SENSOR")
        expect(len({row["id"] for row in observations}) == len(observations), "SOURCE_DUPLICATE_OBSERVATION")
        # Graph traversal rather than producer's disjoint-set implementation.
        adjacent = {key: set() for key in inventory}
        for a, left in inventory.items():
            for b, right in inventory.items():
                if any(left[key] == right[key] for key in ("provider", "operator", "model_family", "source_root")):
                    adjacent[a].add(b)
        component = {}
        for start in sorted(inventory):
            pending, visited = [start], set()
            while pending:
                node = pending.pop()
                if node not in visited:
                    visited.add(node)
                    pending.extend(adjacent[node] - visited)
            component[start] = min(visited)
        expect(report["sensor_groups"] == component, "CORRELATION_PARTITION")
        moment = lambda text: datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        fresh, excluded = [], []
        for row in observations:
            expect(set(row) == {"schema", "id", "tenant", "compartment", "purpose", "subject", "claim", "sensor_id", "value", "observed_at", "note"}, "SOURCE_FIELDS")
            expect(row["schema"] == "matawaka.intermediary.observation/v0.1", "SOURCE_VERSION")
            expect(all(row[k] == policy[k] for k in ("tenant", "compartment", "purpose", "subject", "claim")), "SOURCE_SCOPE")
            expect(row["sensor_id"] in inventory, "SOURCE_SENSOR")
            expect(row["value"] in policy["allowed_values"] + ["unknown"], "SOURCE_VALUE")
            delta = (moment(policy["evaluation_time"]) - moment(row["observed_at"])).total_seconds()
            if 0 <= delta <= policy["max_age_seconds"]:
                fresh.append(row)
            else:
                excluded.append({"id": row["id"], "reason": "FUTURE" if delta < 0 else "STALE"})
        expect(report["excluded"] == sorted(excluded, key=lambda r: r["id"]), "FRESHNESS")
        values = sorted(set(row["value"] for row in fresh) - {"unknown"})
        supporters = {value: sorted({component[row["sensor_id"]] for row in fresh
                                    if row["value"] == value and inventory[row["sensor_id"]]["independence"] == "declared"}) for value in values}
        absent = sorted(set(inventory) - {r["sensor_id"] for r in fresh if r["value"] != "unknown"})
        unknown = sorted({r["sensor_id"] for r in fresh if r["value"] == "unknown"})
        undeclared = sorted({r["sensor_id"] for r in fresh if inventory[r["sensor_id"]]["independence"] == "unknown"})
        overloaded = sorted(s for s in inventory if sum(r["sensor_id"] == s for r in fresh) > policy["max_per_sensor"])
        expect(report["observed_values"] == values, "CONTRADICTIONS")
        expect(report["support_groups"] == supporters, "SUPPORT")
        expect(report["missing_sensors"] == absent and report["unknown_sensors"] == unknown
               and report["undeclared_independence"] == undeclared, "MISSINGNESS")
        expect(report["pressure_sensors"] == overloaded, "PRESSURE")
        relations = len({(r["sensor_id"], r["value"]) for r in fresh})
        expect(report["counts"] == {"received": len(observations), "fresh": len(fresh),
                                    "operational_relations": relations, "repeated_relations": len(fresh) - relations}, "COUNTS")
        expected = "INSUFFICIENT_EVIDENCE"
        if len(values) >= 2:
            expected = "DISPUTED"
        elif overloaded:
            expected = "PRESSURE_LIMITED"
        elif len(values) == 1 and not (absent or unknown or undeclared) and len(supporters[values[0]]) >= policy["quorum"]:
            expected = "CORROBORATED_UNDER_DECLARED_MODEL"
        expect(report["decision"] == expected, "VERDICT")
        expect(report["value"] == (values[0] if expected == "CORROBORATED_UNDER_DECLARED_MODEL" else None), "VALUE_ESCALATION")
    except (KeyError, TypeError, ValueError, RecursionError, OverflowError, AttributeError):
        problems.append("MALFORMED_INPUT")
    return {"status": "CHECKED_BOUNDED" if not problems else "REJECTED", "problems": sorted(set(problems))}
