#!/usr/bin/env python3
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
FORBIDDEN_SCORE_KEYS = {"score","maturity_score","trust_score","confidence","probability","rating","percentage"}


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def fail(msg: str) -> None:
    raise ValueError(msg)


def walk_keys(v: Any):
    if isinstance(v, dict):
        for k, child in v.items():
            yield k
            yield from walk_keys(child)
    elif isinstance(v, list):
        for child in v:
            yield from walk_keys(child)


def git_blob(path: Path) -> str:
    return subprocess.check_output(["git", "hash-object", str(path)], cwd=ROOT, text=True).strip()


def verify_bindings(bindings: dict[str, Any]) -> None:
    if bindings.get("artifact_type") != "RERCMaturityAuditSourceBindings" or bindings.get("version") != "0.1": fail("bindings identity")
    if bindings.get("repository_predecessor_main") != "2d904872b78573f2b106a01ef748ad778a610957": fail("predecessor drift")
    rows = bindings.get("bindings")
    if not isinstance(rows, list) or len(rows) != 7: fail("exact seven bindings required")
    ids = [r.get("id") for r in rows]
    if len(ids) != len(set(ids)): fail("duplicate binding id")
    for r in rows:
        if set(r) != {"id","path","blob","role"}: fail("binding shape")
        p = ROOT / r["path"]
        if not p.is_file(): fail(f"missing source {r['path']}")
        if git_blob(p) != r["blob"]: fail(f"source blob drift {r['id']}")


def validate_assessment(a: dict[str, Any], verify_sources: bool = True) -> None:
    if set(a) != {"artifact_type","version","tracking_issue","repository_predecessor_main","interface","consumer_census","maturity","non_effects","invariants"}: fail("assessment shape")
    if a["artifact_type"] != "RERCMaturityAssessment" or a["version"] != "0.1" or a["tracking_issue"] != 920: fail("assessment identity")
    if a["repository_predecessor_main"] != "2d904872b78573f2b106a01ef748ad778a610957": fail("assessment predecessor")
    if FORBIDDEN_SCORE_KEYS.intersection(walk_keys(a)): fail("score-like field forbidden")

    interface = a["interface"]
    if interface != {"id":"RERC","version":"0.1","registry_status":"experimental","implementation_path":"protocols/integration/rerc/v0.1/rerc.js"}: fail("RERC interface state drift")

    c = a["consumer_census"]
    expected_c_keys = {"method","independent_direct_consumer_count","independent_direct_consumers","excluded_consumers","second_independent_direct_reuse_proven","bounded_exact_materialization_of_second_consumer_found"}
    if set(c) != expected_c_keys: fail("consumer census shape")
    if c["method"] != "BOUNDED_CURRENT_REPOSITORY_AND_PR_AUDIT": fail("consumer census method")
    if c["independent_direct_consumer_count"] != 1: fail("independent consumer count inflation")
    if c["second_independent_direct_reuse_proven"] is not False or c["bounded_exact_materialization_of_second_consumer_found"] is not False: fail("second consumer overclaim")
    direct = c["independent_direct_consumers"]
    if not isinstance(direct, list) or len(direct) != 1: fail("exact one independent consumer required")
    d = direct[0]
    if d != {"domain":"CIRCUMSTANTIAL_PROVENANCE_EVIDENCE_INDEPENDENCE","pr":919,"adapter_path":"protocols/integration/circumstantial-provenance-rerc-adapter/v0.1/adapter.js","classification":"DIRECT_INDEPENDENT_DOMAIN_REUSE","accepted_rerc_module_reused":True,"compress_restore_semantics_reimplemented":False}: fail("independent consumer binding")
    excluded = {x.get("id"): x for x in c["excluded_consumers"]}
    if set(excluded) != {"RERC_SELF_VALIDATION","INTERFACE_REGISTRY_METADATA","RSIC"}: fail("excluded consumer set")
    if excluded["RERC_SELF_VALIDATION"].get("classification") != "SELF_VALIDATION_NOT_CONSUMER": fail("self validation classification")
    if excluded["INTERFACE_REGISTRY_METADATA"].get("classification") != "DISCOVERY_METADATA_NOT_CONSUMER": fail("registry metadata classification")
    if excluded["RSIC"] != {"id":"RSIC","classification":"COMPOSITION_NOT_INDEPENDENT_DOMAIN_DEMAND","path":"protocols/reusable-infrastructure/recoverable-state/v0.1/compose.js"}: fail("RSIC classification")

    m = a["maturity"]
    if m.get("verdict") != "REMAIN_EXPERIMENTAL" or m.get("promotion_threshold_satisfied") is not False: fail("premature maturity promotion")
    if m.get("next_gate") != "SEEK_SECOND_INDEPENDENT_DOMAIN_REUSE_OR_MATERIAL_API_EVOLUTION": fail("next gate")
    if not isinstance(m.get("reason"), str) or not m["reason"]: fail("maturity reason")

    ne = a["non_effects"]
    expected_ne = {"registry_status_promotion_performed","stable_core_promotion_performed","rerc_semantics_mutated","rsic_admission_triggered","erd_dependency_triggered","action_permit_created","runtime_activated","external_effect_performed","truth_certified","authority_created","scalar_maturity_score_created"}
    if set(ne) != expected_ne or any(v is not False for v in ne.values()): fail("non-effects escalation")
    required_invariants = {"Direct Reuse != Stable Core","Experimental Registration != Promotion","Synthetic Composition != Independent Domain Demand","Operational Suppression != Provenance Deletion","Redundancy Group != Semantic Equivalence Proof"}
    if set(a["invariants"]) != required_invariants: fail("invariant set drift")

    if verify_sources:
        bindings = load(HERE / "source-bindings.json")
        verify_bindings(bindings)
        reg2 = load(ROOT / "protocols/interface-registry/v0.2/interface-registry-delta.json")
        rerc_entries = [x for x in reg2["additions"] if x.get("id") == "RERC"]
        if len(rerc_entries) != 1 or rerc_entries[0].get("status") != "experimental": fail("registry v0.2 RERC state")
        reg3 = load(ROOT / "protocols/interface-registry/v0.3/interface-registry-delta.json")
        if reg3["base_registry"].get("blob") != "ad705523bada7f64a04e09e34974407725942976": fail("registry successor binding")
        if any(x.get("id") == "RERC" for x in reg3.get("additions", [])): fail("v0.3 must not rewrite RERC")
        adapter_receipt = load(ROOT / "protocols/integration/circumstantial-provenance-rerc-adapter/v0.1/implementation-receipt.json")
        if adapter_receipt["proof"].get("rerc_direct_module_reuse") is not True: fail("#919 direct RERC reuse missing")
        if adapter_receipt["non_effects"].get("rsic_composition_demand") is not False: fail("#919 cannot trigger RSIC demand")
        rsic = (ROOT / "protocols/reusable-infrastructure/recoverable-state/v0.1/compose.js").read_text(encoding="utf-8")
        if "integration/rerc/v0.1/rerc.js" not in rsic or "RERC.compressGraph" not in rsic: fail("RSIC composition binding missing")


def main() -> int:
    a = load(HERE / "assessment.json")
    validate_assessment(a, True)
    print(json.dumps({"validation":"PASS","maturity_verdict":a["maturity"]["verdict"],"independent_direct_consumer_count":a["consumer_census"]["independent_direct_consumer_count"],"registry_promotion_performed":False,"stable_core_promotion_performed":False}, indent=2, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
