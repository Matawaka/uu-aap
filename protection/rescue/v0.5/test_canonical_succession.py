#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

V05 = Path(__file__).resolve().parent
V04 = V05.parent / "v0.4"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


S = load_module("canonical_succession_v05_test", V05 / "canonical_succession.py")
T = load_module("rescue_execution_test_helpers_v04", V04 / "test_rescue_execution.py")


def run(args, cwd=None, env=None):
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return subprocess.run(args, cwd=cwd, env=merged, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


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


def main():
    policy_path = V05 / "reference.canonical-succession-policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    v04_policy = V04 / "reference.rescue-execution-policy.json"

    with tempfile.TemporaryDirectory(prefix="uu-aap-rescue-v05-test-") as td:
        t = Path(td)
        source_repo = t / "source"
        source_repo.mkdir()
        run(["git", "init", "-b", "main"], cwd=source_repo)
        run(["git", "config", "user.email", "test@example.invalid"], cwd=source_repo)
        run(["git", "config", "user.name", "UU-AAP Test"], cwd=source_repo)
        (source_repo / "README.md").write_text("synthetic canonical predecessor\n", encoding="utf-8")
        run(["git", "add", "README.md"], cwd=source_repo)
        run(["git", "commit", "-m", "synthetic predecessor frontier"], cwd=source_repo)
        frontier = run(["git", "rev-parse", "HEAD"], cwd=source_repo).stdout.strip()
        run(["git", "tag", "synthetic-predecessor"], cwd=source_repo)

        predecessor = S.bind_predecessor(
            "Matawaka/uu-aap",
            "https://github.com/Matawaka/uu-aap",
            source_repo,
            "refs/heads/main",
            "2026-08-23T15:10:00Z",
        )
        S.validate_predecessor_binding(predecessor)
        assert predecessor["canonical_frontier_commit"] == frontier
        assert predecessor["claims"]["future_successor_selected"] is False

        bundle = t / "recovery.bundle"
        run(["git", "bundle", "create", str(bundle), "--all"], cwd=source_repo)
        bundle_sha = T.E.file_sha256(bundle)

        assessment = T.make_assessment()
        assessment_path = t / "assessment.json"
        write_json(assessment_path, assessment)
        source_binding = {
            "artifact_type": "RecoverySourceBinding",
            "artifact_version": "0.4",
            "source_id": "source-bundle-v05",
            "source_kind": "git_bundle",
            "payload_sha256": bundle_sha,
            "frontier_commit": frontier,
            "failure_domain_id": "offline-media:test-v05",
            "verified": True,
            "claims": {
                "canonical": False,
                "authority_transfer": False,
                "network_source": False,
                "truth_certified": False
            }
        }
        source_binding_path = t / "recovery-source-binding.json"
        write_json(source_binding_path, source_binding)

        capsule = t / "capsule"
        T.C.create_capsule(
            "Matawaka/uu-aap",
            frontier,
            capsule,
            [f"rescue_assessment:{assessment_path}", f"recovery_source_manifest:{source_binding_path}"],
            "2026-08-23T15:20:00Z",
        )
        auth = T.make_auth(
            assessment["assessment_sha256"],
            source_id="source-bundle-v05",
            nonce="test-rescue-v05-nonce-00000001",
        )
        auth_path = t / "authorization.json"
        write_json(auth_path, auth)

        recovery = t / "recovered"
        T.E.execute_recovery(
            capsule, auth_path, bundle, recovery, t / "state", v04_policy,
            "2026-08-23T15:30:00Z",
        )
        receipt = T.E.verify_recovery(recovery)
        assert receipt["recovered_frontier_commit"] == frontier

        repo = recovery / "repository.git"
        tree = run(["git", "-C", str(repo), "rev-parse", f"{frontier}^{{tree}}"]).stdout.strip()
        candidate = run(
            ["git", "-C", str(repo), "commit-tree", tree, "-p", frontier, "-m", "local post-recovery candidate"],
            env={
                "GIT_AUTHOR_NAME": "UU-AAP Test",
                "GIT_AUTHOR_EMAIL": "test@example.invalid",
                "GIT_COMMITTER_NAME": "UU-AAP Test",
                "GIT_COMMITTER_EMAIL": "test@example.invalid",
                "GIT_AUTHOR_DATE": "2026-08-23T15:35:00Z",
                "GIT_COMMITTER_DATE": "2026-08-23T15:35:00Z",
            },
        ).stdout.strip()
        run(["git", "-C", str(repo), "update-ref", "refs/heads/rescue-candidate", candidate])

        proposal = S.create_proposal(
            policy,
            predecessor,
            recovery,
            "refs/heads/rescue-candidate",
            "human:test-proposer",
            "2026-08-23T15:40:00Z",
        )
        assert proposal["candidate_frontier_commit"] == candidate
        assert proposal["candidate_advances_recovered_frontier"] is True
        assert proposal["claims"]["candidate_is_noncanonical"] is True
        assert proposal["claims"]["canonical_successor_established"] is False
        assert proposal["claims"]["human_recognition_required"] is True

        proposal_path = t / "proposal.json"
        write_json(proposal_path, proposal)
        assessed = S.assess_proposal(
            policy, predecessor, recovery, proposal, "2026-08-23T15:45:00Z"
        )
        assert assessed["state"] == "proposal_reviewable"
        assert assessed["decision"] == "human_canonical_recognition_may_be_requested"
        assert all(assessed["checks"].values())
        assert assessed["claims"]["canonical_successor_established"] is False
        assert assessed["claims"]["canonical_origin_mutated"] is False
        assert assessed["claims"]["kontur_activated"] is False

        tampered = copy.deepcopy(proposal)
        tampered["candidate_frontier_tree"] = "0" * 40
        rejected = S.assess_proposal(
            policy, predecessor, recovery, tampered, "2026-08-23T15:46:00Z"
        )
        assert rejected["state"] == "rejected"
        assert rejected["checks"]["proposal_self_digest_match"] is False
        assert rejected["checks"]["candidate_tree_match"] is False

        bad_predecessor = copy.deepcopy(predecessor)
        bad_predecessor["canonical_frontier_commit"] = candidate
        bad_predecessor["binding_sha256"] = S.self_digest(bad_predecessor, "binding_sha256")
        expect_fail(
            lambda: S.create_proposal(
                policy, bad_predecessor, recovery, "refs/heads/rescue-candidate",
                "human:test-proposer", "2026-08-23T15:47:00Z",
            ),
            "does not match canonical predecessor",
        )

        expect_fail(
            lambda: S.create_proposal(
                policy, predecessor, recovery, "refs/tags/synthetic-predecessor",
                "human:test-proposer", "2026-08-23T15:47:00Z",
            ),
            "refs/heads",
        )

        run(["git", "-C", str(repo), "remote", "add", "forbidden-test-remote", "/tmp/nonexistent"])
        expect_fail(
            lambda: S.create_proposal(
                policy, predecessor, recovery, "refs/heads/rescue-candidate",
                "human:test-proposer", "2026-08-23T15:48:00Z",
            ),
            "no Git remotes",
        )
        run(["git", "-C", str(repo), "remote", "remove", "forbidden-test-remote"])

        # Proposal ref-set binding must detect later local ref drift.
        stable_proposal = S.create_proposal(
            policy, predecessor, recovery, "refs/heads/rescue-candidate",
            "human:test-proposer", "2026-08-23T15:49:00Z",
        )
        run(["git", "-C", str(repo), "update-ref", "refs/heads/later-local-ref", candidate])
        drifted = S.assess_proposal(
            policy, predecessor, recovery, stable_proposal, "2026-08-23T15:50:00Z"
        )
        assert drifted["state"] == "rejected"
        assert drifted["checks"]["candidate_ref_set_match"] is False

        # An unrelated commit is present but cannot be proposed as a successor descendant.
        root_commit = run(
            ["git", "-C", str(repo), "commit-tree", tree, "-m", "unrelated root"],
            env={
                "GIT_AUTHOR_NAME": "UU-AAP Test",
                "GIT_AUTHOR_EMAIL": "test@example.invalid",
                "GIT_COMMITTER_NAME": "UU-AAP Test",
                "GIT_COMMITTER_EMAIL": "test@example.invalid",
                "GIT_AUTHOR_DATE": "2026-08-23T15:51:00Z",
                "GIT_COMMITTER_DATE": "2026-08-23T15:51:00Z",
            },
        ).stdout.strip()
        run(["git", "-C", str(repo), "update-ref", "refs/heads/unrelated", root_commit])
        expect_fail(
            lambda: S.create_proposal(
                policy, predecessor, recovery, "refs/heads/unrelated",
                "human:test-proposer", "2026-08-23T15:52:00Z",
            ),
            "does not descend from recovered frontier",
        )

        bad_binding_digest = copy.deepcopy(predecessor)
        bad_binding_digest["canonical_origin_id"] = "tampered-origin"
        expect_fail(lambda: S.validate_predecessor_binding(bad_binding_digest), "self-digest mismatch")

    print("Project Survival Plane v0.5 Canonical Succession Proposal tests: PASS")


if __name__ == "__main__":
    main()
