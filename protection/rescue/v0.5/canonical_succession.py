#!/usr/bin/env python3
"""Local-only Canonical Succession Proposal Protocol v0.5.

This module can bind a local predecessor frontier, create a proposal from a
verified v0.4 RECOVERED_NONCANONICAL repository, and assess that proposal.
It never recognizes a canonical successor and never performs network I/O.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
OID_RE = re.compile(r"^[0-9a-f]{40,64}$")
LOCAL_BRANCH_RE = re.compile(r"^refs/heads/[A-Za-z0-9._/-]+$")
FRONTIER_REF_RE = re.compile(r"^refs/(heads|tags)/[A-Za-z0-9._/-]+$")


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
    require(path.exists() and path.is_file() and not path.is_symlink(), f"JSON input must be a regular non-symlink file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    require(not path.exists(), f"output already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_git(args: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(cwd) if cwd else None,
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def ensure_local_git_repo(repo: Path) -> None:
    require(repo.exists() and repo.is_dir() and not repo.is_symlink(), "repository must be a local non-symlink directory")
    probe = run_git(["-C", str(repo), "rev-parse", "--git-dir"], check=False)
    require(probe.returncode == 0, "path is not a Git repository")


def ref_set_sha256(repo: Path) -> str:
    result = run_git(["-C", str(repo), "for-each-ref", "--format=%(refname)%00%(objectname)%00%(objecttype)"])
    lines = sorted(line for line in result.stdout.splitlines() if line)
    return hashlib.sha256(("\n".join(lines) + "\n").encode("utf-8")).hexdigest()


def load_v04_module():
    module_path = Path(__file__).resolve().parent.parent / "v0.4" / "rescue_execution.py"
    spec = importlib.util.spec_from_file_location("uu_aap_rescue_execution_v04_for_v05", module_path)
    if spec is None or spec.loader is None:
        raise ValueError("unable to load Rescue Execution Envelope v0.4 verifier")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_policy(policy: dict[str, Any]) -> None:
    require(policy.get("artifact_type") == "CanonicalSuccessionProposalPolicy", "CanonicalSuccessionProposalPolicy required")
    require(policy.get("artifact_version") == "0.5", "CanonicalSuccessionProposalPolicy v0.5 required")
    req = policy.get("requirements") or {}
    for key in [
        "verified_v04_recovery", "predecessor_binding_required", "recovered_frontier_must_match_predecessor",
        "candidate_local_branch_required", "candidate_descends_from_recovered_frontier", "candidate_repo_bare",
        "candidate_repo_no_remotes", "candidate_repo_fsck_full", "proposal_only", "human_recognition_required",
        "canonical_origin_mutation_prohibited", "network_prohibited",
    ]:
        require(req.get(key) is True, f"unsafe or incomplete succession policy requirement: {key}")
    claims = policy.get("claims") or {}
    for key in [
        "automatic_canonical_recognition_enabled", "automatic_origin_creation_enabled", "ownership_transfer_enabled",
        "kontur_activation_enabled", "distributed_consensus_established",
    ]:
        require(claims.get(key) is False, f"unsafe succession policy claim: {key}")


def binding_claims() -> dict[str, Any]:
    return {
        "repository_scoped_canonical_predecessor_recorded": True,
        "universal_canonicality_established": False,
        "future_successor_selected": False,
        "ownership_adjudicated": False,
        "truth_certified": False,
    }


def bind_predecessor(project_id: str, origin_id: str, repo: Path, frontier_ref: str, at: str | None = None) -> dict[str, Any]:
    require(project_id and origin_id, "project_id and origin_id are required")
    require(FRONTIER_REF_RE.fullmatch(frontier_ref) is not None, "frontier-ref must be an explicit refs/heads/* or refs/tags/* ref")
    ensure_local_git_repo(repo)
    commit = run_git(["-C", str(repo), "rev-parse", f"{frontier_ref}^{{commit}}"], check=False)
    require(commit.returncode == 0, "frontier ref does not resolve to a commit")
    frontier_commit = commit.stdout.strip()
    require(OID_RE.fullmatch(frontier_commit) is not None, "invalid frontier commit object ID")
    frontier_tree = run_git(["-C", str(repo), "rev-parse", f"{frontier_commit}^{{tree}}"], check=True).stdout.strip()
    now = parse_time(at) if at else datetime.now(timezone.utc)
    body = {
        "artifact_type": "CanonicalPredecessorBinding",
        "artifact_version": "0.5",
        "binding_id": "urn:uu-aap:canonical-predecessor-binding:" + sha256_json({
            "project": project_id,
            "origin": origin_id,
            "ref": frontier_ref,
            "commit": frontier_commit,
            "tree": frontier_tree,
            "refs": ref_set_sha256(repo),
        })[:24],
        "bound_at": iso_z(now),
        "project_id": project_id,
        "canonical_origin_id": origin_id,
        "canonical_frontier_ref": frontier_ref,
        "canonical_frontier_commit": frontier_commit,
        "canonical_frontier_tree": frontier_tree,
        "canonical_ref_set_sha256": ref_set_sha256(repo),
        "binding_sha256": "0" * 64,
        "claims": binding_claims(),
    }
    body["binding_sha256"] = self_digest(body, "binding_sha256")
    return body


def validate_predecessor_binding(binding: dict[str, Any]) -> None:
    require(binding.get("artifact_type") == "CanonicalPredecessorBinding", "CanonicalPredecessorBinding required")
    require(binding.get("artifact_version") == "0.5", "CanonicalPredecessorBinding v0.5 required")
    require(isinstance(binding.get("project_id"), str) and binding["project_id"], "invalid predecessor project_id")
    require(isinstance(binding.get("canonical_origin_id"), str) and binding["canonical_origin_id"], "invalid canonical_origin_id")
    require(FRONTIER_REF_RE.fullmatch(binding.get("canonical_frontier_ref", "")) is not None, "invalid canonical frontier ref")
    require(OID_RE.fullmatch(binding.get("canonical_frontier_commit", "")) is not None, "invalid canonical frontier commit")
    require(OID_RE.fullmatch(binding.get("canonical_frontier_tree", "")) is not None, "invalid canonical frontier tree")
    require(HEX64_RE.fullmatch(binding.get("canonical_ref_set_sha256", "")) is not None, "invalid canonical ref-set digest")
    digest = binding.get("binding_sha256", "")
    require(HEX64_RE.fullmatch(digest) is not None, "invalid predecessor binding digest")
    require(self_digest(binding, "binding_sha256") == digest, "predecessor binding self-digest mismatch")
    claims = binding.get("claims") or {}
    require(claims.get("repository_scoped_canonical_predecessor_recorded") is True, "predecessor binding must explicitly record repository-scoped predecessor")
    for key in ["universal_canonicality_established", "future_successor_selected", "ownership_adjudicated", "truth_certified"]:
        require(claims.get(key) is False, f"unsafe predecessor binding claim: {key}")


def proposal_claims() -> dict[str, Any]:
    return {
        "candidate_is_noncanonical": True,
        "proposal_only": True,
        "human_recognition_required": True,
        "canonical_successor_established": False,
        "canonical_origin_mutated": False,
        "ownership_transferred": False,
        "kontur_activated": False,
        "distributed_consensus_established": False,
        "universal_canonicality_established": False,
        "legal_effect_established": False,
        "truth_certified": False,
    }


def validate_proposal_claims(proposal: dict[str, Any]) -> None:
    claims = proposal.get("claims") or {}
    require(claims.get("candidate_is_noncanonical") is True, "candidate must remain explicitly non-canonical")
    require(claims.get("proposal_only") is True, "artifact must remain proposal-only")
    require(claims.get("human_recognition_required") is True, "human recognition must remain required")
    for key in [
        "canonical_successor_established", "canonical_origin_mutated", "ownership_transferred", "kontur_activated",
        "distributed_consensus_established", "universal_canonicality_established", "legal_effect_established", "truth_certified",
    ]:
        require(claims.get(key) is False, f"unsafe succession proposal claim: {key}")


def candidate_state(recovery_dir: Path, candidate_ref: str) -> dict[str, Any]:
    require(LOCAL_BRANCH_RE.fullmatch(candidate_ref) is not None, "candidate-ref must be an explicit local refs/heads/* ref")
    v04 = load_v04_module()
    receipt = v04.verify_recovery(recovery_dir)
    repo = recovery_dir / "repository.git"
    bare = run_git(["-C", str(repo), "rev-parse", "--is-bare-repository"]).stdout.strip()
    require(bare == "true", "candidate repository must be bare")
    remotes = run_git(["-C", str(repo), "remote"]).stdout.split()
    require(remotes == [], "candidate repository must contain no Git remotes")
    run_git(["-C", str(repo), "fsck", "--full"])
    resolved = run_git(["-C", str(repo), "rev-parse", f"{candidate_ref}^{{commit}}"], check=False)
    require(resolved.returncode == 0, "candidate ref does not resolve to a commit")
    candidate_commit = resolved.stdout.strip()
    require(OID_RE.fullmatch(candidate_commit) is not None, "invalid candidate commit")
    recovered = receipt["recovered_frontier_commit"]
    ancestry = run_git(["-C", str(repo), "merge-base", "--is-ancestor", recovered, candidate_commit], check=False)
    require(ancestry.returncode == 0, "candidate frontier does not descend from recovered frontier")
    tree = run_git(["-C", str(repo), "rev-parse", f"{candidate_commit}^{{tree}}"]).stdout.strip()
    return {
        "receipt": receipt,
        "repo": repo,
        "candidate_commit": candidate_commit,
        "candidate_tree": tree,
        "candidate_ref_set_sha256": ref_set_sha256(repo),
        "candidate_advances_recovered_frontier": candidate_commit != recovered,
    }


def create_proposal(policy: dict[str, Any], binding: dict[str, Any], recovery_dir: Path, candidate_ref: str, proposer_id: str, at: str | None = None) -> dict[str, Any]:
    validate_policy(policy)
    validate_predecessor_binding(binding)
    require(policy.get("project_id") == binding.get("project_id"), "policy/predecessor project mismatch")
    require(isinstance(proposer_id, str) and proposer_id, "proposer_id is required")
    state = candidate_state(recovery_dir, candidate_ref)
    receipt = state["receipt"]
    require(receipt.get("project_id") == policy.get("project_id"), "recovery receipt project mismatch")
    require(receipt.get("recovered_frontier_commit") == binding.get("canonical_frontier_commit"), "recovered frontier does not match canonical predecessor binding")
    now = parse_time(at) if at else datetime.now(timezone.utc)
    proposal = {
        "artifact_type": "CanonicalSuccessionProposal",
        "artifact_version": "0.5",
        "proposal_id": "urn:uu-aap:canonical-succession-proposal:" + sha256_json({
            "predecessor": binding["binding_sha256"],
            "receipt": receipt["receipt_sha256"],
            "candidate": state["candidate_commit"],
            "ref": candidate_ref,
            "proposer": proposer_id,
        })[:24],
        "created_at": iso_z(now),
        "project_id": policy["project_id"],
        "proposer_id": proposer_id,
        "predecessor_binding_sha256": binding["binding_sha256"],
        "predecessor_origin_id": binding["canonical_origin_id"],
        "predecessor_frontier_commit": binding["canonical_frontier_commit"],
        "recovery_execution_receipt_sha256": receipt["receipt_sha256"],
        "recovered_frontier_commit": receipt["recovered_frontier_commit"],
        "candidate_ref": candidate_ref,
        "candidate_frontier_commit": state["candidate_commit"],
        "candidate_frontier_tree": state["candidate_tree"],
        "candidate_ref_set_sha256": state["candidate_ref_set_sha256"],
        "candidate_advances_recovered_frontier": state["candidate_advances_recovered_frontier"],
        "proposal_sha256": "0" * 64,
        "claims": proposal_claims(),
    }
    proposal["proposal_sha256"] = self_digest(proposal, "proposal_sha256")
    return proposal


def assess_proposal(policy: dict[str, Any], binding: dict[str, Any], recovery_dir: Path, proposal: dict[str, Any], at: str | None = None) -> dict[str, Any]:
    validate_policy(policy)
    reasons: list[str] = []
    checks = {
        "v04_recovery_verified": False,
        "predecessor_binding_verified": False,
        "project_binding_match": False,
        "recovered_frontier_matches_predecessor": False,
        "candidate_ref_valid": False,
        "candidate_repo_no_remotes": False,
        "candidate_repo_fsck_full": False,
        "candidate_descends_from_recovered_frontier": False,
        "candidate_tree_match": False,
        "candidate_ref_set_match": False,
        "proposal_self_digest_match": False,
    }

    try:
        validate_predecessor_binding(binding)
        checks["predecessor_binding_verified"] = True
    except Exception as exc:
        reasons.append(str(exc))

    digest = proposal.get("proposal_sha256", "")
    if HEX64_RE.fullmatch(digest or "") and self_digest(proposal, "proposal_sha256") == digest:
        checks["proposal_self_digest_match"] = True
    else:
        reasons.append("proposal self-digest mismatch")

    try:
        require(proposal.get("artifact_type") == "CanonicalSuccessionProposal", "CanonicalSuccessionProposal required")
        require(proposal.get("artifact_version") == "0.5", "CanonicalSuccessionProposal v0.5 required")
        validate_proposal_claims(proposal)
    except Exception as exc:
        reasons.append(str(exc))

    receipt: dict[str, Any] | None = None
    repo = recovery_dir / "repository.git"
    v04 = load_v04_module()
    try:
        receipt = v04.verify_recovery(recovery_dir)
        checks["v04_recovery_verified"] = True
    except Exception as exc:
        reasons.append(f"v0.4 recovery verification failed: {exc}")

    if checks["predecessor_binding_verified"] and receipt is not None:
        checks["project_binding_match"] = (
            policy.get("project_id") == binding.get("project_id") == receipt.get("project_id") == proposal.get("project_id")
            and proposal.get("predecessor_binding_sha256") == binding.get("binding_sha256")
            and proposal.get("predecessor_origin_id") == binding.get("canonical_origin_id")
            and proposal.get("recovery_execution_receipt_sha256") == receipt.get("receipt_sha256")
        )
        if not checks["project_binding_match"]:
            reasons.append("project/predecessor/recovery receipt binding mismatch")
        checks["recovered_frontier_matches_predecessor"] = (
            receipt.get("recovered_frontier_commit") == binding.get("canonical_frontier_commit")
            == proposal.get("recovered_frontier_commit") == proposal.get("predecessor_frontier_commit")
        )
        if not checks["recovered_frontier_matches_predecessor"]:
            reasons.append("recovered frontier does not match canonical predecessor")

    candidate_ref = proposal.get("candidate_ref", "")
    if LOCAL_BRANCH_RE.fullmatch(candidate_ref or "") is not None:
        resolved = run_git(["-C", str(repo), "rev-parse", f"{candidate_ref}^{{commit}}"], check=False) if repo.exists() else None
        if resolved is not None and resolved.returncode == 0 and resolved.stdout.strip() == proposal.get("candidate_frontier_commit"):
            checks["candidate_ref_valid"] = True
        else:
            reasons.append("candidate ref does not resolve to proposal candidate commit")
    else:
        reasons.append("candidate ref is not an explicit local branch")

    if repo.exists() and repo.is_dir() and not repo.is_symlink():
        bare = run_git(["-C", str(repo), "rev-parse", "--is-bare-repository"], check=False)
        remotes = run_git(["-C", str(repo), "remote"], check=False)
        checks["candidate_repo_no_remotes"] = bare.returncode == 0 and bare.stdout.strip() == "true" and remotes.returncode == 0 and remotes.stdout.split() == []
        if not checks["candidate_repo_no_remotes"]:
            reasons.append("candidate repository is not bare or contains remotes")
        fsck = run_git(["-C", str(repo), "fsck", "--full"], check=False)
        checks["candidate_repo_fsck_full"] = fsck.returncode == 0
        if not checks["candidate_repo_fsck_full"]:
            reasons.append("candidate repository git fsck --full failed")

        candidate_commit = proposal.get("candidate_frontier_commit", "")
        recovered = proposal.get("recovered_frontier_commit", "")
        if OID_RE.fullmatch(candidate_commit or "") and OID_RE.fullmatch(recovered or ""):
            ancestry = run_git(["-C", str(repo), "merge-base", "--is-ancestor", recovered, candidate_commit], check=False)
            checks["candidate_descends_from_recovered_frontier"] = ancestry.returncode == 0
            if not checks["candidate_descends_from_recovered_frontier"]:
                reasons.append("candidate frontier does not descend from recovered frontier")
            tree = run_git(["-C", str(repo), "rev-parse", f"{candidate_commit}^{{tree}}"], check=False)
            checks["candidate_tree_match"] = tree.returncode == 0 and tree.stdout.strip() == proposal.get("candidate_frontier_tree")
            if not checks["candidate_tree_match"]:
                reasons.append("candidate tree mismatch")
        current_ref_set = ref_set_sha256(repo)
        checks["candidate_ref_set_match"] = current_ref_set == proposal.get("candidate_ref_set_sha256")
        if not checks["candidate_ref_set_match"]:
            reasons.append("candidate ref-set digest mismatch")
    else:
        reasons.append("candidate repository missing or unsafe")

    all_ok = all(checks.values())
    state = "proposal_reviewable" if all_ok else "rejected"
    decision = "human_canonical_recognition_may_be_requested" if all_ok else "reject_proposal"
    if all_ok:
        reasons = ["all proposal admissibility checks passed; separate human canonical recognition remains required"]

    now = parse_time(at) if at else datetime.now(timezone.utc)
    assessment = {
        "artifact_type": "CanonicalSuccessionProposalAssessment",
        "artifact_version": "0.5",
        "assessment_id": "urn:uu-aap:canonical-succession-assessment:" + sha256_json({
            "proposal": digest,
            "at": iso_z(now),
            "state": state,
        })[:24],
        "evaluated_at": iso_z(now),
        "project_id": policy["project_id"],
        "proposal_sha256": digest if HEX64_RE.fullmatch(digest or "") else sha256_json(proposal),
        "policy_sha256": sha256_json(policy),
        "state": state,
        "decision": decision,
        "checks": checks,
        "reasons": reasons,
        "assessment_sha256": "0" * 64,
        "claims": {
            "proposal_reviewability_only": True,
            "human_recognition_required": True,
            "canonical_successor_established": False,
            "canonical_origin_mutated": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "distributed_consensus_established": False,
            "legal_effect_established": False,
            "truth_certified": False,
        },
    }
    assessment["assessment_sha256"] = self_digest(assessment, "assessment_sha256")
    return assessment


def main() -> int:
    parser = argparse.ArgumentParser(description="UU-AAP Canonical Succession Proposal Protocol v0.5")
    sub = parser.add_subparsers(dest="cmd", required=True)

    bp = sub.add_parser("bind-predecessor")
    bp.add_argument("--project-id", required=True)
    bp.add_argument("--origin-id", required=True)
    bp.add_argument("--repo", required=True)
    bp.add_argument("--frontier-ref", required=True)
    bp.add_argument("--out", required=True)
    bp.add_argument("--at")

    pp = sub.add_parser("propose")
    pp.add_argument("--policy", required=True)
    pp.add_argument("--predecessor-binding", required=True)
    pp.add_argument("--recovery-dir", required=True)
    pp.add_argument("--candidate-ref", required=True)
    pp.add_argument("--proposer-id", required=True)
    pp.add_argument("--out", required=True)
    pp.add_argument("--at")

    ap = sub.add_parser("assess")
    ap.add_argument("--policy", required=True)
    ap.add_argument("--predecessor-binding", required=True)
    ap.add_argument("--recovery-dir", required=True)
    ap.add_argument("--proposal", required=True)
    ap.add_argument("--out")
    ap.add_argument("--at")

    args = parser.parse_args()
    try:
        if args.cmd == "bind-predecessor":
            result = bind_predecessor(args.project_id, args.origin_id, Path(args.repo), args.frontier_ref, args.at)
            write_json(Path(args.out), result)
        elif args.cmd == "propose":
            result = create_proposal(
                load_json(Path(args.policy)), load_json(Path(args.predecessor_binding)),
                Path(args.recovery_dir), args.candidate_ref, args.proposer_id, args.at,
            )
            write_json(Path(args.out), result)
        else:
            result = assess_proposal(
                load_json(Path(args.policy)), load_json(Path(args.predecessor_binding)),
                Path(args.recovery_dir), load_json(Path(args.proposal)), args.at,
            )
            text = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
            if args.out:
                Path(args.out).write_text(text, encoding="utf-8")
            else:
                print(text, end="")
            return 0 if result["state"] == "proposal_reviewable" else 2
    except Exception as exc:
        print(f"canonical succession proposal operation failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
