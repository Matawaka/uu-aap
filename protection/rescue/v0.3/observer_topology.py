#!/usr/bin/env python3
import argparse
import copy
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def canonical_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def file_sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_time(value):
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return dt.astimezone(timezone.utc)


def iso_z(dt):
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path):
    with Path(path).open(encoding="utf-8") as f:
        return json.load(f)


def validate_attestation(a, now, req):
    reasons = []
    required = [
        "artifact_type", "artifact_version", "attestation_id", "observer_id",
        "observer_spec_sha256", "attestor_id", "attestor_domain_id", "issued_at",
        "valid_until", "deployment_domains", "evidence", "claims"
    ]
    for key in required:
        if key not in a:
            reasons.append(f"missing:{key}")
    if reasons:
        return reasons, False
    if a["artifact_type"] != "ObserverDeploymentAttestation" or a["artifact_version"] != "0.3":
        reasons.append("wrong_artifact_type_or_version")
    if not HEX64.fullmatch(str(a.get("observer_spec_sha256", ""))):
        reasons.append("invalid_observer_spec_sha256")
    domains = a.get("deployment_domains")
    domain_keys = ["observer_domain_id", "failure_domain_id", "custodian_domain_id", "provider_domain_id", "network_domain_id"]
    if not isinstance(domains, dict) or any(not domains.get(k) for k in domain_keys):
        reasons.append("invalid_deployment_domains")
    evidence = a.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        reasons.append("missing_evidence")
    else:
        for i, item in enumerate(evidence):
            if not isinstance(item, dict) or not item.get("evidence_class") or not item.get("evidence_ref") or not HEX64.fullmatch(str(item.get("evidence_sha256", ""))):
                reasons.append(f"invalid_evidence:{i}")
    claims = a.get("claims")
    expected_claims = {
        "observer_self_attestation": False,
        "deployment_evidence_reviewed": True,
        "contains_credentials": False,
        "canonical_authority_granted": False,
        "loss_confirmed": False,
        "rescue_eligible": False,
        "universal_physical_independence_proven": False,
    }
    if not isinstance(claims, dict) or any(claims.get(k) is not v for k, v in expected_claims.items()):
        reasons.append("invalid_authority_or_security_claims")
    try:
        issued = parse_time(a["issued_at"])
        valid_until = parse_time(a["valid_until"])
        if valid_until <= issued:
            reasons.append("nonpositive_validity_window")
        expired = now > valid_until
        if req.get("reject_expired", True) and expired:
            reasons.append("expired")
    except Exception:
        reasons.append("invalid_timestamp")
        expired = False
    if req.get("require_non_self_attestation", True) and a.get("attestor_id") == a.get("observer_id"):
        reasons.append("self_attestation")
    if req.get("require_distinct_attestor_from_observer_domain", True) and isinstance(domains, dict) and a.get("attestor_domain_id") == domains.get("observer_domain_id"):
        reasons.append("attestor_domain_equals_observer_domain")
    if req.get("require_evidence_digest", True) and isinstance(evidence, list) and not all(HEX64.fullmatch(str(x.get("evidence_sha256", ""))) for x in evidence if isinstance(x, dict)):
        reasons.append("evidence_digest_required")
    return reasons, expired


def evaluate(policy_path, attestations_dir, out_path, at=None):
    policy = load_json(policy_path)
    if policy.get("artifact_type") != "ObserverTopologyPolicy" or policy.get("artifact_version") != "0.3":
        raise ValueError("unsupported observer topology policy")
    now = parse_time(at) if at else datetime.now(timezone.utc)
    directory = Path(attestations_dir)
    paths = sorted(p for p in directory.glob("*.json") if p.is_file())
    if not paths:
        raise ValueError("no attestation JSON files found")

    bindings = [{"name": p.name, "sha256": file_sha256(p)} for p in paths]
    set_sha = sha256_bytes(canonical_bytes(bindings))
    req = policy["requirements"]
    valid = []
    reasons = []
    invalid_count = 0
    expired_count = 0
    seen_observers = set()

    for path in paths:
        try:
            a = load_json(path)
        except Exception as exc:
            invalid_count += 1
            reasons.append(f"{path.name}:json_error:{type(exc).__name__}")
            continue
        item_reasons, expired = validate_attestation(a, now, req)
        if expired:
            expired_count += 1
        if req.get("reject_duplicate_observer_ids", True) and a.get("observer_id") in seen_observers:
            item_reasons.append("duplicate_observer_id")
        if a.get("observer_id"):
            seen_observers.add(a["observer_id"])
        if item_reasons:
            invalid_count += 1
            reasons.extend(f"{path.name}:{r}" for r in sorted(set(item_reasons)))
            continue
        valid.append(a)

    def distinct(field):
        return len({a[field] for a in valid})

    metrics = {
        "attested_observers": len(valid),
        "observer_domains": len({a["deployment_domains"]["observer_domain_id"] for a in valid}),
        "failure_domains": len({a["deployment_domains"]["failure_domain_id"] for a in valid}),
        "custodian_domains": len({a["deployment_domains"]["custodian_domain_id"] for a in valid}),
        "attestor_domains": distinct("attestor_domain_id"),
        "provider_domains": len({a["deployment_domains"]["provider_domain_id"] for a in valid}),
        "network_domains": len({a["deployment_domains"]["network_domain_id"] for a in valid}),
        "evidence_classes": len({e["evidence_class"] for a in valid for e in a["evidence"]}),
        "expired_attestations": expired_count,
        "invalid_attestations": invalid_count,
    }

    minima = policy["minimums"]
    metric_map = {
        "attested_observers": "attested_observers",
        "observer_domains": "observer_domains",
        "failure_domains": "failure_domains",
        "custodian_domains": "custodian_domains",
        "attestor_domains": "attestor_domains",
        "provider_domains": "provider_domains",
        "evidence_classes": "evidence_classes",
    }
    sufficient = invalid_count == 0
    for policy_key, metric_key in metric_map.items():
        required = int(minima[policy_key])
        actual = int(metrics[metric_key])
        if actual < required:
            sufficient = False
            reasons.append(f"minimum_not_met:{policy_key}:{actual}<{required}")

    decision = "independence_sufficient_for_policy" if sufficient else "independence_insufficient_for_policy"
    assessment = {
        "artifact_type": "ObserverTopologyAssessment",
        "artifact_version": "0.3",
        "assessment_id": "observer-topology-" + set_sha[:16],
        "evaluated_at": iso_z(now),
        "policy_sha256": file_sha256(policy_path),
        "attestation_set_sha256": set_sha,
        "metrics": metrics,
        "decision": decision,
        "reasons": sorted(set(reasons)),
        "assessment_sha256": "0" * 64,
        "claims": {
            "independence_sufficient_for_policy": sufficient,
            "universal_physical_independence_proven": False,
            "loss_confirmed": False,
            "rescue_eligible": False,
            "execution_authority_granted": False,
            "canonical_successor_established": False,
        },
    }
    digestable = copy.deepcopy(assessment)
    digestable["assessment_sha256"] = "0" * 64
    assessment["assessment_sha256"] = sha256_bytes(canonical_bytes(digestable))
    Path(out_path).write_text(json.dumps(assessment, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return assessment


def main():
    parser = argparse.ArgumentParser(description="Assess policy-bounded observer deployment independence")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("evaluate")
    p.add_argument("--policy", required=True)
    p.add_argument("--attestations-dir", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--at", help="ISO-8601 evaluation time for deterministic verification/tests")
    args = parser.parse_args()
    try:
        result = evaluate(args.policy, args.attestations_dir, args.out, args.at)
    except Exception as exc:
        print(f"observer topology assessment failed: {exc}", file=sys.stderr)
        return 2
    print(result["decision"])
    return 0 if result["claims"]["independence_sufficient_for_policy"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
