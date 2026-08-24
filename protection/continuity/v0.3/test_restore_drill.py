#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from jsonschema import Draft202012Validator, FormatChecker

HERE = Path(__file__).resolve().parent
MODULE_PATH = HERE / "restore_drill.py"
SCHEMA_PATH = HERE / "restore-drill-receipt.schema.json"

spec = importlib.util.spec_from_file_location("continuity_restore_drill_v03", MODULE_PATH)
assert spec and spec.loader
DRILL = importlib.util.module_from_spec(spec)
spec.loader.exec_module(DRILL)
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())


def git(args: list[str], cwd: Path | None = None) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=str(cwd) if cwd else None, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed:\n{proc.stdout}")
    return proc.stdout.strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ref_map(repo: Path) -> list[dict[str, str]]:
    output = git(["for-each-ref", "--format=%(refname)%00%(objectname)"], cwd=repo)
    items = []
    for line in output.splitlines():
        if line:
            ref, object_sha = line.split("\x00", 1)
            items.append({"ref": ref, "object_sha": object_sha})
    return sorted(items, key=lambda item: item["ref"])


class RestoreDrillTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="continuity-v03-test-"))
        self.source = self.tmp / "source"
        self.capture = self.tmp / "capture"
        self.capture.mkdir()
        git(["init", "-b", "main", str(self.source)])
        git(["config", "user.name", "Continuity Fixture"], cwd=self.source)
        git(["config", "user.email", "continuity@example.invalid"], cwd=self.source)
        (self.source / "alpha.txt").write_text("alpha\n", encoding="utf-8")
        git(["add", "alpha.txt"], cwd=self.source)
        git(["commit", "-m", "fixture root"], cwd=self.source)
        git(["tag", "fixture-v0.1"], cwd=self.source)
        git(["checkout", "-b", "fixture-side"], cwd=self.source)
        (self.source / "side.txt").write_text("side\n", encoding="utf-8")
        git(["add", "side.txt"], cwd=self.source)
        git(["commit", "-m", "fixture side"], cwd=self.source)
        git(["checkout", "main"], cwd=self.source)

        mirror = self.tmp / "mirror.git"
        git(["clone", "--mirror", str(self.source), str(mirror)])
        self.bundle = self.capture / "fixture.bundle"
        git(["bundle", "create", str(self.bundle), "--all"], cwd=mirror)
        git(["bundle", "verify", str(self.bundle)])
        main_sha = git(["rev-parse", "refs/heads/main"], cwd=mirror)
        tree_sha = git(["rev-parse", "refs/heads/main^{tree}"], cwd=mirror)
        self.manifest = {
            "$schema": "./continuity-manifest.schema.json",
            "schema_id": "urn:uu-aap:continuity:manifest:v0.1",
            "tool_version": "0.1",
            "captured_at_utc": "2026-08-24T00:00:00Z",
            "source": {
                "repository": str(self.source),
                "main_branch": "main",
                "main_commit_sha": main_sha,
                "main_tree_sha": tree_sha,
            },
            "integrity": {
                "git_fsck": "pass",
                "git_fsck_output": "",
                "bundle_verify": "pass",
                "bundle_verify_output": "fixture",
                "bundle_file": self.bundle.name,
                "bundle_sha256": sha256(self.bundle),
            },
            "refs": ref_map(mirror),
            "tags": [],
            "lineage": {"previous_manifest": None},
            "boundary": {
                "remote_mutation_performed": False,
                "canonical_successor_claimed": False,
                "authority_transferred": False,
                "kontur_activated_or_modified": False,
                "distributed_consensus_claimed": False,
            },
        }
        self.manifest_path = self.capture / "continuity-manifest.json"
        self.write_manifest(self.manifest)
        self.receipt_path = self.tmp / "receipt.json"

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write_manifest(self, value: dict) -> None:
        self.manifest_path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    def positive_receipt(self) -> dict:
        return DRILL.drill(
            self.manifest_path,
            self.receipt_path,
            "2026-08-24T00:01:00Z",
        )

    def test_positive_disposable_restore(self) -> None:
        created = self.tmp / "known-drill-temp"
        with mock.patch.object(DRILL.tempfile, "mkdtemp", return_value=str(created)):
            receipt = self.positive_receipt()
        self.assertFalse(created.exists())
        VALIDATOR.validate(receipt)
        DRILL.validate_receipt(receipt)
        self.assertTrue(receipt["drill"]["restore_drill_verified"])
        self.assertTrue(receipt["drill"]["temporary_restore_removed"])
        self.assertFalse(any(receipt["claims"].values()))
        self.assertEqual(
            receipt["ref_integrity"]["captured_ref_set_sha256"],
            receipt["ref_integrity"]["restored_ref_set_sha256"],
        )

    def test_bundle_digest_tamper_fails_before_restore(self) -> None:
        self.bundle.write_bytes(self.bundle.read_bytes() + b"tamper")
        with self.assertRaisesRegex(DRILL.DrillError, "SHA-256 mismatch"):
            self.positive_receipt()

    def test_manifest_main_substitution_fails(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["source"]["main_commit_sha"] = "0" * 40
        self.write_manifest(changed)
        with self.assertRaisesRegex(DRILL.DrillError, "restored main SHA"):
            self.positive_receipt()

    def test_manifest_tree_substitution_fails(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["source"]["main_tree_sha"] = "0" * 40
        self.write_manifest(changed)
        with self.assertRaisesRegex(DRILL.DrillError, "restored main tree"):
            self.positive_receipt()

    def test_manifest_ref_substitution_fails_before_restore(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["refs"][0]["object_sha"] = "0" * 40
        self.write_manifest(changed)
        with self.assertRaisesRegex(DRILL.DrillError, "captured ref set"):
            self.positive_receipt()

    def test_manifest_missing_ref_fails(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["refs"] = changed["refs"][:-1]
        self.write_manifest(changed)
        with self.assertRaisesRegex(DRILL.DrillError, "captured ref set"):
            self.positive_receipt()

    def test_bundle_path_traversal_rejected(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["integrity"]["bundle_file"] = "../fixture.bundle"
        self.write_manifest(changed)
        with self.assertRaisesRegex(DRILL.DrillError, "adjacent"):
            self.positive_receipt()

    def test_source_manifest_must_be_v01(self) -> None:
        changed = copy.deepcopy(self.manifest)
        changed["schema_id"] = "urn:uu-aap:continuity:manifest:v9"
        self.write_manifest(changed)
        with self.assertRaisesRegex(DRILL.DrillError, "v0.1 manifest"):
            self.positive_receipt()

    def test_receipt_authority_overclaim_rejected(self) -> None:
        receipt = self.positive_receipt()
        receipt["claims"]["authority_transferred"] = True
        with self.assertRaisesRegex(DRILL.DrillError, "authority_transferred"):
            DRILL.validate_receipt(receipt)

    def test_receipt_kontur_overclaim_rejected(self) -> None:
        receipt = self.positive_receipt()
        receipt["claims"]["kontur_activated"] = True
        with self.assertRaisesRegex(DRILL.DrillError, "kontur_activated"):
            DRILL.validate_receipt(receipt)

    def test_receipt_ref_digest_divergence_rejected(self) -> None:
        receipt = self.positive_receipt()
        receipt["ref_integrity"]["restored_ref_set_sha256"] = "0" * 64
        with self.assertRaisesRegex(DRILL.DrillError, "ref-set digests"):
            DRILL.validate_receipt(receipt)

    def test_tool_has_no_network_client_surface(self) -> None:
        source = MODULE_PATH.read_text(encoding="utf-8")
        for forbidden in ("urllib", "requests", "socket", "http.client", "urlopen", "git push", "git fetch"):
            self.assertNotIn(forbidden, source)
        self.assertNotIn("RECOVERED_NONCANONICAL", source)

    def test_source_repository_remains_unchanged(self) -> None:
        before = git(["status", "--porcelain=v1"], cwd=self.source)
        self.positive_receipt()
        after = git(["status", "--porcelain=v1"], cwd=self.source)
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main(verbosity=2)
