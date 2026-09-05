#!/usr/bin/env python3
"""Regression coverage for #896-aligned same-digest branch-set semantics."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


branch_set = load_module("observed_authority_branch_set_alias_test", HERE / "receipt.py")


def fixture() -> dict:
    return json.loads((HERE / "fixtures" / "three-branches.json").read_text(encoding="utf-8"))


class AliasSemanticTests(unittest.TestCase):
    def test_same_digest_same_membership_allows_runtime_and_export_alias_ids(self):
        data = fixture()
        data["branches"] = data["branches"][:2]
        second = data["branches"][1]["snapshots"][1]
        second["runtime_surface"]["id"] = "fixture-runtime-alias"
        second["export_surface"]["id"] = "fixture-export-alias"
        second["runtime_surface"]["configured_signers"] = list(
            reversed(second["runtime_surface"]["configured_signers"])
        )
        second["export_surface"]["signers"] = list(
            reversed(second["export_surface"]["signers"])
        )

        receipt = branch_set.evaluate(data)
        self.assertEqual(receipt["observation_count"], 2)
        self.assertEqual(receipt["distinct_branch_count"], 2)
        self.assertEqual(receipt["pairwise_entry_count"], 1)

    def test_same_root_digest_same_admitted_set_allows_different_input_order(self):
        data = fixture()
        left = copy.deepcopy(data["branches"][0])
        right = copy.deepcopy(data["branches"][0])
        right["snapshots"][1]["signed_root"]["admitted_signers"] = list(
            reversed(right["snapshots"][1]["signed_root"]["admitted_signers"])
        )
        data["branches"] = [left, right]

        receipt = branch_set.evaluate(data)
        self.assertEqual(receipt["distinct_branch_count"], 2)
        self.assertEqual(receipt["pairwise_entry_count"], 1)
        self.assertFalse(
            receipt["pairwise_matrix"][0]["parallel_same_version_root_variants_observed"]
        )
        self.assertFalse(receipt["semantic_guards"]["global_equivocation_proven"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
