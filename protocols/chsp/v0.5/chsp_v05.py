#!/usr/bin/env python3
"""CHSP v0.5 bounded local canonical-stewardship handover executor.

The executor records CHSP protocol state only. It contains no network, Git,
repository/account, canonical-publication, ownership-transfer, credential, or
KONTUR execution surface.
"""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
import re
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
AUTHORIZED_ACTION = "record_protocol_canonical_stewardship_handover"
STATE_FILE = "chsp-canonical-stewardship-state.json"
RECEIPT_FILE = "chsp-handover-execution-receipt.json"
MARKER_FILE = "CHSP_PROTOCOL_STEWARDSHIP_RECORDED"


def _load_v04():
    path = ROOT.parent / "v0.4" / "chsp_v04.py"
    spec = importlib.util.spec_from_file_location("chsp_v04_for_v05", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load CHSP v0.4 tooling")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V04 = _load_v04()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def self_digest(value: dict[str, Any], field: str) -> str:
    work = copy.deepcopy(value)
    work[field] = "0" * 64
    return sha256_json(work)


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load_json(path: Path) -> dict[str, Any]:
    require(path.is_file() and not path.is_symlink(), f"JSON input must be a regular non-symlink file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, value: dict[str, Any]) -> None:
    require(not path.exists(), f"output already exists: {path}")
    with path.open("x", encoding="utf-8") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())


def _write_text(path: Path, text: str) -> None:
    require(not path.exists(), f"output already exists: {path}")
    with path.open("x", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())


def _fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def reserve_once(state_dir: Path, category: str, key: str, payload: dict[str, Any]) -> None:
    target_dir = state_dir / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{hashlib.sha256(key.encode('utf-8')).hexdigest()}.json"
    try:
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError(f"local reservation already exists for {category}") from exc
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())
    _fsync_dir(target_dir)


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CHSPHandoverExecutionPolicy", "CHSPHandoverExecutionPolicy required")
    require(policy.get("artifact_version") == "0.5", "CHSPHandoverExecutionPolicy v0.5 required")
    require(isinstance(policy.get("project_id"), str) and policy["project_id"], "invalid project_id")
    require(policy.get("authorized_action") == AUTHORIZED_ACTION, "unexpected authorized action")
    age = policy.get("maximum_active_assessment_age_minutes")
    require(isinstance(age, int) and 1 <= age <= 1440, "invalid active-assessment freshness threshold")
    req = policy.get("requirements") or {}
    for key in [
        "v04_active_assessment_required", "exact_authorization_binding_required",
        "authorization_unexpired_at_execution", "zero_presented_revocations_required",
        "recorder_evidence_digest_required", "execution_nonce_required",
        "single_local_execution_per_authorization", "immutable_state_and_receipt", "atomic_local_publish",
    ]:
        require(req.get(key) is True, f"unsafe execution requirement: {key}")
    for key in [
        "automatic_repository_mutation", "automatic_account_control_transfer",
        "automatic_canonical_publication", "automatic_kontur_activation",
    ]:
        require(req.get(key) is False, f"unsafe automatic execution setting: {key}")
    claims = policy.get("claims") or {}
    require(claims.get("descriptive_execution_policy_only") is True, "execution policy must remain descriptive")
    for key in [
        "global_revocation_absence_proven", "global_replay_prevention_established",
        "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated",
        "canonical_publication_executed", "kontur_activated", "legal_effect_established",
        "distributed_consensus_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe execution policy claim: {key}")


def validate_v04_assessment_artifact(
    source_assessment: dict[str, Any], disposition: dict[str, Any], v04_policy: dict[str, Any],
    approvals: list[dict[str, Any]], authorization: dict[str, Any], revocations: list[dict[str, Any]],
    authorization_assessment: dict[str, Any],
) -> None:
    V04.validate_policy(v04_policy)
    V04.validate_authorization(authorization, source_assessment, disposition, v04_policy, approvals)
    require(authorization_assessment.get("artifact_type") == "CHSPHandoverAuthorizationAssessment", "CHSPHandoverAuthorizationAssessment required")
    require(authorization_assessment.get("artifact_version") == "0.4", "CHSPHandoverAuthorizationAssessment v0.4 required")
    digest = authorization_assessment.get("assessment_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid v0.4 authorization assessment digest")
    require(V04.self_digest(authorization_assessment, "assessment_sha256") == digest, "v0.4 authorization assessment self-digest mismatch")
    recomputed = V04.assess_authorization(
        source_assessment, disposition, v04_policy, approvals, authorization, revocations,
        authorization_assessment["evaluated_at"],
    )
    require(recomputed["assessment_sha256"] == digest, "v0.4 authorization assessment does not match supplied causal inputs")
    require(authorization_assessment.get("state") == "authorization_active", "v0.4 authorization assessment is not active")
    require(authorization_assessment.get("decision") == "bounded_handover_executor_may_be_requested", "v0.4 assessment does not permit bounded executor request")
    require(authorization_assessment.get("authorization_sha256") == authorization["authorization_sha256"], "v0.4 assessment authorization binding mismatch")
    require((authorization_assessment.get("metrics") or {}).get("revocation_count") == 0, "presented revocations must be empty for execution")
    claims = authorization_assessment.get("claims") or {}
    require(claims.get("authorization_validated") is True, "v0.4 assessment did not validate authorization")
    require(claims.get("executor_invoked") is False, "v0.4 assessment must predate executor invocation")
    for key in [
        "candidate_stewardship_effective", "canonical_successor_established", "repository_ownership_transferred",
        "account_control_transferred", "canonical_origin_mutated", "canonical_publication_executed",
        "kontur_activated", "distributed_consensus_established", "legal_effect_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe v0.4 assessment claim: {key}")


def validate_predecessor_state(predecessor_state: dict[str, Any] | None, authorization: dict[str, Any], project_id: str) -> str | None:
    if predecessor_state is None:
        return None
    require(predecessor_state.get("artifact_type") == "CHSPCanonicalStewardshipState", "CHSPCanonicalStewardshipState predecessor required")
    require(predecessor_state.get("artifact_version") == "0.5", "CHSPCanonicalStewardshipState v0.5 predecessor required")
    digest = predecessor_state.get("state_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid predecessor stewardship state digest")
    require(self_digest(predecessor_state, "state_sha256") == digest, "predecessor stewardship state self-digest mismatch")
    require(predecessor_state.get("project_id") == project_id, "predecessor stewardship project mismatch")
    require(predecessor_state.get("current_steward_id") == authorization["predecessor_steward_id"], "predecessor stewardship identity mismatch")
    claims = predecessor_state.get("claims") or {}
    require(claims.get("chsp_protocol_canonical_stewardship_effective") is True, "predecessor state is not effective CHSP stewardship")
    return digest


def state_claims() -> dict[str, Any]:
    return {
        "chsp_protocol_canonical_stewardship_effective": True,
        "effective_scope_chsp_protocol_only": True,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "external_system_control_changed": False,
        "kontur_activated": False,
        "predecessor_legal_rights_adjudicated": False,
        "legal_ownership_adjudicated": False,
        "distributed_consensus_established": False,
        "universal_trust_established": False,
    }


def receipt_claims() -> dict[str, Any]:
    return {
        "chsp_handover_execution_performed": True,
        "chsp_stewardship_state_recorded": True,
        "recorder_is_authority_source": False,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "external_system_mutation_performed": False,
        "kontur_activated": False,
        "global_revocation_absence_proven": False,
        "global_replay_prevention_established": False,
        "legal_effect_established": False,
        "distributed_consensus_established": False,
        "universal_trust_established": False,
    }


def execute_handover(
    source_assessment: dict[str, Any], disposition: dict[str, Any], v04_policy: dict[str, Any],
    approvals: list[dict[str, Any]], authorization: dict[str, Any], revocations: list[dict[str, Any]],
    authorization_assessment: dict[str, Any], execution_policy: dict[str, Any],
    recorder_id: str, recorder_evidence_sha256: str, execution_nonce: str,
    state_dir: Path, out_dir: Path, at: str, predecessor_state: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    validate_policy(execution_policy)
    require(execution_policy["project_id"] == v04_policy.get("project_id"), "v0.4/v0.5 project mismatch")
    validate_v04_assessment_artifact(
        source_assessment, disposition, v04_policy, approvals, authorization, revocations, authorization_assessment
    )
    require(authorization.get("project_id") == execution_policy["project_id"], "authorization project mismatch")
    require(authorization.get("authorized_action") == execution_policy["authorized_action"], "authorization action mismatch")
    require(not revocations, "presented revocations block execution")
    require(isinstance(recorder_id, str) and recorder_id, "recorder_id required")
    require(HEX64_RE.fullmatch(recorder_evidence_sha256 or "") is not None, "invalid recorder evidence digest")
    require(isinstance(execution_nonce, str) and len(execution_nonce) >= 16, "execution nonce too short")
    require(not out_dir.exists(), "execution output directory already exists")

    now = parse_time(at)
    assessment_time = parse_time(authorization_assessment["evaluated_at"])
    require(now >= assessment_time, "execution cannot predate authorization assessment")
    require(now - assessment_time <= timedelta(minutes=execution_policy["maximum_active_assessment_age_minutes"]), "authorization assessment is too old for execution")
    require(now >= parse_time(authorization["authorized_at"]), "execution cannot predate authorization")
    require(now <= parse_time(authorization["expires_at"]), "authorization expired before execution")

    current = V04.assess_authorization(
        source_assessment, disposition, v04_policy, approvals, authorization, revocations, iso_z(now)
    )
    require(current["state"] == "authorization_active", "authorization is not active at execution time")
    require(current["decision"] == "bounded_handover_executor_may_be_requested", "bounded executor is not permitted at execution time")

    predecessor_state_sha = validate_predecessor_state(predecessor_state, authorization, execution_policy["project_id"])

    reservation = {
        "artifact_type": "CHSPLocalHandoverExecutionReservation",
        "artifact_version": "0.5",
        "authorization_sha256": authorization["authorization_sha256"],
        "candidate_id": authorization["candidate_id"],
        "reserved_at": iso_z(now),
        "claims": {"global_replay_prevention_established": False},
    }
    reserve_once(state_dir, "handover-executed-authorizations", authorization["authorization_sha256"], reservation)
    reserve_once(state_dir, "handover-execution-nonces", execution_nonce, reservation)

    state = {
        "artifact_type": "CHSPCanonicalStewardshipState",
        "artifact_version": "0.5",
        "state_id": "urn:uu-aap:chsp:stewardship-state:" + sha256_json({"authorization": authorization["authorization_sha256"], "nonce": execution_nonce})[:24],
        "project_id": execution_policy["project_id"],
        "predecessor_steward_id": authorization["predecessor_steward_id"],
        "current_steward_id": authorization["candidate_id"],
        "predecessor_disposition_mode": authorization["predecessor_disposition_mode"],
        "v04_authorization_sha256": authorization["authorization_sha256"],
        "v04_authorization_assessment_sha256": authorization_assessment["assessment_sha256"],
        "effective_at": iso_z(now),
        "execution_nonce": execution_nonce,
        "predecessor_state_sha256": predecessor_state_sha,
        "state_sha256": "0" * 64,
        "claims": state_claims(),
    }
    state["state_sha256"] = self_digest(state, "state_sha256")

    receipt = {
        "artifact_type": "CHSPHandoverExecutionReceipt",
        "artifact_version": "0.5",
        "execution_id": "urn:uu-aap:chsp:handover-execution:" + sha256_json({"state": state["state_sha256"], "authorization": authorization["authorization_sha256"]})[:24],
        "project_id": execution_policy["project_id"],
        "candidate_id": authorization["candidate_id"],
        "predecessor_steward_id": authorization["predecessor_steward_id"],
        "v04_authorization_sha256": authorization["authorization_sha256"],
        "v04_authorization_assessment_sha256": authorization_assessment["assessment_sha256"],
        "stewardship_state_sha256": state["state_sha256"],
        "executed_at": iso_z(now),
        "execution_nonce": execution_nonce,
        "recorder_id": recorder_id,
        "recorder_evidence_sha256": recorder_evidence_sha256,
        "result": "recorded",
        "receipt_sha256": "0" * 64,
        "claims": receipt_claims(),
    }
    receipt["receipt_sha256"] = self_digest(receipt, "receipt_sha256")

    out_dir.parent.mkdir(parents=True, exist_ok=True)
    temp_path = Path(tempfile.mkdtemp(prefix=f".{out_dir.name}.tmp-", dir=out_dir.parent))
    try:
        _write_json(temp_path / STATE_FILE, state)
        _write_json(temp_path / RECEIPT_FILE, receipt)
        _write_text(temp_path / MARKER_FILE, receipt["receipt_sha256"] + "\n")
        _fsync_dir(temp_path)
        require(not out_dir.exists(), "execution output directory appeared during publish")
        os.replace(temp_path, out_dir)
        _fsync_dir(out_dir.parent)
    except Exception:
        if temp_path.exists():
            shutil.rmtree(temp_path, ignore_errors=True)
        raise

    return state, receipt


def validate_state(state: dict[str, Any], authorization: dict[str, Any], authorization_assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_policy(policy)
    require(state.get("artifact_type") == "CHSPCanonicalStewardshipState", "CHSPCanonicalStewardshipState required")
    require(state.get("artifact_version") == "0.5", "CHSPCanonicalStewardshipState v0.5 required")
    digest = state.get("state_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid stewardship state digest")
    require(self_digest(state, "state_sha256") == digest, "stewardship state self-digest mismatch")
    require(state.get("project_id") == policy["project_id"], "stewardship state project mismatch")
    require(state.get("predecessor_steward_id") == authorization["predecessor_steward_id"], "stewardship predecessor mismatch")
    require(state.get("current_steward_id") == authorization["candidate_id"], "stewardship candidate mismatch")
    require(state.get("predecessor_disposition_mode") == authorization["predecessor_disposition_mode"], "stewardship predecessor mode mismatch")
    require(state.get("v04_authorization_sha256") == authorization["authorization_sha256"], "stewardship authorization mismatch")
    require(state.get("v04_authorization_assessment_sha256") == authorization_assessment["assessment_sha256"], "stewardship authorization assessment mismatch")
    require(isinstance(state.get("execution_nonce"), str) and len(state["execution_nonce"]) >= 16, "invalid stewardship execution nonce")
    claims = state.get("claims") or {}
    require(claims.get("chsp_protocol_canonical_stewardship_effective") is True, "CHSP stewardship not marked effective")
    require(claims.get("effective_scope_chsp_protocol_only") is True, "CHSP stewardship scope boundary missing")
    for key in [
        "repository_ownership_transferred", "account_control_transferred", "canonical_origin_mutated",
        "canonical_publication_executed", "external_system_control_changed", "kontur_activated",
        "predecessor_legal_rights_adjudicated", "legal_ownership_adjudicated",
        "distributed_consensus_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe stewardship state claim: {key}")


def validate_receipt(receipt: dict[str, Any], state: dict[str, Any], authorization: dict[str, Any], authorization_assessment: dict[str, Any], policy: dict[str, Any]) -> None:
    validate_state(state, authorization, authorization_assessment, policy)
    require(receipt.get("artifact_type") == "CHSPHandoverExecutionReceipt", "CHSPHandoverExecutionReceipt required")
    require(receipt.get("artifact_version") == "0.5", "CHSPHandoverExecutionReceipt v0.5 required")
    digest = receipt.get("receipt_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid execution receipt digest")
    require(self_digest(receipt, "receipt_sha256") == digest, "execution receipt self-digest mismatch")
    require(receipt.get("project_id") == policy["project_id"], "execution receipt project mismatch")
    require(receipt.get("candidate_id") == authorization["candidate_id"], "execution receipt candidate mismatch")
    require(receipt.get("predecessor_steward_id") == authorization["predecessor_steward_id"], "execution receipt predecessor mismatch")
    require(receipt.get("v04_authorization_sha256") == authorization["authorization_sha256"], "execution receipt authorization mismatch")
    require(receipt.get("v04_authorization_assessment_sha256") == authorization_assessment["assessment_sha256"], "execution receipt assessment mismatch")
    require(receipt.get("stewardship_state_sha256") == state["state_sha256"], "execution receipt state mismatch")
    require(receipt.get("execution_nonce") == state["execution_nonce"], "execution receipt nonce mismatch")
    require(receipt.get("executed_at") == state["effective_at"], "execution/state time mismatch")
    require(receipt.get("result") == "recorded", "execution receipt result mismatch")
    require(isinstance(receipt.get("recorder_id"), str) and receipt["recorder_id"], "invalid recorder_id")
    require(HEX64_RE.fullmatch(receipt.get("recorder_evidence_sha256", "")) is not None, "invalid recorder evidence digest")
    claims = receipt.get("claims") or {}
    for key in ["chsp_handover_execution_performed", "chsp_stewardship_state_recorded"]:
        require(claims.get(key) is True, f"required receipt claim missing: {key}")
    for key in [
        "recorder_is_authority_source", "repository_ownership_transferred", "account_control_transferred",
        "canonical_origin_mutated", "canonical_publication_executed", "external_system_mutation_performed",
        "kontur_activated", "global_revocation_absence_proven", "global_replay_prevention_established",
        "legal_effect_established", "distributed_consensus_established", "universal_trust_established",
    ]:
        require(claims.get(key) is False, f"unsafe execution receipt claim: {key}")


def verify_execution_bundle(bundle_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    require(bundle_dir.is_dir() and not bundle_dir.is_symlink(), "execution bundle directory required")
    state_path = bundle_dir / STATE_FILE
    receipt_path = bundle_dir / RECEIPT_FILE
    marker_path = bundle_dir / MARKER_FILE
    for path in [state_path, receipt_path, marker_path]:
        require(path.is_file() and not path.is_symlink(), f"missing or unsafe execution artifact: {path.name}")
    state = load_json(state_path)
    receipt = load_json(receipt_path)
    require(self_digest(state, "state_sha256") == state.get("state_sha256"), "execution bundle state digest mismatch")
    require(self_digest(receipt, "receipt_sha256") == receipt.get("receipt_sha256"), "execution bundle receipt digest mismatch")
    require(receipt.get("stewardship_state_sha256") == state.get("state_sha256"), "execution bundle state/receipt binding mismatch")
    require(marker_path.read_text(encoding="utf-8").strip() == receipt.get("receipt_sha256"), "execution completion marker mismatch")
    return state, receipt


def assessment_claims(effective: bool) -> dict[str, Any]:
    return {
        "evidence_verification_only": True,
        "chsp_protocol_canonical_stewardship_effective": effective,
        "repository_ownership_transferred": False,
        "account_control_transferred": False,
        "canonical_origin_mutated": False,
        "canonical_publication_executed": False,
        "external_system_control_changed": False,
        "kontur_activated": False,
        "legal_effect_established": False,
        "distributed_consensus_established": False,
        "universal_trust_established": False,
    }


def assess_execution(
    source_assessment: dict[str, Any], disposition: dict[str, Any], v04_policy: dict[str, Any],
    approvals: list[dict[str, Any]], authorization: dict[str, Any], revocations: list[dict[str, Any]],
    authorization_assessment: dict[str, Any], execution_policy: dict[str, Any],
    state: dict[str, Any] | None, receipt: dict[str, Any] | None, at: str,
) -> dict[str, Any]:
    validate_policy(execution_policy)
    now = parse_time(at)
    reasons: list[str] = []
    effective = False
    state_sha = state.get("state_sha256") if isinstance(state, dict) else None
    receipt_sha = receipt.get("receipt_sha256") if isinstance(receipt, dict) else None
    try:
        validate_v04_assessment_artifact(
            source_assessment, disposition, v04_policy, approvals, authorization, revocations, authorization_assessment
        )
        require(state is not None and receipt is not None, "execution state/receipt missing")
        validate_receipt(receipt, state, authorization, authorization_assessment, execution_policy)
        require(parse_time(receipt["executed_at"]) <= now, "execution receipt is from the future")
        effective = True
        state_name = "protocol_handover_recorded"
        decision = "chsp_protocol_canonical_stewardship_is_effective"
        reasons.append("self-digested state and receipt bind one exact v0.4 authorization execution")
    except Exception as exc:
        state_name = "execution_invalid"
        decision = "reject_execution_record"
        reasons.append(str(exc))
        effective = False
    result = {
        "artifact_type": "CHSPHandoverExecutionAssessment",
        "artifact_version": "0.5",
        "assessment_id": "urn:uu-aap:chsp:handover-execution-assessment:" + sha256_json({"authorization": authorization.get("authorization_sha256"), "state": state_sha, "receipt": receipt_sha, "at": iso_z(now)})[:24],
        "evaluated_at": iso_z(now),
        "project_id": execution_policy["project_id"],
        "candidate_id": authorization.get("candidate_id", "unknown"),
        "predecessor_steward_id": authorization.get("predecessor_steward_id", "unknown"),
        "authorization_sha256": authorization.get("authorization_sha256", "0" * 64),
        "authorization_assessment_sha256": authorization_assessment.get("assessment_sha256", "0" * 64),
        "stewardship_state_sha256": state_sha,
        "execution_receipt_sha256": receipt_sha,
        "state": state_name,
        "decision": decision,
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": assessment_claims(effective),
    }
    result["assessment_sha256"] = self_digest(result, "assessment_sha256")
    return result
