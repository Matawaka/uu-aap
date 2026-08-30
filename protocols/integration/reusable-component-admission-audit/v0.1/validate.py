#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve()
ROOT = HERE.parents[4]
ASSESSMENT = HERE.with_name("assessment.json")

EXPECTED_ORIGIN = "2cf333d309dee79591cf559bf1b494e2bc828be3"
EXPECTED_DECISIONS = {
    "observation_provenance_profile": "REUSE_EXISTING",
    "bounded_interaction_lifecycle": "DEFER",
    "generic_provenance_store": "DEFER",
    "generic_receipt_runtime_helper": "DEFER",
}
ALLOWED = {"ADMIT", "REUSE_EXISTING", "DEFER", "REJECT"}


def fail(message: str) -> None:
    raise AssertionError(message)


def git_blob_sha1(path: Path) -> str:
    data = path.read_bytes()
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def evidence_refs(node):
    if isinstance(node, dict):
        if set(("path", "git_blob_sha1")).issubset(node):
            yield node
        for value in node.values():
            yield from evidence_refs(value)
    elif isinstance(node, list):
        for value in node:
            yield from evidence_refs(value)


def candidate_map(doc):
    result = {}
    for candidate in doc.get("candidates", []):
        cid = candidate.get("id")
        if not cid or cid in result:
            fail("candidate ids must be present and unique")
        result[cid] = candidate
    return result


def validate(doc: dict) -> None:
    if doc.get("profile") != "uu-aap.reusable-component-admission-audit.v0.1":
        fail("wrong profile")
    if doc.get("issue") != 763:
        fail("wrong issue binding")
    if doc.get("origin_frontier") != EXPECTED_ORIGIN:
        fail("origin frontier drift")
    if set(doc.get("decision_vocabulary", [])) != ALLOWED:
        fail("decision vocabulary drift")

    threshold = doc.get("admission_threshold", {})
    if threshold.get("minimum_independent_consumer_families") != 2:
        fail("admission threshold weakened")
    if threshold.get("requires_no_adequate_existing_reusable_interface") is not True:
        fail("existing-interface gate weakened")
    if threshold.get("stable_core_promotion_implied") is not False:
        fail("admission must not imply Stable Core promotion")
    if threshold.get("interface_registry_promotion_implied") is not False:
        fail("admission must not imply registry promotion")

    candidates = candidate_map(doc)
    if set(candidates) != set(EXPECTED_DECISIONS):
        fail("candidate set drift")

    for cid, expected in EXPECTED_DECISIONS.items():
        candidate = candidates[cid]
        decision = candidate.get("decision")
        if decision not in ALLOWED:
            fail(f"invalid decision for {cid}")
        if decision != expected:
            fail(f"canonical decision drift for {cid}")
        count = candidate.get("independent_consumer_families_proven")
        if not isinstance(count, int) or count < 0:
            fail(f"invalid consumer-family count for {cid}")
        if decision == "ADMIT" and count < 2:
            fail(f"ADMIT without independent demand for {cid}")
        if decision == "REUSE_EXISTING" and not candidate.get("reuse_evidence"):
            fail(f"REUSE_EXISTING without exact reuse evidence for {cid}")
        if decision == "DEFER" and not candidate.get("missing_evidence"):
            fail(f"DEFER without reconsideration evidence for {cid}")

    observation = candidates["observation_provenance_profile"]
    expected_reuse_paths = {
        "protocols/integration/ambient-observability-non-identification/v0.1/README.md",
        "protocols/integration/circumstantial-provenance/v0.1/README.md",
        "protocols/integration/event-hash-minimalism/v0.1/README.md",
    }
    if {item.get("path") for item in observation.get("reuse_evidence", [])} != expected_reuse_paths:
        fail("observation/provenance reuse decomposition drift")

    lifecycle = candidates["bounded_interaction_lifecycle"]
    if lifecycle.get("independent_consumer_families_proven") != 1:
        fail("bounded interaction lifecycle must not fabricate a second family")
    families = lifecycle.get("consumer_family_evidence", [])
    if len(families) != 1 or families[0].get("family") != "KONTUR game companion":
        fail("bounded interaction consumer evidence drift")
    nearby = lifecycle.get("nearby_but_not_equivalent", {})
    if nearby.get("path") != "protocols/integration/execution-lifecycle/v0.1/README.md":
        fail("nearby lifecycle evidence drift")
    nearby_reason = nearby.get("reason", "")
    if "ActionPermit" not in nearby_reason or "Interaction into Action" not in nearby_reason:
        fail("interaction/action semantic boundary missing")

    store = candidates["generic_provenance_store"]
    if store.get("independent_consumer_families_proven") != 0:
        fail("generic store demand is not proven")
    if "persistence" not in store.get("reason", ""):
        fail("generic store must distinguish persistence from evidence semantics")

    helper = candidates["generic_receipt_runtime_helper"]
    if helper.get("independent_consumer_families_proven") != 0:
        fail("generic runtime-helper demand is not proven")
    impl_paths = {item.get("path") for item in helper.get("implementation_evidence", [])}
    if not any(path and path.endswith(".py") for path in impl_paths):
        fail("runtime audit must retain cross-runtime evidence")
    if not any(path and path.endswith(".js") for path in impl_paths):
        fail("runtime audit must retain cross-runtime evidence")

    refs = list(evidence_refs(doc))
    if len(refs) < 10:
        fail("insufficient byte-bound evidence")
    for ref in refs:
        path = ROOT / ref["path"]
        if not path.is_file():
            fail(f"missing evidence path: {ref['path']}")
        actual = git_blob_sha1(path)
        if actual != ref["git_blob_sha1"]:
            fail(f"blob substitution: {ref['path']} expected {ref['git_blob_sha1']} got {actual}")

    overall = doc.get("overall", {})
    if any(c.get("decision") == "ADMIT" for c in candidates.values()):
        if overall.get("result") == "NO_ADMISSION":
            fail("NO_ADMISSION contradicts an admitted candidate")
    else:
        if overall.get("result") != "NO_ADMISSION":
            fail("no candidate admitted but overall result widened")
    required_false = (
        "new_reusable_component_admitted",
        "stable_core_promotion_authorized",
        "interface_registry_entry_authorized",
        "external_effect_authority_created",
    )
    for field in required_false:
        if overall.get(field) is not False:
            fail(f"forbidden overall widening: {field}")
    if overall.get("next_step") != "REUSE_EXISTING_AND_WAIT_FOR_INDEPENDENT_DEMAND":
        fail("next step must remain demand-driven")

    non_effects = doc.get("non_effects", {})
    if not non_effects or any(value is not False for value in non_effects.values()):
        fail("audit must remain no-effect")


def expect_rejected(base: dict, name: str, mutate) -> None:
    changed = copy.deepcopy(base)
    mutate(changed)
    try:
        validate(changed)
    except AssertionError:
        return
    fail(f"mutation unexpectedly accepted: {name}")


def main() -> None:
    doc = json.loads(ASSESSMENT.read_text(encoding="utf-8"))
    validate(doc)

    mutations = [
        ("frontier drift", lambda d: d.__setitem__("origin_frontier", "0" * 40)),
        ("threshold weakening", lambda d: d["admission_threshold"].__setitem__("minimum_independent_consumer_families", 1)),
        ("speculative observation admission", lambda d: candidate_map(d)["observation_provenance_profile"].__setitem__("decision", "ADMIT")),
        ("reuse evidence deletion", lambda d: candidate_map(d)["observation_provenance_profile"].__setitem__("reuse_evidence", [])),
        ("fabricated second interaction family", lambda d: candidate_map(d)["bounded_interaction_lifecycle"].__setitem__("independent_consumer_families_proven", 2)),
        ("interaction/action collapse", lambda d: candidate_map(d)["bounded_interaction_lifecycle"].__setitem__("decision", "REUSE_EXISTING")),
        ("defer without evidence", lambda d: candidate_map(d)["generic_provenance_store"].__setitem__("missing_evidence", [])),
        ("runtime helper admission", lambda d: candidate_map(d)["generic_receipt_runtime_helper"].__setitem__("decision", "ADMIT")),
        ("blob substitution", lambda d: d["predecessor_evidence"].__setitem__("git_blob_sha1", "0" * 40)),
        ("Stable Core promotion", lambda d: d["overall"].__setitem__("stable_core_promotion_authorized", True)),
        ("registry promotion", lambda d: d["overall"].__setitem__("interface_registry_entry_authorized", True)),
        ("effect authority", lambda d: d["overall"].__setitem__("external_effect_authority_created", True)),
        ("field evidence fabrication", lambda d: d["non_effects"].__setitem__("field_evidence_fabrication", True)),
    ]
    for name, mutate in mutations:
        expect_rejected(doc, name, mutate)

    print("Reusable Component Admission Audit v0.1: PASS")
    print("Result: NO_ADMISSION")
    print("Observation/Provenance Profile: REUSE_EXISTING")
    print("Bounded Interaction Lifecycle: DEFER")
    print("Generic Provenance Store: DEFER")
    print("Generic Receipt Runtime Helper: DEFER")


if __name__ == "__main__":
    main()
