#!/usr/bin/env python3
"""Passive read-only observer runner for Project Survival Plane v0.2."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ALLOWED_METHODS = {"file_sha256", "http_head", "http_get", "git_ls_remote"}
ALLOWED_CLASSES = {"canonical_read_path", "provider_status_path", "independent_replica_path", "external_content_anchor"}


def fail(message: str) -> None:
    raise ValueError(f"Passive Observer v0.2: {message}")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_bytes(value))


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def validate_remote_target(target: str) -> None:
    if target.startswith("git@") or target.startswith("ssh://"):
        fail("SSH/credential-capable remote targets are prohibited in the passive reference runner")
    if "://" in target:
        parsed = urllib.parse.urlsplit(target)
        if parsed.username is not None or parsed.password is not None:
            fail("credential-bearing URL prohibited")
        if parsed.query or parsed.fragment:
            fail("query/fragment-bearing URL prohibited to avoid embedded secrets")
        if parsed.scheme not in {"http", "https", "file"}:
            fail("unsupported URL scheme")


def validate_spec(spec: dict[str, Any]) -> None:
    if spec.get("artifact_type") != "PassiveObserverSpec" or spec.get("artifact_version") != "0.2":
        fail("PassiveObserverSpec v0.2 required")
    if spec.get("probe_method") not in ALLOWED_METHODS:
        fail("unsupported probe_method")
    if spec.get("evidence_class") not in ALLOWED_CLASSES:
        fail("unsupported evidence_class")
    claims = spec.get("claims") or {}
    if claims.get("read_only") is not True or claims.get("may_mutate_target") is not False or claims.get("may_confirm_loss") is not False or claims.get("domain_independence_proven") is not False:
        fail("observer claims violate read-only/independence boundary")
    timeout = spec.get("timeout_seconds", 10)
    if not isinstance(timeout, int) or timeout < 1 or timeout > 60:
        fail("timeout_seconds must be 1..60")
    target = spec.get("target")
    if not isinstance(target, str) or not target:
        fail("target required")
    if spec["probe_method"] in {"http_head", "http_get", "git_ls_remote"}:
        validate_remote_target(target)


def observe_file(spec: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    path = Path(spec["target"])
    if not path.is_file():
        return "negative", "unreachable", {"exists": False}
    digest = sha256_bytes(path.read_bytes())
    expected = (spec.get("expected") or {}).get("sha256")
    evidence = {"exists": True, "size": path.stat().st_size, "sha256": digest}
    if expected:
        evidence["expected_sha256"] = expected
        if digest == expected:
            return "positive", "content_match", evidence
        return "negative", "content_mismatch", evidence
    return "positive", "reachable", evidence


def observe_http(spec: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    method = "HEAD" if spec["probe_method"] == "http_head" else "GET"
    expected_status = (spec.get("expected") or {}).get("http_status", 200)
    req = urllib.request.Request(spec["target"], method=method, headers={"User-Agent": "UU-AAP-PassiveObserver/0.2"})
    try:
        with urllib.request.urlopen(req, timeout=spec.get("timeout_seconds", 10)) as response:
            status = int(response.status)
            evidence = {"http_status": status, "expected_http_status": expected_status, "method": method}
            return ("positive", "status_match", evidence) if status == expected_status else ("negative", "status_mismatch", evidence)
    except urllib.error.HTTPError as error:
        status = int(error.code)
        evidence = {"http_status": status, "expected_http_status": expected_status, "method": method}
        return ("positive", "status_match", evidence) if status == expected_status else ("negative", "status_mismatch", evidence)
    except Exception as error:  # network/DNS/TLS errors are observations, not proof of loss
        return "negative", "unreachable", {"error_type": type(error).__name__}


def observe_git(spec: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    expected = spec.get("expected") or {}
    ref = expected.get("git_ref")
    args = ["git", "ls-remote", "--refs", spec["target"]]
    if ref:
        args.append(ref)
    try:
        result = subprocess.run(args, check=False, capture_output=True, text=True, timeout=spec.get("timeout_seconds", 10))
    except Exception as error:
        return "negative", "unreachable", {"error_type": type(error).__name__}
    if result.returncode != 0:
        return "negative", "unreachable", {"git_exit_code": result.returncode}
    refs: dict[str, str] = {}
    for line in result.stdout.splitlines():
        parts = line.split("\t", 1)
        if len(parts) == 2:
            refs[parts[1]] = parts[0]
    evidence: dict[str, Any] = {"git_exit_code": 0, "ref_count": len(refs)}
    expected_sha = expected.get("git_sha")
    if ref and expected_sha:
        observed_sha = refs.get(ref)
        evidence.update({"ref": ref, "observed_sha": observed_sha, "expected_sha": expected_sha})
        if observed_sha == expected_sha:
            return "positive", "frontier_match", evidence
        return "negative", "frontier_mismatch", evidence
    return "positive", "reachable", evidence


def observe(spec: dict[str, Any], observed_at: str | None = None) -> dict[str, Any]:
    validate_spec(spec)
    method = spec["probe_method"]
    if method == "file_sha256":
        result, indicator, evidence = observe_file(spec)
    elif method in {"http_head", "http_get"}:
        result, indicator, evidence = observe_http(spec)
    else:
        result, indicator, evidence = observe_git(spec)
    timestamp = observed_at or utc_now()
    evidence_payload = {
        "observer_id": spec["observer_id"],
        "observer_domain_id": spec["observer_domain_id"],
        "failure_domain_id": spec["failure_domain_id"],
        "evidence_class": spec["evidence_class"],
        "probe_method": method,
        "subject": spec["subject"],
        "observed_at": timestamp,
        "result": result,
        "indicator": indicator,
        "evidence": evidence,
    }
    evidence_digest = sha256_json(evidence_payload)
    observation = {
        "artifact_type": "PassiveLossObservation",
        "artifact_version": "0.2",
        "observation_id": f"urn:uu-aap:protection:passive-observation:{evidence_digest[:24]}",
        **evidence_payload,
        "evidence_sha256": evidence_digest,
        "claims": {
            "read_only_observation": True,
            "target_mutated": False,
            "loss_confirmed": False,
            "rescue_eligible": False,
            "domain_independence_proven": False,
            "execution_authority_granted": False,
        },
    }
    return observation


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("observe")
    p.add_argument("--spec", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--observed-at")
    args = parser.parse_args()
    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    result = observe(spec, args.observed_at)
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
