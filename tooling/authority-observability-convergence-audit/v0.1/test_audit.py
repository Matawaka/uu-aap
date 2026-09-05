#!/usr/bin/env python3
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


validator = load_module("authority_observability_convergence_validator", HERE / "validate_audit.py")


def baseline() -> dict:
    return json.loads((HERE / "audit.json").read_text(encoding="utf-8"))


def domain(data: dict, domain_id: str) -> dict:
    return next(item for item in data["domains"] if item["id"] == domain_id)


def component(data: dict, component_id: str) -> dict:
    return next(item for item in data["components"] if item["id"] == component_id)


def source(data: dict, source_id: str) -> dict:
    return next(item for item in data["source_bindings"] if item["id"] == source_id)


class ConvergenceAuditTests(unittest.TestCase):
    def reject(self, mutate) -> None:
        data = copy.deepcopy(baseline())
        mutate(data)
        with self.assertRaises(validator.AuditError):
            validator.validate(data, verify_repo=False)

    def test_baseline(self):
        result = validator.validate(baseline(), verify_repo=False)
        self.assertEqual(result["overall"], "PROFILE_EXTRACTION_CANDIDATE_NO_CORE_ADMISSION")
        self.assertEqual(result["strong_second_domains"], ["public_review", "kontur"])
        self.assertFalse(result["direct_generic_api_reuse_proven"])

    def test_live_repository_bindings(self):
        result = validator.validate(baseline(), verify_repo=True)
        self.assertEqual(result["next_safe_action"], "PROVE_TWO_DOMAIN_ADAPTERS_TO_CANDIDATE_NEUTRAL_PROFILE")

    def test_origin_drift_rejected(self):
        self.reject(lambda d: d.__setitem__("origin_main", "0" * 40))

    def test_tracking_issue_drift_rejected(self):
        self.reject(lambda d: d.__setitem__("tracking_issue", 999))

    def test_unknown_top_level_rejected(self):
        self.reject(lambda d: d.__setitem__("trust_score", 1))

    def test_admission_predecessor_blob_drift_rejected(self):
        self.reject(lambda d: d["admission_predecessor"].__setitem__("blob_sha1", "0" * 40))

    def test_admission_threshold_weakening_rejected(self):
        self.reject(lambda d: d["admission_predecessor"].__setitem__("rule", "one similar implementation is sufficient"))

    def test_source_removal_rejected(self):
        self.reject(lambda d: d["source_bindings"].pop())

    def test_source_blob_substitution_rejected(self):
        self.reject(lambda d: source(d, "public_review_checkpoint").__setitem__("blob_sha1", "0" * 40))

    def test_source_role_drift_rejected(self):
        self.reject(lambda d: source(d, "current_roadmap").__setitem__("role", "independent_domain"))

    def test_duplicate_source_rejected(self):
        self.reject(lambda d: d["source_bindings"].append(copy.deepcopy(d["source_bindings"][0])))

    def test_public_review_direct_consumer_fabrication_rejected(self):
        self.reject(lambda d: domain(d, "public_review").__setitem__("direct_consumer", True))

    def test_public_review_match_weakening_rejected(self):
        self.reject(lambda d: domain(d, "public_review").__setitem__("strength", "PARTIAL"))

    def test_kontur_direct_consumer_fabrication_rejected(self):
        self.reject(lambda d: domain(d, "kontur").__setitem__("direct_consumer", True))

    def test_kontur_match_reclassification_rejected(self):
        self.reject(lambda d: domain(d, "kontur").__setitem__("match", "DOMAIN_IMPLEMENTED"))

    def test_lsr_branch_demand_overclaim_rejected(self):
        self.reject(lambda d: domain(d, "life_situation_resolver").__setitem__("strength", "STRONG"))

    def test_bounded_action_second_lifecycle_rejected(self):
        self.reject(lambda d: domain(d, "bounded_action").__setitem__("match", "SECOND_DOMAIN_SEMANTIC_MATCH"))

    def test_workbench_reuse_demand_rejected(self):
        self.reject(lambda d: domain(d, "workbench").__setitem__("match", "SECOND_DOMAIN_SEMANTIC_MATCH"))

    def test_workbench_demand_count_inclusion_rejected(self):
        self.reject(lambda d: domain(d, "workbench").__setitem__("excluded_from_demand_count", False))

    def test_authority_admission_new_component_rejected(self):
        self.reject(lambda d: component(d, "authority_admission_consistency").__setitem__("decision", "PROFILE_EXTRACTION_CANDIDATE"))

    def test_observable_consistency_new_component_rejected(self):
        self.reject(lambda d: component(d, "explainability_observable_consistency").__setitem__("decision", "PROFILE_EXTRACTION_CANDIDATE"))

    def test_triangulation_premature_reuse_existing_rejected(self):
        self.reject(lambda d: component(d, "multi_surface_triangulation").__setitem__("decision", "REUSE_EXISTING"))

    def test_observation_set_premature_domain_only_rejected(self):
        self.reject(lambda d: component(d, "observation_set_calculus").__setitem__("decision", "DOMAIN_IMPLEMENTED"))

    def test_c2pa_adapter_genericization_rejected(self):
        self.reject(lambda d: component(d, "c2pa_authority_surface_adapter").__setitem__("decision", "PROFILE_EXTRACTION_CANDIDATE"))

    def test_generic_direct_reuse_fabrication_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("direct_generic_api_reuse_proven", True))

    def test_strong_domain_count_inflation_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("strong_independent_second_domain_match_count", 3))

    def test_strong_domain_list_inflation_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("strong_independent_second_domain_matches", ["public_review", "kontur", "life_situation_resolver"]))

    def test_profile_candidate_erasure_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("profile_extraction_candidate", False))

    def test_generic_runtime_helper_promotion_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("generic_runtime_helper_justified", True))

    def test_new_action_lifecycle_promotion_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("new_action_lifecycle_justified", True))

    def test_workbench_reactivation_finding_rejected(self):
        self.reject(lambda d: d["findings"].__setitem__("workbench_reactivation_justified", True))

    def test_stable_core_admit_rejected(self):
        self.reject(lambda d: d["decision"].__setitem__("stable_core_admission", "ADMIT"))

    def test_interface_registry_admit_rejected(self):
        self.reject(lambda d: d["decision"].__setitem__("interface_registry_admission", "ADMIT"))

    def test_generic_runtime_implementation_rejected(self):
        self.reject(lambda d: d["decision"].__setitem__("generic_runtime_implementation", "IMPLEMENT"))

    def test_direct_core_next_action_rejected(self):
        self.reject(lambda d: d["decision"].__setitem__("next_safe_action", "PROMOTE_TO_STABLE_CORE"))

    def test_workbench_first_adapter_rejected(self):
        self.reject(lambda d: d["decision"].__setitem__("recommended_first_adapter_domain", "workbench"))

    def test_kontur_first_adapter_rejected(self):
        self.reject(lambda d: d["decision"].__setitem__("recommended_first_adapter_domain", "kontur"))

    def test_semantic_match_as_reuse_rejected(self):
        self.reject(lambda d: d["semantic_guards"].__setitem__("semantic_match_implies_direct_reuse", True))

    def test_profile_candidate_as_core_rejected(self):
        self.reject(lambda d: d["semantic_guards"].__setitem__("profile_candidate_implies_core_admission", True))

    def test_observation_authority_escalation_rejected(self):
        self.reject(lambda d: d["semantic_guards"].__setitem__("observation_evidence_mints_action_authority", True))

    def test_public_review_auto_disposition_rejected(self):
        self.reject(lambda d: d["semantic_guards"].__setitem__("public_review_observation_mints_disposition", True))

    def test_kontur_activation_escalation_rejected(self):
        self.reject(lambda d: d["semantic_guards"].__setitem__("kontur_readiness_mints_activation", True))

    def test_lsr_action_escalation_rejected(self):
        self.reject(lambda d: d["semantic_guards"].__setitem__("lsr_attention_mints_required_action", True))

    def test_core_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("stable_core_changed", True))

    def test_interface_registry_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("interface_registry_changed", True))

    def test_c2pa_reclassification_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("c2pa_reclassified", True))

    def test_kontur_activation_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("kontur_activated", True))

    def test_lsr_actuation_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("lsr_actuated", True))

    def test_action_permit_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("action_permit_created", True))

    def test_workbench_reactivation_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("workbench_reactivated", True))

    def test_release_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("release_or_tag_created", True))

    def test_external_effect_rejected(self):
        self.reject(lambda d: d["non_effects"].__setitem__("external_effect_performed", True))


if __name__ == "__main__":
    unittest.main(verbosity=2)
