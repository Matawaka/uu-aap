#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

SCHEMA = "urn:uu-aap:cryptovalid-c2sp-witness-qualification-receipt:0.1"
PROFILE_SCHEMA = "urn:uu-aap:cryptovalid-c2sp-witness-qualification-profile:0.1"
STRONG = "CROSS_IMPLEMENTATION_MATCH_ON_BOUNDED_VECTOR_SET_PORTABLE_CONFLICT_EVIDENCE_REVERIFIED_AUTHENTICATED_POLICY_OBJECT_ABSENT"
DIVERGED = "CROSS_IMPLEMENTATION_DIVERGENCE_OBSERVED"
INCOMPLETE = "QUALIFICATION_EVIDENCE_INCOMPLETE"


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def load(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def fail(msg: str):
    raise ValueError(msg)


def load_pilot(repo_root: Path, profile: dict[str, Any]):
    binding = profile["accepted_independent_verifier"]
    path = repo_root / binding["path"]
    data = path.read_bytes()
    if git_blob(data) != binding["git_blob"]:
        fail("accepted independent verifier blob drift")
    spec = importlib.util.spec_from_file_location("uu_aap_accepted_checkpoint_crypto", path)
    if spec is None or spec.loader is None:
        fail("cannot load accepted independent verifier")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def validate_profile(p: dict[str, Any]) -> None:
    if p.get("schema") != PROFILE_SCHEMA or p.get("tracking_issue") != 1005:
        fail("profile identity drift")
    c = p.get("candidate", {})
    if c.get("repository") != "robertolocatelli81-dev/cryptovalid-opencore":
        fail("candidate repository drift")
    if c.get("tag") != "v0.14.0" or c.get("commit") != "c12d847854a4007f3ba40912addabb1b00eb1550":
        fail("candidate exact target drift")
    if c.get("authenticated_policy_object") is not False:
        fail("candidate policy capability promoted")
    r = p.get("reference", {})
    if r.get("repository") != "transparency-dev/witness" or r.get("commit") != "55a5a0bf332a04f64296841ea857f86ec4494fc3":
        fail("reference exact target drift")
    if p.get("cases") != ["first_sight", "append_only_successor", "rollback_replay", "same_size_conflict", "invalid_signature"]:
        fail("case set drift")
    if len(set(p.get("always_false_claims", []))) != len(p.get("always_false_claims", [])):
        fail("duplicate always-false claim")
    sb = p.get("split_view_semantic_boundary", {})
    if sb.get("expected_semantic_pair_fingerprint_sha256") != "688e247a2ce7bed35d198000e0fafbe5e39c31bfaba00fe62070800cdaf755b9":
        fail("split-view semantic fingerprint drift")
    if sb.get("raw_artifact_exact_byte_reproducibility") is not False:
        fail("randomized raw-artifact boundary promoted")


def verify_split_pair(candidate: dict[str, Any], pilot: Any, log_vkey: str) -> dict[str, Any]:
    raw = candidate["cases"]["same_size_conflict"]["raw"]
    ev = raw.get("evidence")
    if not isinstance(ev, dict) or ev.get("tipo") != "split-view" or ev.get("prova") is not True:
        return {"present": False, "reverified": False, "reason": "candidate did not emit full split-view proof"}
    a = ev.get("precedente")
    b = ev.get("presentato")
    if not isinstance(a, str) or not isinstance(b, str):
        return {"present": False, "reverified": False, "reason": "split-view pair missing note bytes"}
    parsed = []
    for note in (a.encode("utf-8"), b.encode("utf-8")):
        body, origin, size, root, sigs = pilot.parse_checkpoint(note)
        ok = pilot.verify_log_signature(body, sigs, log_vkey)
        parsed.append((origin, size, root, ok, sha256(note)))
    same_scope = parsed[0][0] == parsed[1][0] and parsed[0][1] == parsed[1][1]
    distinct_roots = parsed[0][2] != parsed[1][2]
    signatures = parsed[0][3] and parsed[1][3]
    roots_b64 = [base64.b64encode(parsed[0][2]).decode("ascii"), base64.b64encode(parsed[1][2]).decode("ascii")]
    stable_pair = {
        "origin": parsed[0][0] if same_scope else None,
        "tree_size": parsed[0][1] if same_scope else None,
        "roots_b64": sorted(roots_b64),
        "both_log_signatures_verified": bool(signatures),
        "distinct_roots": bool(distinct_roots),
    }
    return {
        "present": True,
        "reverified": bool(same_scope and distinct_roots and signatures),
        "origin": parsed[0][0] if same_scope else None,
        "tree_size": parsed[0][1] if same_scope else None,
        "distinct_roots": distinct_roots,
        "both_log_signatures_verified": signatures,
        "first_root_b64": roots_b64[0],
        "second_root_b64": roots_b64[1],
        "semantic_pair_fingerprint_sha256": sha256(canonical(stable_pair)),
        "raw_note_hashes_include_execution_specific_witness_signatures": True,
        "first_note_sha256": parsed[0][4],
        "second_note_sha256": parsed[1][4],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True)
    ap.add_argument("--reference", required=True)
    ap.add_argument("--candidate", required=True)
    ap.add_argument("--fixtures-metadata", required=True)
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    try:
        p = load(args.profile)
        validate_profile(p)
        ref = load(args.reference)
        cand = load(args.candidate)
        meta = load(args.fixtures_metadata)
        pilot = load_pilot(Path(args.repo_root), p)

        expected = {
            "first_sight": ("ACCEPT_FIRST", "ACCEPT_FIRST"),
            "append_only_successor": ("ACCEPT_SUCCESSOR", "ACCEPT_SUCCESSOR"),
            "rollback_replay": ("REJECT_ROLLBACK", "REJECT_ROLLBACK"),
            "same_size_conflict": ("REJECT_CONFLICT_SAME_SIZE", "REJECT_CONFLICT_SAME_SIZE"),
            "invalid_signature": ("REJECT_INVALID_SIGNATURE", "REJECT_INVALID_SIGNATURE"),
        }
        cases = {}
        all_match = True
        for name, (want_c, want_r) in expected.items():
            c = cand.get("cases", {}).get(name, {})
            r = ref.get("cases", {}).get(name, {})
            csem, rsem = c.get("semantic"), r.get("semantic")
            ok = csem == want_c and rsem == want_r
            cases[name] = {
                "candidate_semantic": csem,
                "reference_semantic": rsem,
                "expected_candidate": want_c,
                "expected_reference": want_r,
                "bounded_semantic_match": ok,
            }
            all_match = all_match and ok

        split = verify_split_pair(cand, pilot, meta["log_vkey"])
        policy = cand.get("candidate_policy_surface", {})
        policy_ok = (
            policy.get("classification") == "NAKED_SCALAR_WITNESS_THRESHOLD_ONLY"
            and policy.get("authenticated_policy_object") is False
            and policy.get("same_name_multi_algorithm_counts_as_one_witness") is True
        )

        evidence_file = cand.get("portable_conflict_evidence", {})
        portable_ok = (
            evidence_file.get("path_present") is True
            and isinstance(evidence_file.get("sha256"), str)
            and evidence_file.get("record_count", 0) >= 1
            and split.get("reverified") is True
            and split.get("semantic_pair_fingerprint_sha256")
                == p["split_view_semantic_boundary"]["expected_semantic_pair_fingerprint_sha256"]
        )

        if all_match and portable_ok and policy_ok:
            verdict = STRONG
        elif not all_match:
            verdict = DIVERGED
        else:
            verdict = INCOMPLETE

        claims = {name: False for name in p["always_false_claims"]}
        receipt = {
            "schema": SCHEMA,
            "tracking_issue": 1005,
            "repository_predecessor_main": p["repository_predecessor_main"],
            "candidate_target": {
                "repository": p["candidate"]["repository"],
                "tag": p["candidate"]["tag"],
                "commit": p["candidate"]["commit"],
                "blobs": p["candidate"]["blobs"],
            },
            "reference_target": dict(p["reference"]),
            "fixture_set": {
                "origin": meta["origin"],
                "log_vkey": meta["log_vkey"],
                "metadata_sha256": sha256(Path(args.fixtures_metadata).read_bytes()),
            },
            "case_comparison": cases,
            "portable_conflict_evidence": split | {
                "artifact_sha256": evidence_file.get("sha256"),
                "artifact_record_count": evidence_file.get("record_count"),
                "raw_artifact_exact_byte_reproducibility":
                    p["split_view_semantic_boundary"]["raw_artifact_exact_byte_reproducibility"],
                "raw_artifact_variability_reason":
                    p["split_view_semantic_boundary"]["reason"],
            },
            "candidate_policy_boundary": {
                "classification": policy.get("classification"),
                "authenticated_policy_object": False,
                "same_name_multi_algorithm_counts_as_one_witness": policy.get("same_name_multi_algorithm_counts_as_one_witness"),
                "uu_aap_authenticated_policy_experiment": "SEPARATE_NOT_ATTRIBUTED_TO_CANDIDATE",
            },
            "time_semantics": {
                "witness_timestamp_is_observation_claim_only": True,
                "trusted_universal_time_proven": False,
                "single_tsa_dependency_required_by_this_fixture": False,
                "no_time_trust_assumptions_proven": False,
            },
            "completeness_semantics": {
                "submitted_log_view_anti_equivocation_only": True,
                "submission_completeness_proven": False,
                "manifest_never_submitted_leaves_transparency_trace": False,
            },
            "verdict": verdict,
            "claims": claims,
            "automatic_action": False,
            "external_mutation_performed": False,
        }
        receipt["receipt_fingerprint_sha256"] = sha256(canonical(receipt))
        Path(args.output).write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(receipt, indent=2, sort_keys=True))
        return 0 if verdict == STRONG else 2
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"CRYPTOVALID_C2SP_QUALIFICATION_FAIL_CLOSED: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
