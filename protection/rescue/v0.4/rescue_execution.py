#!/usr/bin/env python3
"""Bounded local non-canonical recovery executor for UU-AAP Survival Plane v0.4."""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HEX64 = "0123456789abcdef"
SCOPE = "reconstruct_noncanonical_git_copy"
MARKER_TEXT = (
    "UU-AAP NON-CANONICAL RECOVERY\n"
    "canonical_authority=false\n"
    "ownership_transferred=false\n"
    "kontur_activated=false\n"
)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_time(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return dt.astimezone(timezone.utc)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def is_hex(value: Any, lengths=(64,)) -> bool:
    return isinstance(value, str) and len(value) in lengths and all(c in HEX64 for c in value)


def self_digest(value: dict[str, Any], field: str) -> str:
    work = copy.deepcopy(value)
    work[field] = "0" * 64
    return sha256_json(work)


def load_json(path: Path) -> dict[str, Any]:
    require(path.exists() and path.is_file() and not path.is_symlink(), f"JSON input must be a regular non-symlink file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_capsule_module():
    module_path = Path(__file__).resolve().parent.parent / "v0.3" / "rescue_capsule.py"
    spec = importlib.util.spec_from_file_location("uu_aap_rescue_capsule_v03", module_path)
    if spec is None or spec.loader is None:
        raise ValueError("unable to load Rescue Capsule verifier v0.3")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "RescueExecutionPolicy", "RescueExecutionPolicy required")
    require(policy.get("artifact_version") == "0.4", "RescueExecutionPolicy v0.4 required")
    require(policy.get("allowed_scope") == SCOPE, "unsupported execution scope")
    require(policy.get("allowed_source_kinds") == ["git_bundle"], "only git_bundle source kind is permitted")
    req = policy.get("requirements") or {}
    required_true = [
        "capsule_verified", "assessment_rescue_eligible", "authorization_unexpired",
        "exact_assessment_binding", "selected_source_binding", "local_regular_payload",
        "destination_absent", "consume_nonce_before_execution", "bare_repository_only",
        "no_git_remotes", "git_fsck_full", "expected_frontier_present", "network_prohibited",
    ]
    for key in required_true:
        require(req.get(key) is True, f"unsafe or incomplete execution policy requirement: {key}")
    claims = policy.get("claims") or {}
    for key in [
        "automatic_failover_enabled", "canonical_succession_enabled", "ownership_transfer_enabled",
        "kontur_activation_enabled", "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe execution policy claim: {key}")


def validate_assessment(assessment: dict[str, Any]) -> None:
    require(assessment.get("artifact_type") == "ProjectRescueAssessment", "ProjectRescueAssessment required")
    require(assessment.get("artifact_version") == "0.1", "ProjectRescueAssessment v0.1 required")
    digest = assessment.get("assessment_sha256")
    require(is_hex(digest), "invalid assessment_sha256")
    require(self_digest(assessment, "assessment_sha256") == digest, "assessment self-digest mismatch")
    require(assessment.get("state") == "rescue_eligible", "assessment is not rescue_eligible")
    require(assessment.get("decision") == "human_rescue_authorization_may_be_requested", "assessment decision does not permit human rescue authorization")
    claims = assessment.get("claims") or {}
    require(claims.get("loss_confirmed") is True, "assessment does not confirm loss")
    require(claims.get("rescue_eligible") is True, "assessment does not establish rescue eligibility")
    require(claims.get("execution_authority_granted") is False, "assessment cannot itself grant execution authority")
    require(claims.get("canonical_successor_established") is False, "assessment cannot establish canonical successor")


def validate_authorization(auth: dict[str, Any], assessment: dict[str, Any], at: datetime) -> None:
    require(auth.get("artifact_type") == "ProjectRescueAuthorization", "ProjectRescueAuthorization required")
    require(auth.get("artifact_version") == "0.1", "ProjectRescueAuthorization v0.1 required")
    require(auth.get("decision") == "authorize_noncanonical_rescue", "authorization decision mismatch")
    scopes = auth.get("authorized_scope") or []
    require(SCOPE in scopes, f"authorization does not include {SCOPE}")
    require(auth.get("assessment_sha256") == assessment.get("assessment_sha256"), "authorization assessment binding mismatch")
    issued = parse_time(auth["issued_at"])
    expires = parse_time(auth["expires_at"])
    require(issued <= at < expires, "authorization is not active at execution time")
    nonce = auth.get("nonce")
    require(isinstance(nonce, str) and len(nonce) >= 16, "authorization nonce is invalid")
    require(isinstance(auth.get("selected_recovery_source_id"), str) and auth["selected_recovery_source_id"], "selected recovery source missing")
    claims = auth.get("claims") or {}
    require(claims.get("execution_scope_limited") is True, "authorization scope must be explicitly limited")
    for key in [
        "canonical_successor_established", "ownership_transferred", "kontur_activated",
        "distributed_consensus_established", "legal_effect_established", "truth_certified",
    ]:
        require(claims.get(key) is False, f"unsafe authorization claim: {key}")


def validate_binding(binding: dict[str, Any], auth: dict[str, Any]) -> None:
    require(binding.get("artifact_type") == "RecoverySourceBinding", "RecoverySourceBinding required")
    require(binding.get("artifact_version") == "0.4", "RecoverySourceBinding v0.4 required")
    require(binding.get("source_kind") == "git_bundle", "only git_bundle is executable in v0.4")
    require(binding.get("source_id") == auth.get("selected_recovery_source_id"), "selected recovery source binding mismatch")
    require(binding.get("verified") is True, "recovery source binding must be verified")
    require(is_hex(binding.get("payload_sha256")), "invalid recovery payload digest")
    require(is_hex(binding.get("frontier_commit"), lengths=(40, 64)), "invalid frontier commit")
    claims = binding.get("claims") or {}
    require(claims.get("canonical") is False, "recovery source cannot be canonical")
    require(claims.get("authority_transfer") is False, "recovery source cannot transfer authority")
    require(claims.get("network_source") is False, "v0.4 recovery source must be local")
    require(claims.get("truth_certified") is False, "recovery source cannot certify truth")


def capsule_item_json(capsule_dir: Path, manifest: dict[str, Any], role: str) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    out = []
    for item in manifest.get("items", []):
        if item.get("role") != role:
            continue
        path = capsule_dir / item["stored_path"]
        obj = json.loads(path.read_text(encoding="utf-8"))
        out.append((item, obj))
    return out


def run_git(args: list[str], cwd: Path | None = None, capture=True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(cwd) if cwd else None,
        check=True,
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def verify_bundle(payload: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="uu-aap-bundle-verify-") as td:
        repo = Path(td) / "verify.git"
        run_git(["init", "--bare", str(repo)])
        run_git(["-C", str(repo), "bundle", "verify", str(payload.resolve())])


def recovered_ref_set_sha256(repo: Path) -> str:
    result = run_git(["-C", str(repo), "for-each-ref", "--format=%(refname)%00%(objectname)%00%(objecttype)"])
    lines = sorted(line for line in result.stdout.splitlines() if line)
    return hashlib.sha256(("\n".join(lines) + "\n").encode("utf-8")).hexdigest()


def prepare_context(capsule_dir: Path, authorization_path: Path, payload: Path, policy_path: Path, at: str | None = None, destination_label: str = "recovered-noncanonical") -> dict[str, Any]:
    policy = load_json(policy_path)
    validate_policy(policy)
    now = parse_time(at) if at else datetime.now(timezone.utc)

    require(capsule_dir.exists() and capsule_dir.is_dir() and not capsule_dir.is_symlink(), "capsule-dir must be a local non-symlink directory")
    capsule_module = load_capsule_module()
    manifest = capsule_module.verify_capsule(capsule_dir)
    require(manifest.get("project_id") == policy.get("project_id"), "capsule project_id does not match execution policy")

    assessments = capsule_item_json(capsule_dir, manifest, "rescue_assessment")
    require(len(assessments) == 1, "capsule must contain exactly one rescue_assessment")
    _, assessment = assessments[0]
    validate_assessment(assessment)

    auth = load_json(authorization_path)
    validate_authorization(auth, assessment, now)

    candidates = capsule_item_json(capsule_dir, manifest, "recovery_source_manifest")
    selected = [(item, obj) for item, obj in candidates if obj.get("source_id") == auth.get("selected_recovery_source_id")]
    require(len(selected) == 1, "capsule must contain exactly one selected recovery_source_manifest")
    _, binding = selected[0]
    validate_binding(binding, auth)

    require(payload.exists() and payload.is_file() and not payload.is_symlink(), "recovery payload must be a local regular non-symlink file")
    payload_digest = file_sha256(payload)
    require(payload_digest == binding["payload_sha256"], "recovery payload SHA-256 mismatch")
    verify_bundle(payload)

    authorization_sha = sha256_json(auth)
    binding_sha = sha256_json(binding)
    prepared = iso_z(now)
    plan = {
        "artifact_type": "RescueExecutionPlan",
        "artifact_version": "0.4",
        "plan_id": "urn:uu-aap:rescue-execution-plan:" + sha256_json({
            "capsule": manifest["manifest_sha256"],
            "authorization": authorization_sha,
            "payload": payload_digest,
            "destination": destination_label,
            "at": prepared,
        })[:24],
        "prepared_at": prepared,
        "project_id": policy["project_id"],
        "capsule_manifest_sha256": manifest["manifest_sha256"],
        "assessment_sha256": assessment["assessment_sha256"],
        "authorization_sha256": authorization_sha,
        "recovery_source_binding_sha256": binding_sha,
        "recovery_payload_sha256": payload_digest,
        "selected_recovery_source_id": binding["source_id"],
        "authorized_scope": SCOPE,
        "frontier_commit": binding["frontier_commit"],
        "destination_label": destination_label,
        "plan_sha256": "0" * 64,
        "claims": {
            "capsule_verified": True,
            "rescue_eligibility_verified": True,
            "human_authorization_validated": True,
            "limited_execution_authority_validated": True,
            "execution_performed": False,
            "canonical_successor_established": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "distributed_consensus_established": False,
        },
    }
    plan["plan_sha256"] = self_digest(plan, "plan_sha256")
    return {
        "policy": policy,
        "manifest": manifest,
        "assessment": assessment,
        "authorization": auth,
        "binding": binding,
        "payload": payload,
        "plan": plan,
        "at": now,
    }


def reserve_nonce(state_dir: Path, auth: dict[str, Any], authorization_sha: str, at: datetime) -> str:
    state_dir.mkdir(parents=True, exist_ok=True)
    used = state_dir / "used-nonces"
    used.mkdir(parents=True, exist_ok=True)
    nonce_hash = hashlib.sha256(auth["nonce"].encode("utf-8")).hexdigest()
    path = used / f"{nonce_hash}.json"
    reservation = {
        "artifact_type": "LocalRescueNonceReservation",
        "artifact_version": "0.4",
        "authorization_id": auth["authorization_id"],
        "authorization_sha256": authorization_sha,
        "nonce_sha256": nonce_hash,
        "consumed_at": iso_z(at),
        "replay_scope": "local_state_directory",
        "claims": {"global_replay_prevention_established": False},
    }
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError("authorization nonce already consumed in this local state directory") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(reservation, indent=2, ensure_ascii=False) + "\n")
            f.flush()
            os.fsync(f.fileno())
        dfd = os.open(used, os.O_RDONLY)
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
    except Exception:
        # Reservation intentionally remains consumed if publication began.
        raise
    return nonce_hash


def fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_json_fsync(path: Path, value: dict[str, Any]) -> None:
    with path.open("x", encoding="utf-8") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())


def execute_recovery(capsule_dir: Path, authorization_path: Path, payload: Path, destination: Path, state_dir: Path, policy_path: Path, at: str | None = None) -> Path:
    require(not destination.exists(), "destination must not already exist")
    require(destination.name not in {"", ".", ".."}, "unsafe destination")
    ctx = prepare_context(capsule_dir, authorization_path, payload, policy_path, at, destination.name)
    plan = ctx["plan"]
    auth = ctx["authorization"]
    binding = ctx["binding"]
    now = ctx["at"]

    nonce_hash = reserve_nonce(state_dir, auth, plan["authorization_sha256"], now)

    parent = destination.parent if destination.parent != Path("") else Path(".")
    parent.mkdir(parents=True, exist_ok=True)
    temp = parent / f".{destination.name}.rescue-tmp-{nonce_hash[:12]}"
    require(not temp.exists(), "temporary recovery path already exists")
    temp.mkdir()
    repo = temp / "repository.git"
    try:
        run_git(["clone", "--mirror", str(payload.resolve()), str(repo)])
        remotes = run_git(["-C", str(repo), "remote"]).stdout.split()
        if "origin" in remotes:
            run_git(["-C", str(repo), "remote", "remove", "origin"])
        remotes_after = run_git(["-C", str(repo), "remote"]).stdout.split()
        require(remotes_after == [], "recovered repository must contain no Git remotes")
        run_git(["-C", str(repo), "fsck", "--full"])
        run_git(["-C", str(repo), "cat-file", "-e", f"{binding['frontier_commit']}^{{commit}}"])
        ref_set_digest = recovered_ref_set_sha256(repo)

        marker = temp / "NON_CANONICAL_RECOVERY"
        with marker.open("x", encoding="utf-8") as f:
            f.write(MARKER_TEXT)
            f.flush()
            os.fsync(f.fileno())

        write_json_fsync(temp / "rescue-execution-plan.json", plan)
        receipt = {
            "artifact_type": "RescueExecutionReceipt",
            "artifact_version": "0.4",
            "receipt_id": "urn:uu-aap:rescue-execution-receipt:" + sha256_json({
                "plan": plan["plan_sha256"], "nonce": nonce_hash, "refs": ref_set_digest
            })[:24],
            "executed_at": iso_z(now),
            "project_id": plan["project_id"],
            "plan_sha256": plan["plan_sha256"],
            "authorization_sha256": plan["authorization_sha256"],
            "authorization_nonce_sha256": nonce_hash,
            "capsule_manifest_sha256": plan["capsule_manifest_sha256"],
            "recovery_source_binding_sha256": plan["recovery_source_binding_sha256"],
            "recovery_payload_sha256": plan["recovery_payload_sha256"],
            "recovered_frontier_commit": binding["frontier_commit"],
            "recovered_ref_set_sha256": ref_set_digest,
            "git_fsck_full_success": True,
            "git_remote_count": 0,
            "state_replay_scope": "local_state_directory",
            "receipt_sha256": "0" * 64,
            "claims": {
                "human_authorization_validated": True,
                "noncanonical_recovery_executed": True,
                "recovered_repository_integrity_checked": True,
                "no_git_remotes": True,
                "canonical_successor_established": False,
                "ownership_transferred": False,
                "kontur_activated": False,
                "distributed_consensus_established": False,
                "global_replay_prevention_established": False,
                "legal_effect_established": False,
                "truth_certified": False,
            },
        }
        receipt["receipt_sha256"] = self_digest(receipt, "receipt_sha256")
        write_json_fsync(temp / "rescue-execution-receipt.json", receipt)
        fsync_dir(temp)
        os.replace(temp, destination)
        fsync_dir(parent)
        return destination
    except Exception:
        if temp.exists():
            shutil.rmtree(temp, ignore_errors=True)
        raise


def verify_recovery(destination: Path) -> dict[str, Any]:
    require(destination.is_dir() and not destination.is_symlink(), "recovery destination is missing or unsafe")
    marker = destination / "NON_CANONICAL_RECOVERY"
    plan_path = destination / "rescue-execution-plan.json"
    receipt_path = destination / "rescue-execution-receipt.json"
    repo = destination / "repository.git"
    require(marker.is_file() and not marker.is_symlink(), "NON_CANONICAL_RECOVERY marker missing")
    require(marker.read_text(encoding="utf-8") == MARKER_TEXT, "non-canonical recovery marker mismatch")
    plan = load_json(plan_path)
    receipt = load_json(receipt_path)
    require(plan.get("artifact_type") == "RescueExecutionPlan" and plan.get("artifact_version") == "0.4", "unsupported rescue execution plan")
    require(receipt.get("artifact_type") == "RescueExecutionReceipt" and receipt.get("artifact_version") == "0.4", "unsupported rescue execution receipt")
    require(self_digest(plan, "plan_sha256") == plan.get("plan_sha256"), "execution plan self-digest mismatch")
    require(self_digest(receipt, "receipt_sha256") == receipt.get("receipt_sha256"), "execution receipt self-digest mismatch")
    require(receipt.get("plan_sha256") == plan.get("plan_sha256"), "receipt/plan binding mismatch")
    require(repo.is_dir() and not repo.is_symlink(), "recovered bare repository missing")
    require((repo / "HEAD").is_file(), "recovered repository is not a bare Git repository")
    remotes = run_git(["-C", str(repo), "remote"]).stdout.split()
    require(remotes == [], "recovered repository has Git remotes")
    run_git(["-C", str(repo), "fsck", "--full"])
    run_git(["-C", str(repo), "cat-file", "-e", f"{receipt['recovered_frontier_commit']}^{{commit}}"])
    require(recovered_ref_set_sha256(repo) == receipt.get("recovered_ref_set_sha256"), "recovered ref-set digest mismatch")
    claims = receipt.get("claims") or {}
    require(claims.get("noncanonical_recovery_executed") is True, "receipt does not claim noncanonical recovery")
    for key in [
        "canonical_successor_established", "ownership_transferred", "kontur_activated",
        "distributed_consensus_established", "global_replay_prevention_established",
        "legal_effect_established", "truth_certified",
    ]:
        require(claims.get(key) is False, f"unsafe recovery receipt claim: {key}")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="UU-AAP bounded local Rescue Execution Envelope v0.4")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("--capsule-dir", required=True)
        p.add_argument("--authorization", required=True)
        p.add_argument("--payload", required=True)
        p.add_argument("--policy", required=True)
        p.add_argument("--at", help="timezone-aware ISO-8601 instant")

    pf = sub.add_parser("preflight")
    common(pf)
    pf.add_argument("--destination-label", default="recovered-noncanonical")

    ex = sub.add_parser("execute")
    common(ex)
    ex.add_argument("--destination", required=True)
    ex.add_argument("--state-dir", required=True)

    vr = sub.add_parser("verify")
    vr.add_argument("--destination", required=True)

    args = parser.parse_args()
    try:
        if args.cmd == "preflight":
            ctx = prepare_context(
                Path(args.capsule_dir), Path(args.authorization), Path(args.payload), Path(args.policy),
                args.at, args.destination_label,
            )
            print(json.dumps(ctx["plan"], indent=2, ensure_ascii=False))
        elif args.cmd == "execute":
            out = execute_recovery(
                Path(args.capsule_dir), Path(args.authorization), Path(args.payload),
                Path(args.destination), Path(args.state_dir), Path(args.policy), args.at,
            )
            print(out)
        else:
            receipt = verify_recovery(Path(args.destination))
            print(f"NON-CANONICAL RECOVERY VERIFIED {receipt['receipt_id']} {receipt['receipt_sha256']}")
    except Exception as exc:
        print(f"rescue execution failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
