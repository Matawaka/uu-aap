"""Read-only local verifier for the parallel-work isolation manifest.

The verifier inspects the local Git diff only. It does not fetch, push, merge,
create pull requests, modify refs, activate workflows, or mutate files.
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[4]
MANIFEST = ROOT / "examples/parallel-work-isolation.example.json"


def load_manifest():
    with MANIFEST.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def git(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


class ParallelWorkIsolationTests(unittest.TestCase):
    def test_manifest_is_fail_closed(self):
        manifest = load_manifest()
        self.assertEqual(["add"], manifest["allowed_change_types"])
        self.assertIs(manifest["main_ref_update_allowed"], False)
        self.assertIs(manifest["pull_request_creation_allowed"], False)
        self.assertIs(manifest["workflow_activation_allowed"], False)
        self.assertIs(manifest["tag_or_release_mutation_allowed"], False)
        self.assertEqual("none", manifest["authority_effect"])

    def test_branch_diff_is_additive_and_path_isolated(self):
        manifest = load_manifest()
        base = manifest["base_sha"]
        allowed_prefixes = tuple(manifest["allowed_path_prefixes"])
        forbidden_prefixes = tuple(manifest["forbidden_path_prefixes"])

        # Ensure the declared base is an ancestor of the checked-out side-track.
        subprocess.run(
            ["git", "merge-base", "--is-ancestor", base, "HEAD"],
            cwd=REPO,
            check=True,
            capture_output=True,
            text=True,
        )

        diff = git("diff", "--name-status", f"{base}..HEAD")
        self.assertTrue(diff, "Expected isolated side-track additions after the declared base")

        for line in diff.splitlines():
            status, path = line.split("\t", 1)
            with self.subTest(path=path, status=status):
                self.assertEqual("A", status, f"Non-additive change detected: {line}")
                self.assertTrue(
                    path.startswith(allowed_prefixes),
                    f"Path outside allowed side-track prefixes: {path}",
                )
                self.assertFalse(
                    path.startswith(forbidden_prefixes),
                    f"Forbidden main-line path touched: {path}",
                )

    def test_no_workflow_file_added_by_side_track(self):
        manifest = load_manifest()
        diff = git("diff", "--name-only", f"{manifest['base_sha']}..HEAD")
        changed = [line for line in diff.splitlines() if line]
        self.assertFalse(any(path.startswith(".github/") for path in changed))


if __name__ == "__main__":
    unittest.main()
