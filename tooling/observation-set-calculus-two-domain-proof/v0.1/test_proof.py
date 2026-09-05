#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import shutil
import tempfile
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


prove = load_module("two_domain_observation_set_reuse_proof_tests", HERE / "prove.py")


class TwoDomainReuseProofTests(unittest.TestCase):
    def test_direct_shared_implementation_reuse_is_proven_for_two_adapters(self):
        receipt = prove.build_proof()
        direct = receipt["direct_reuse"]
        self.assertEqual(direct["independent_adapter_count"], 2)
        self.assertTrue(direct["same_resolved_profile_path"])
        self.assertTrue(direct["same_profile_bytes"])
        self.assertTrue(direct["same_set_receipt_schema"])
        self.assertTrue(direct["both_invoked_candidate_set_evaluator"])
        self.assertTrue(direct["direct_shared_implementation_reuse_proven"])

    def test_adapters_resolve_the_exact_same_candidate_path(self):
        expected = prove.PROFILE_PATH.resolve()
        self.assertEqual(prove.c2pa_adapter.PROFILE_PATH.resolve(), expected)
        self.assertEqual(prove.public_review_adapter.PROFILE_PATH.resolve(), expected)
        receipt = prove.build_proof()
        self.assertEqual(
            receipt["adapters"]["c2pa"]["candidate_profile_sha256"],
            receipt["candidate"]["profile_sha256"],
        )
        self.assertEqual(
            receipt["adapters"]["public_review"]["candidate_profile_sha256"],
            receipt["candidate"]["profile_sha256"],
        )

    def test_both_domains_emit_same_candidate_set_receipt_schema(self):
        receipt = prove.build_proof()
        self.assertEqual(
            receipt["candidate"]["shared_set_receipt_schema"],
            prove.profile.SET_RECEIPT_SCHEMA,
        )
        c2pa_set, _, _ = prove._c2pa_vectors()
        c2pa_receipt = prove.c2pa_adapter.project_set(c2pa_set)
        public_receipt = prove.public_review_adapter.project_checkpoint()
        self.assertEqual(
            c2pa_receipt["candidate_receipt"]["schema"],
            public_receipt["candidate_receipt"]["schema"],
        )

    def test_public_review_positive_proof_uses_actual_accepted_external_source(self):
        receipt = prove.build_proof()
        public = receipt["adapters"]["public_review"]
        self.assertEqual(public["actual_projected_external_source_count"], 1)
        self.assertTrue(public["accepted_checkpoint_validated"])
        self.assertTrue(public["set_reuse"])
        self.assertFalse(public["transition_reuse"])
        self.assertFalse(public["chain_reuse"])

    def test_c2pa_proves_set_transition_and_chain_reuse_with_source_parity(self):
        c2pa = prove.build_proof()["adapters"]["c2pa"]
        self.assertTrue(c2pa["set_reuse"])
        self.assertTrue(c2pa["transition_reuse"])
        self.assertTrue(c2pa["chain_reuse"])
        self.assertTrue(all(c2pa["source_parity"].values()))

    def test_direct_reuse_does_not_claim_cross_domain_semantic_equivalence(self):
        limits = prove.build_proof()["scope_limits"]
        self.assertTrue(all(value is False for value in limits.values()))
        self.assertFalse(limits["cross_domain_semantic_equivalence_proven"])
        self.assertFalse(limits["universal_applicability_proven"])
        self.assertFalse(limits["global_equivocation_proven"])
        self.assertFalse(limits["truth_proven"])
        self.assertFalse(limits["authority_created"])

    def test_direct_reuse_does_not_perform_admission(self):
        receipt = prove.build_proof()
        admission = receipt["admission"]
        self.assertFalse(admission["stable_core_admission_performed"])
        self.assertFalse(admission["interface_registry_admission_performed"])
        self.assertFalse(admission["candidate_profile_registered"])
        self.assertEqual(
            admission["next_safe_action"],
            "RE_RUN_REUSABLE_COMPONENT_ADMISSION_AUDIT_AFTER_DIRECT_REUSE_PROOF",
        )
        self.assertTrue(all(value is False for value in receipt["non_effects"].values()))

    def test_same_bytes_at_different_profile_path_do_not_count_as_same_runtime_seam(self):
        original = prove.public_review_adapter.PROFILE_PATH
        with tempfile.TemporaryDirectory() as tmp:
            copied = Path(tmp) / "profile.py"
            shutil.copyfile(prove.PROFILE_PATH, copied)
            prove.public_review_adapter.PROFILE_PATH = copied
            try:
                with self.assertRaises(prove.TwoDomainReuseProofError):
                    prove.build_proof()
            finally:
                prove.public_review_adapter.PROFILE_PATH = original

    def test_profile_digest_substitution_fails_closed(self):
        original = prove.c2pa_adapter.candidate_profile_sha256
        prove.c2pa_adapter.candidate_profile_sha256 = lambda: "0" * 64
        try:
            with self.assertRaises(prove.TwoDomainReuseProofError):
                prove.build_proof()
        finally:
            prove.c2pa_adapter.candidate_profile_sha256 = original

    def test_shared_schema_substitution_fails_closed(self):
        original = prove.profile.SET_RECEIPT_SCHEMA
        prove.profile.SET_RECEIPT_SCHEMA = "urn:substituted"
        try:
            with self.assertRaises(prove.TwoDomainReuseProofError):
                prove.build_proof()
        finally:
            prove.profile.SET_RECEIPT_SCHEMA = original

    def test_proof_is_deterministic(self):
        first = prove.build_proof()
        second = prove.build_proof()
        self.assertEqual(first, second)
        self.assertEqual(first["schema"], prove.RECEIPT_SCHEMA)
        self.assertEqual(first["origin_main"], prove.ORIGIN_MAIN)
        self.assertEqual(first["tracking_issue"], 909)

    def test_proof_contains_no_score_or_automatic_authority_surface(self):
        receipt = prove.build_proof()
        forbidden = {
            "trust_score",
            "truth_score",
            "severity_score",
            "rank",
            "automatic_admission",
            "action_permit",
            "canonical_branch",
        }
        for key in forbidden:
            self.assertNotIn(key, receipt)


if __name__ == "__main__":
    unittest.main(verbosity=2)
