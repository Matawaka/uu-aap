#!/usr/bin/env python3
"""Offline, disposable restore drill for UU-AAP Continuity v0.1 Git bundles."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TOOL_VERSION = "0.3"
SOURCE_SCHEMA = "urn:uu-aap:continuity:manifest:v0.1"
RECEIPT_SCHEMA = "urn:uu-aap:continuity:restore-drill-receipt:v0.3"

FALSE_CLAIMS = (
    "rescue_performed",
    "recovered_noncanonical_state_created",
    "persistent_recovery_workspace_created",
    "canonical_successor_claimed",
    "authority_transferred",
    "repository_ownership_transferred",
    "kontur_readiness_established",
    "kontur_activated",
    "execution_authority_granted",
    "distributed_consensus_claimed",
    "legal_effect_established",
    "truth_certified",
    "physical_independence_proven",
    "hosted_metadata_restored",
)


class DrillError(RuntimeError):
    pass


def run_git(args: list[str], cwd: Path | None = None) -> str:
    if shutil.which("git") is None:
        raise DrillError("git executable not found")
    proc = subprocess.run(
        ["git", *args],
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        env=None,
    )
    if proc.returncode != 0:
        raise DrillError(f"git command failed ({proc.returncode}): git {' '.join(args)}\n{proc.stdout}")
    return proc.stdout.strip()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_git_sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or len(value) != 40 or any(ch not in "0123456789abcdef" for ch in value):
        raise DrillError(f"invalid {label}")
    return value


def require_sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value):
        raise DrillError(f"invalid {label}")
    return value


def normalize_refs(items: list[dict[str, str]]) -> list[dict[str, str]]:
    normalized: dict[str, str] = {}
    for item in items:
        ref = item.get("ref")
        sha = item.get("object_sha")
        if not isinstance(ref, str) or not ref.startswith("refs/"):
            raise DrillError("invalid captured ref name")
        require_git_sha(sha, f"captured ref SHA for {ref}")
        if ref in normalized:
            raise DrillError(f"duplicate captured ref: {ref}")
        normalized[ref] = sha
    if not normalized:
        raise DrillError("captured ref set is empty")
    return [{"ref": ref, "object_sha": normalized[ref]} for ref in sorted(normalized)]


def refs_digest(items: list[dict[str, str]]) -> str:
    payload = json.dumps(items, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return sha256_bytes(payload)


def bundle_refs(bundle: Path) -> list[dict[str, str]]:
    output = run_git(["bundle", "list-heads", str(bundle)])
    refs: list[dict[str, str]] = []
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            sha, ref = line.split(maxsplit=1)
        except ValueError as exc:
            raise DrillError(f"invalid git bundle list-heads output: {line}") from exc
        if not ref.startswith("refs/"):
            continue
        refs.append({"ref": ref, "object_sha": require_git_sha(sha, f"bundle ref SHA for {ref}")})
    return normalize_refs(refs)


def repository_refs(repo: Path) -> list[dict[str, str]]:
    output = run_git(["for-each-ref", "--format=%(refname)%00%(objectname)"], cwd=repo)
    refs: list[dict[str, str]] = []
    for line in output.splitlines():
        if not line:
            continue
        ref, sha = line.split("\x00", 1)
        refs.append({"ref": ref, "object_sha": sha})
    return normalize_refs(refs)


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DrillError(f"cannot read continuity manifest: {exc}") from exc
    if manifest.get("schema_id") != SOURCE_SCHEMA:
        raise DrillError("Continuity v0.1 manifest required")
    source = manifest.get("source")
    integrity = manifest.get("integrity")
    if not isinstance(source, dict) or not isinstance(integrity, dict):
        raise DrillError("continuity manifest source/integrity missing")
    require_git_sha(source.get("main_commit_sha"), "captured main SHA")
    require_git_sha(source.get("main_tree_sha"), "captured main tree SHA")
    if not isinstance(source.get("main_branch"), str) or not source["main_branch"]:
        raise DrillError("captured main branch missing")
    require_sha256(integrity.get("bundle_sha256"), "captured bundle SHA-256")
    if integrity.get("bundle_verify") != "pass":
        raise DrillError("source manifest does not record bundle verification pass")
    if not isinstance(integrity.get("bundle_file"), str) or not integrity["bundle_file"]:
        raise DrillError("bundle file missing from source manifest")
    if not isinstance(manifest.get("refs"), list):
        raise DrillError("captured refs missing")
    normalize_refs(manifest["refs"])
    return manifest


def adjacent_bundle(manifest_path: Path, bundle_file: str) -> Path:
    parent = manifest_path.parent.resolve()
    candidate = (parent / bundle_file).resolve()
    if candidate.parent != parent or candidate.name != bundle_file:
        raise DrillError("bundle_file must name a file adjacent to the continuity manifest")
    if not candidate.is_file():
        raise DrillError(f"bundle not found: {candidate}")
    return candidate


def validate_receipt(receipt: dict[str, Any]) -> None:
    if receipt.get("schema_id") != RECEIPT_SCHEMA or receipt.get("tool_version") != TOOL_VERSION:
        raise DrillError("unexpected restore drill receipt version")
    source = receipt.get("source_manifest", {})
    bundle = receipt.get("bundle", {})
    frontier = receipt.get("captured_frontier", {})
    ref_integrity = receipt.get("ref_integrity", {})
    drill = receipt.get("drill", {})
    claims = receipt.get("claims", {})
    if source.get("schema_id") != SOURCE_SCHEMA:
        raise DrillError("receipt source manifest binding invalid")
    require_sha256(source.get("sha256"), "receipt source manifest SHA-256")
    require_sha256(bundle.get("sha256"), "receipt bundle SHA-256")
    if bundle.get("offline_capable") is not True:
        raise DrillError("receipt offline capability claim missing")
    require_git_sha(frontier.get("main_commit_sha"), "receipt main SHA")
    require_git_sha(frontier.get("main_tree_sha"), "receipt tree SHA")
    for key in (
        "captured_ref_set_sha256",
        "bundle_ref_set_sha256",
        "restored_ref_set_sha256",
    ):
        require_sha256(ref_integrity.get(key), key)
    counts = [ref_integrity.get(k) for k in ("captured_ref_count", "bundle_ref_count", "restored_ref_count")]
    if not all(isinstance(v, int) and v > 0 for v in counts) or len(set(counts)) != 1:
        raise DrillError("receipt ref counts are not exact")
    digests = [
        ref_integrity["captured_ref_set_sha256"],
        ref_integrity["bundle_ref_set_sha256"],
        ref_integrity["restored_ref_set_sha256"],
    ]
    if len(set(digests)) != 1:
        raise DrillError("receipt ref-set digests are not exact")
    required_true = (
        "bundle_digest_verified",
        "bundle_integrity_verified",
        "captured_refs_match_bundle",
        "restored_refs_match_capture",
        "restored_main_matches_capture",
        "restored_tree_matches_capture",
        "restored_repository_fsck_passed",
        "temporary_restore_removed",
        "restore_drill_verified",
    )
    for key in required_true:
        if drill.get(key) is not True:
            raise DrillError(f"receipt drill claim must be true: {key}")
    for key in FALSE_CLAIMS:
        if claims.get(key) is not False:
            raise DrillError(f"receipt prohibited claim must be false: {key}")


def drill(manifest_path: Path, out: Path, observed_at: str | None) -> dict[str, Any]:
    manifest_path = manifest_path.resolve()
    manifest = load_manifest(manifest_path)
    source = manifest["source"]
    integrity = manifest["integrity"]
    bundle = adjacent_bundle(manifest_path, integrity["bundle_file"])

    manifest_sha = sha256_file(manifest_path)
    actual_bundle_sha = sha256_file(bundle)
    if actual_bundle_sha != integrity["bundle_sha256"]:
        raise DrillError("bundle SHA-256 mismatch")

    run_git(["bundle", "verify", str(bundle)])
    captured = normalize_refs(manifest["refs"])
    advertised = bundle_refs(bundle)
    if advertised != captured:
        raise DrillError("captured ref set does not exactly match bundle-advertised refs")

    temp_root = Path(tempfile.mkdtemp(prefix="uu-aap-continuity-restore-drill-"))
    restored = temp_root / "restored.git"
    restored_refs: list[dict[str, str]] | None = None
    restored_main = ""
    restored_tree = ""
    fsck_passed = False
    try:
        run_git(["clone", "--mirror", str(bundle), str(restored)])
        run_git(["fsck", "--full"], cwd=restored)
        fsck_passed = True
        restored_refs = repository_refs(restored)
        if restored_refs != captured:
            raise DrillError("restored ref set does not exactly match captured refs")
        main_ref = f"refs/heads/{source['main_branch']}"
        restored_main = run_git(["rev-parse", "--verify", main_ref], cwd=restored)
        restored_tree = run_git(["rev-parse", f"{main_ref}^{{tree}}"], cwd=restored)
        if restored_main != source["main_commit_sha"]:
            raise DrillError("restored main SHA does not match captured main")
        if restored_tree != source["main_tree_sha"]:
            raise DrillError("restored main tree does not match captured tree")
    finally:
        shutil.rmtree(temp_root, ignore_errors=False)

    if temp_root.exists():
        raise DrillError("temporary restored repository was not removed")
    if restored_refs is None or not fsck_passed:
        raise DrillError("restore drill did not complete")

    receipt: dict[str, Any] = {
        "$schema": "./restore-drill-receipt.schema.json",
        "schema_id": RECEIPT_SCHEMA,
        "tool_version": TOOL_VERSION,
        "observed_at_utc": observed_at or utc_now(),
        "source_manifest": {"schema_id": SOURCE_SCHEMA, "sha256": manifest_sha},
        "bundle": {
            "file_name": bundle.name,
            "sha256": actual_bundle_sha,
            "offline_capable": True,
        },
        "captured_frontier": {
            "main_branch": source["main_branch"],
            "main_commit_sha": restored_main,
            "main_tree_sha": restored_tree,
        },
        "ref_integrity": {
            "captured_ref_count": len(captured),
            "bundle_ref_count": len(advertised),
            "restored_ref_count": len(restored_refs),
            "captured_ref_set_sha256": refs_digest(captured),
            "bundle_ref_set_sha256": refs_digest(advertised),
            "restored_ref_set_sha256": refs_digest(restored_refs),
        },
        "drill": {
            "bundle_digest_verified": True,
            "bundle_integrity_verified": True,
            "captured_refs_match_bundle": True,
            "restored_refs_match_capture": True,
            "restored_main_matches_capture": True,
            "restored_tree_matches_capture": True,
            "restored_repository_fsck_passed": True,
            "temporary_restore_removed": True,
            "restore_drill_verified": True,
        },
        "claims": {key: False for key in FALSE_CLAIMS},
    }
    validate_receipt(receipt)
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return receipt


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Verify a Continuity v0.1 bundle by disposable offline reconstruction.")
    sub = p.add_subparsers(dest="command", required=True)
    d = sub.add_parser("drill")
    d.add_argument("--manifest", required=True)
    d.add_argument("--out", required=True)
    d.add_argument("--observed-at", help="explicit RFC3339 timestamp for deterministic fixtures")
    d.set_defaults(mode="drill")
    v = sub.add_parser("validate-receipt")
    v.add_argument("--receipt", required=True)
    v.set_defaults(mode="validate")
    return p


def main() -> int:
    try:
        args = parser().parse_args()
        if args.mode == "drill":
            receipt = drill(Path(args.manifest), Path(args.out), args.observed_at)
            print("CONTINUITY RESTORE DRILL VERIFIED")
            print(f"main: {receipt['captured_frontier']['main_commit_sha']}")
            print(f"refs: {receipt['ref_integrity']['restored_ref_count']}")
        else:
            receipt = json.loads(Path(args.receipt).read_text(encoding="utf-8"))
            validate_receipt(receipt)
            print("CONTINUITY RESTORE DRILL RECEIPT VALID")
        return 0
    except (DrillError, OSError, json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"CONTINUITY RESTORE DRILL ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
