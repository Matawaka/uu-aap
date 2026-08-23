#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import shutil
import subprocess
import tempfile
from pathlib import Path


V04 = Path(__file__).resolve().parent
V03 = V04.parent / "v0.3"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


E = load_module("rescue_execution_v04_test", V04 / "rescue_execution.py")
C = load_module("rescue_capsule_v03_test", V03 / "rescue_capsule.py")


def run(args, cwd=None):
    return subprocess.run(args, cwd=cwd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def write_json(path: Path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def expect_fail(fn, contains=None):
    try:
        fn()
    except Exception as exc:
        if contains and contains not in str(exc):
            raise AssertionError(f"failure did not contain {contains!r}: {exc}") from exc
        return
    raise AssertionError("operation unexpectedly succeeded")


def make_assessment():
    assessment = {
        "artifact_type": "ProjectRescueAssessment",
        "artifact_version": "0.1",
        "assessment_id": "urn:test:rescue-assessment:1",
        "case_id": "urn:test:rescue-case:1",
        "evaluated_at": "2026-08-23T14:00:00Z",
        "state": "rescue_eligible",
        "loss_classification": "destructive_loss",
        "metrics": {"fixture": True},
        "preventer_result": "exhausted",
        "recovery_result": "verified_source_available",
        "decision": "human_rescue_authorization_may_be_requested",
        "reasons": ["synthetic test fixture"],
        "case_sha256": "1" * 64,
        "policy_sha256": "2" * 64,
        "assessment_sha256": "0" * 64,
        "claims": {
            "loss_confirmed": True,
            "rescue_eligible": True,
            "execution_authority_granted": False,
            "canonical_successor_established": False,
            "automatic_failover_executed": False,
            "legal_effect_established": False,
            "truth_certified": False,
        },
    }
    assessment["assessment_sha256"] = E.self_digest(assessment, "assessment_sha256")
    return assessment


def make_auth(assessment_sha: str, source_id="source-bundle-1", nonce="test-rescue-nonce-00000001"):
    return {
        "artifact_type": "ProjectRescueAuthorization",
        "artifact_version": "0.1",
        "authorization_id": "urn:test:rescue-authorization:1",
        "assessment_sha256": assessment_sha,
        "selected_recovery_source_id": source_id,
        "authorized_scope": ["reconstruct_noncanonical_git_copy"],
        "human_actor_id": "human:test-operator",
        "issued_at": "2026-08-23T14:30:00Z",
        "expires_at": "2026-08-23T16:30:00Z",
        "nonce": nonce,
        "decision": "authorize_noncanonical_rescue",
        "claims": {
            "execution_scope_limited": True,
            "canonical_successor_established": False,
            "ownership_transferred": False,
            "kontur_activated": False,
            "distributed_consensus_established": False,
            "legal_effect_established": False,
            "truth_certified": False,
        },
    }


def main():
    policy = V04 / "reference.rescue-execution-policy.json"
    with tempfile.TemporaryDirectory(prefix="uu-aap-rescue-v04-test-") as td:
        t = Path(td)
        source_repo = t / "source"
        source_repo.mkdir()
        run(["git", "init", "-b", "main"], cwd=source_repo)
        run(["git", "config", "user.email", "test@example.invalid"], cwd=source_repo)
        run(["git", "config", "user.name", "UU-AAP Test"], cwd=source_repo)
        (source_repo / "README.md").write_text("synthetic rescue source\n", encoding="utf-8")
        run(["git", "add", "README.md"], cwd=source_repo)
        run(["git", "commit", "-m", "synthetic frontier"], cwd=source_repo)
        frontier = run(["git", "rev-parse", "HEAD"], cwd=source_repo).stdout.strip()
        run(["git", "tag", "rescue-test-frontier"], cwd=source_repo)

        bundle = t / "recovery.bundle"
        run(["git", "bundle", "create", str(bundle), "--all"], cwd=source_repo)
        bundle_sha = E.file_sha256(bundle)

        assessment = make_assessment()
        assessment_path = t / "assessment.json"
        write_json(assessment_path, assessment)

        binding = {
            "artifact_type": "RecoverySourceBinding",
            "artifact_version": "0.4",
            "source_id": "source-bundle-1",
            "source_kind": "git_bundle",
            "payload_sha256": bundle_sha,
            "frontier_commit": frontier,
            "failure_domain_id": "offline-media:test",
            "verified": True,
            "claims": {
                "canonical": False,
                "authority_transfer": False,
                "network_source": False,
                "truth_certified": False,
            },
        }
        binding_path = t / "binding.json"
        write_json(binding_path, binding)

        capsule = t / "capsule"
        C.create_capsule(
            "Matawaka/uu-aap",
            frontier,
            capsule,
            [f"rescue_assessment:{assessment_path}", f"recovery_source_manifest:{binding_path}"],
            "2026-08-23T14:20:00Z",
        )

        auth = make_auth(assessment["assessment_sha256"])
        auth_path = t / "authorization.json"
        write_json(auth_path, auth)

        preflight = E.prepare_context(
            capsule, auth_path, bundle, policy,
            "2026-08-23T15:00:00Z", "recovered",
        )
        assert preflight["plan"]["claims"]["limited_execution_authority_validated"] is True
        assert preflight["plan"]["claims"]["execution_performed"] is False
        assert preflight["plan"]["claims"]["canonical_successor_established"] is False

        source_sha_before = E.file_sha256(bundle)
        destination = t / "recovered"
        state = t / "state"
        E.execute_recovery(
            capsule, auth_path, bundle, destination, state, policy,
            "2026-08-23T15:00:00Z",
        )
        assert E.file_sha256(bundle) == source_sha_before, "recovery source mutated"
        receipt = E.verify_recovery(destination)
        assert receipt["claims"]["noncanonical_recovery_executed"] is True
        assert receipt["claims"]["canonical_successor_established"] is False
        assert receipt["claims"]["kontur_activated"] is False
        assert receipt["git_remote_count"] == 0
        assert run(["git", "-C", str(destination / "repository.git"), "remote"]).stdout.strip() == ""
        run(["git", "-C", str(destination / "repository.git"), "cat-file", "-e", f"{frontier}^{{commit}}"])

        replay_dest = t / "replay"
        expect_fail(
            lambda: E.execute_recovery(
                capsule, auth_path, bundle, replay_dest, state, policy,
                "2026-08-23T15:01:00Z",
            ),
            "nonce already consumed",
        )
        assert not replay_dest.exists()

        bad_auth = copy.deepcopy(auth)
        bad_auth["assessment_sha256"] = "0" * 64
        bad_auth_path = t / "bad-auth.json"
        write_json(bad_auth_path, bad_auth)
        expect_fail(
            lambda: E.prepare_context(capsule, bad_auth_path, bundle, policy, "2026-08-23T15:00:00Z"),
            "assessment binding mismatch",
        )

        expired = copy.deepcopy(auth)
        expired["expires_at"] = "2026-08-23T14:59:59Z"
        expired["nonce"] = "test-rescue-nonce-expired-0001"
        expired_path = t / "expired-auth.json"
        write_json(expired_path, expired)
        expect_fail(
            lambda: E.prepare_context(capsule, expired_path, bundle, policy, "2026-08-23T15:00:00Z"),
            "not active",
        )

        wrong_source = copy.deepcopy(auth)
        wrong_source["selected_recovery_source_id"] = "source-does-not-exist"
        wrong_source["nonce"] = "test-rescue-nonce-source-00001"
        wrong_source_path = t / "wrong-source.json"
        write_json(wrong_source_path, wrong_source)
        expect_fail(
            lambda: E.prepare_context(capsule, wrong_source_path, bundle, policy, "2026-08-23T15:00:00Z"),
            "exactly one selected",
        )

        tampered_bundle = t / "tampered.bundle"
        shutil.copyfile(bundle, tampered_bundle)
        with tampered_bundle.open("ab") as f:
            f.write(b"TAMPER")
        expect_fail(
            lambda: E.prepare_context(capsule, auth_path, tampered_bundle, policy, "2026-08-23T15:00:00Z"),
            "SHA-256 mismatch",
        )

        tampered_output = t / "tampered-output"
        shutil.copytree(destination, tampered_output)
        receipt_path = tampered_output / "rescue-execution-receipt.json"
        receipt_obj = json.loads(receipt_path.read_text(encoding="utf-8"))
        receipt_obj["git_remote_count"] = 1
        write_json(receipt_path, receipt_obj)
        expect_fail(
            lambda: E.verify_recovery(tampered_output),
            "receipt self-digest mismatch",
        )

        missing_marker = t / "missing-marker"
        shutil.copytree(destination, missing_marker)
        (missing_marker / "NON_CANONICAL_RECOVERY").unlink()
        expect_fail(
            lambda: E.verify_recovery(missing_marker),
            "marker missing",
        )

        existing = t / "existing"
        existing.mkdir()
        fresh_auth = make_auth(
            assessment["assessment_sha256"],
            nonce="test-rescue-nonce-existing-0001",
        )
        fresh_path = t / "fresh-auth.json"
        write_json(fresh_path, fresh_auth)
        before_reservations = list((state / "used-nonces").glob("*.json"))
        expect_fail(
            lambda: E.execute_recovery(
                capsule, fresh_path, bundle, existing, state, policy,
                "2026-08-23T15:00:00Z",
            ),
            "destination must not already exist",
        )
        after_reservations = list((state / "used-nonces").glob("*.json"))
        assert len(after_reservations) == len(before_reservations), "destination preflight failure consumed nonce"

    print("Project Survival Plane v0.4 Rescue Execution Envelope tests: PASS")


if __name__ == "__main__":
    main()
