#!/usr/bin/env python3
import copy
import hashlib
import json
import pathlib
import sys

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
ASSESSMENT = ROOT / "assessment.json"
ORIGIN = "db9633583c937fd2cecdde4ea5b2b5a5b68d381a"
EXPECTED_PRIMITIVES = {
    "DLC-SI-v0.1": ("protocols/dlc-si/v0.1/dlc-si.js", "cb2ac2c8dac0b012e2bf01aeced21b78a6cc77db"),
    "EVENT-HASH-MINIMALISM-v0.1": ("protocols/integration/event-hash-minimalism/v0.1/fixture.json", "8877a9c722db413f53c5b88fe9e557e5dcfa3eb5"),
}
EXPECTED_CANDIDATES = {
    "KONTUR_NON_BINDING_ATTENTION_v0.1": ("pilots/kontur-game-companion/non-binding-attention-v0.1/attention.js", "7c512209065c37042db21033492cfae5ac7c558e", "PILOT_POLICY_ONLY_REUSE_DLC_SI", ["DLC-SI-v0.1"]),
    "KONTUR_USEFUL_INTERACTION_EVIDENCE_ADMISSION_v0.1": ("pilots/kontur-game-companion/useful-interaction-evidence-admission-v0.1/admission.json", "bb8576453c1695c9b703aa61e5d56c61e9f68e1e", "PILOT_EVIDENCE_GATE", []),
    "KONTUR_BOUNDED_INTERACTION_EVIDENCE_ENVELOPE_v0.1": ("pilots/kontur-game-companion/bounded-interaction-evidence-envelope-v0.1/fixture.json", "696f41d821d23e021397a61b163ab695bdead6b4", "PILOT_EVIDENCE_PROFILE_REUSE_EVENT_HASH_MINIMALISM", ["EVENT-HASH-MINIMALISM-v0.1"]),
}


def fail(message):
    raise AssertionError(message)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob_sha1(path):
    raw = path.read_bytes()
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def validate_bound_file(path, expected_sha, label):
    full = REPO / path
    if not full.is_file():
        fail(f"missing {label}")
    if git_blob_sha1(full) != expected_sha:
        fail(f"byte drift {label}")


def validate(data):
    if data.get("schema_version") != "kontur-core-admission-assessment-v0.1" or data.get("issue") != 761 or data.get("origin_main") != ORIGIN:
        fail("identity/origin")

    policy = data.get("policy", {})
    expected_policy = {
        "pilot_success_creates_core_requirement": False,
        "green_ci_creates_core_requirement": False,
        "merged_status_creates_core_requirement": False,
        "minimum_independent_non_kontur_consumer_evidence": 2,
        "cross_domain_interface_evidence_required": True,
        "no_authority_widening_required": True,
        "external_conformance_required": True,
        "reversible_migration_path_required": True,
    }
    if policy != expected_policy:
        fail("admission policy")

    primitives = data.get("reused_primitives")
    if not isinstance(primitives, list) or len(primitives) != len(EXPECTED_PRIMITIVES):
        fail("reused primitive set")
    seen = set()
    for item in primitives:
        pid = item.get("primitive_id")
        if pid not in EXPECTED_PRIMITIVES or pid in seen:
            fail("primitive identity")
        seen.add(pid)
        path, sha = EXPECTED_PRIMITIVES[pid]
        if item.get("path") != path or item.get("git_blob_sha1") != sha:
            fail("primitive binding")
        validate_bound_file(path, sha, pid)

    candidates = data.get("candidates")
    if not isinstance(candidates, list) or len(candidates) != len(EXPECTED_CANDIDATES):
        fail("candidate set")
    seen = set()
    for candidate in candidates:
        cid = candidate.get("candidate_id")
        if cid not in EXPECTED_CANDIDATES or cid in seen:
            fail("candidate identity")
        seen.add(cid)
        path, sha, classification, reuse = EXPECTED_CANDIDATES[cid]
        if candidate.get("path") != path or candidate.get("git_blob_sha1") != sha:
            fail(f"candidate binding {cid}")
        validate_bound_file(path, sha, cid)
        if candidate.get("classification") != classification:
            fail(f"classification {cid}")
        if candidate.get("existing_reusable_primitive_refs") != reuse:
            fail(f"reuse refs {cid}")
        refs = candidate.get("independent_non_kontur_consumer_evidence_refs")
        if not isinstance(refs, list):
            fail("independent consumer evidence type")
        if len(refs) >= policy["minimum_independent_non_kontur_consumer_evidence"]:
            fail("fixture unexpectedly contains admission-level independent demand")
        if candidate.get("stable_cross_domain_interface_evidence") is not False:
            fail("cross-domain interface overclaim")
        if candidate.get("external_conformance_evidence") is not False:
            fail("external conformance overclaim")
        if candidate.get("authority_widening_required") is not False:
            fail("authority widening")
        if candidate.get("reversible_pilot_retention") is not True:
            fail("reversibility")
        if candidate.get("core_admission") != "NO_CORE_ADMISSION":
            fail("core admission overclaim")

    decision = data.get("decision", {})
    if decision.get("state") != "DEFER_UNTIL_INDEPENDENT_REUSABLE_DEMAND":
        fail("decision state")
    for key in ["new_core_primitive_required", "new_interface_registry_entry_required", "stable_core_promotion_authorized", "next_internal_architecture_expansion_required"]:
        if decision.get(key) is not False:
            fail(f"decision overclaim {key}")
    if decision.get("pilot_layers_remain_valid") is not True:
        fail("pilot validity erased")
    if decision.get("next_genuine_evidence_boundary") != "SEPARATELY_AUTHORIZED_FIELD_INTERACTION_SOURCE":
        fail("next boundary")

    non_effects = data.get("non_effects", {})
    expected = {"core_mutated", "interface_registry_mutated", "release_state_mutated", "kontur_activated", "new_observation_authorized", "action_permit_created", "external_effect_authority_created"}
    if set(non_effects) != expected or any(non_effects[k] is not False for k in expected):
        fail("non-effects")
    return True


def mutations(base):
    out = []
    def add(name, fn):
        value = copy.deepcopy(base); fn(value); out.append((name, value))
    add("pilot_success_core", lambda d: d["policy"].__setitem__("pilot_success_creates_core_requirement", True))
    add("green_core", lambda d: d["policy"].__setitem__("green_ci_creates_core_requirement", True))
    add("lower_consumer_threshold", lambda d: d["policy"].__setitem__("minimum_independent_non_kontur_consumer_evidence", 1))
    add("candidate_blob", lambda d: d["candidates"][0].__setitem__("git_blob_sha1", "0" * 40))
    add("primitive_blob", lambda d: d["reused_primitives"][0].__setitem__("git_blob_sha1", "0" * 40))
    add("fake_consumers", lambda d: d["candidates"][0].__setitem__("independent_non_kontur_consumer_evidence_refs", ["fake:a", "fake:b"]))
    add("cross_domain_overclaim", lambda d: d["candidates"][1].__setitem__("stable_cross_domain_interface_evidence", True))
    add("external_conformance_overclaim", lambda d: d["candidates"][2].__setitem__("external_conformance_evidence", True))
    add("core_admit", lambda d: d["candidates"][0].__setitem__("core_admission", "ADMIT"))
    add("core_required", lambda d: d["decision"].__setitem__("new_core_primitive_required", True))
    add("registry_required", lambda d: d["decision"].__setitem__("new_interface_registry_entry_required", True))
    add("stable_core", lambda d: d["decision"].__setitem__("stable_core_promotion_authorized", True))
    add("architecture_expand", lambda d: d["decision"].__setitem__("next_internal_architecture_expansion_required", True))
    add("erase_pilot", lambda d: d["decision"].__setitem__("pilot_layers_remain_valid", False))
    add("core_mutation", lambda d: d["non_effects"].__setitem__("core_mutated", True))
    add("external_effect", lambda d: d["non_effects"].__setitem__("external_effect_authority_created", True))
    return out


def main():
    data = load(ASSESSMENT)
    validate(data)
    accepted = []
    cases = mutations(data)
    for name, changed in cases:
        try:
            validate(changed)
        except AssertionError:
            continue
        accepted.append(name)
    if accepted:
        print("Unsafe Core-admission mutations accepted: " + ", ".join(accepted), file=sys.stderr)
        return 1
    print(f"KONTUR-to-Core admission assessment valid: NO_CORE_ADMISSION; {len(cases)} fail-closed mutations rejected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
