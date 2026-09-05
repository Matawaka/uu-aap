#!/usr/bin/env python3
from __future__ import annotations

import base64
import copy
import importlib.util
import json
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("temporal", HERE / "temporal.py")
assert SPEC and SPEC.loader
T = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(T)

checks = 0


def ok(condition: bool, label: str) -> None:
    global checks
    if not condition:
        raise AssertionError(label)
    checks += 1


def raises(fn, label: str) -> None:
    global checks
    try:
        fn()
    except (ValueError, OSError, json.JSONDecodeError):
        checks += 1
        return
    raise AssertionError(label)


def profile() -> dict:
    return json.loads((HERE / "profile.json").read_text(encoding="utf-8"))


def predecessor(p: dict) -> dict:
    claims = {name: False for name in T.FALSE_CLAIMS if name != "continuous_witness_availability_proven"}
    return {
        "schema": T.PREDECESSOR_SCHEMA,
        "tracking_issue": 946,
        "receipt_fingerprint_sha256": T.EXPECTED_ACTIVITY_FP,
        "verdict": T.EXPECTED_ACTIVITY_VERDICT,
        "checkpoint": {
            "origin": T.EXPECTED_ORIGIN,
            "tree_size": T.BASELINE_SIZE,
            "root_b64": T.BASELINE_ROOT_B64,
            "checkpoint_body_sha256": T.BASELINE_CHECKPOINT_SHA256,
            "signed_body_sha256": T.BASELINE_SIGNED_BODY_SHA256,
            "log_signature_verified": True,
        },
        "activity": {
            "verified_pinned_witness_count": 7,
            "all_seven_signed_fetched_current_checkpoint": True,
            "verified_pinned_witness_vkeys": list(p["witness_vkeys"]),
        },
        "claims": claims,
        "automatic_action": False,
        "external_mutation_performed": False,
    }


def names(p: dict) -> list[str]:
    return [T.witness_name(v) for v in p["witness_vkeys"]]


def checkpoint(size: int, root: bytes, verified: int = 7, *, log_ok: bool = True,
               invalid: bool = False, unknown: int = 0, skipped: int = 0, origin: str = T.EXPECTED_ORIGIN) -> bytes:
    data = {
        "origin": origin,
        "size": size,
        "root_b64": base64.b64encode(root).decode("ascii"),
        "verified": verified,
        "log_ok": log_ok,
        "invalid": invalid,
        "unknown": unknown,
        "skipped": skipped,
    }
    return json.dumps(data, sort_keys=True).encode("utf-8")


class FakeCrypto:
    def __init__(self, p: dict):
        self.p = p

    def parse_checkpoint(self, note: bytes):
        d = json.loads(note)
        root = base64.b64decode(d["root_b64"], validate=True)
        body = f'{d["origin"]}\n{d["size"]}\n{d["root_b64"]}\n'.encode("utf-8")
        return body, d["origin"], d["size"], root, [("__meta__", note)]

    def parse_log_vkey(self, vkey: str):
        return T.EXPECTED_ORIGIN, b"kid", b"pub"

    def verify_log_signature(self, body, sigs, vkey):
        return bool(json.loads(sigs[0][1])["log_ok"])

    def verify_witness_cosignatures(self, body, sigs, vkeys, log_name):
        d = json.loads(sigs[0][1])
        vv = max(0, min(int(d["verified"]), 7))
        verified_names = names(self.p)[:vv]
        return {
            "verified": sorted(verified_names),
            "invalid": [{"name": verified_names[0] if verified_names else names(self.p)[0], "reason": "synthetic invalid"}] if d["invalid"] else [],
            "unknown": [f"unknown-{i}" for i in range(d["unknown"])],
            "skipped_non_ed25519": int(d["skipped"]),
            "newest_verified_timestamp": 1788611703 if vv else 0,
        }

    def parse_consistency_proof(self, text: str):
        if text == "malformed":
            raise ValueError("synthetic proof parse failure")
        return [text]

    def verify_consistency(self, size1, size2, root1, root2, proof):
        return size1 == T.BASELINE_SIZE and size2 > size1 and root1 == T.decode_root(T.BASELINE_ROOT_B64) and root2 != root1 and proof == ["ok"]


def eval_case(cp: bytes, proof: str = "ok", p: dict | None = None, pred: dict | None = None):
    p = p or profile()
    pred = pred or predecessor(p)
    return T.evaluate(p, pred, cp, proof, FakeCrypto(p))


p = profile()
pred = predecessor(p)
T.validate_profile(p); ok(True, "base profile")
T.validate_predecessor(pred, p); ok(True, "base predecessor")
ok(T.git_blob_sha1(b"") == "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391", "git empty blob")
ok(len(T.decode_root(T.BASELINE_ROOT_B64)) == 32, "baseline root length")
ok(len(set(names(p))) == 7, "seven unique names")

# Profile drift must fail closed.
profile_mutations = [
    ("schema", "bad"), ("tracking_issue", 999), ("repository_predecessor_main", "0" * 40),
    ("repository_predecessor_tree", "0" * 40), ("predecessor_profile_path", "bad"),
    ("predecessor_profile_git_blob", "0" * 40), ("predecessor_receipt_path", "bad"),
    ("predecessor_receipt_git_blob", "0" * 40), ("required_predecessor_receipt_fingerprint_sha256", "0" * 64),
    ("required_predecessor_verdict", "bad"), ("crypto_reference_path", "bad"),
    ("crypto_reference_git_blob", "0" * 40), ("checkpoint_url", "https://example.invalid"),
    ("consistency_url_template", "bad"), ("required_origin", "other/log"), ("quorum_min", 3),
    ("log_vkey", "bad"), ("witness_vkeys", p["witness_vkeys"][:-1]),
    ("strong_verdict", "bad"), ("quorum_verdict", "bad"), ("same_checkpoint_verdict", "bad"),
    ("authentication_or_consistency_failed_verdict", "bad"), ("insufficient_verdict", "bad"),
]
for key, value in profile_mutations:
    q = copy.deepcopy(p); q[key] = value
    raises(lambda q=q: T.validate_profile(q), f"profile mutation accepted: {key}")
q = copy.deepcopy(p); q["baseline_checkpoint"]["tree_size"] += 1
raises(lambda: T.validate_profile(q), "baseline size drift accepted")
q = copy.deepcopy(p); q["always_false_claims"] = q["always_false_claims"][:-1]
raises(lambda: T.validate_profile(q), "false claim set shrink accepted")
q = copy.deepcopy(p); q["witness_vkeys"][-1] = q["witness_vkeys"][0]
raises(lambda: T.validate_profile(q), "duplicate pin accepted")

# Frozen #947 predecessor drift must fail closed.
for path, value in [
    (("schema",), "bad"), (("tracking_issue",), 999), (("receipt_fingerprint_sha256",), "0" * 64),
    (("verdict",), "bad"), (("checkpoint", "origin"), "other/log"), (("checkpoint", "tree_size"), 7837),
    (("checkpoint", "root_b64"), base64.b64encode(b"x" * 32).decode()),
    (("checkpoint", "checkpoint_body_sha256"), "0" * 64), (("checkpoint", "signed_body_sha256"), "0" * 64),
    (("checkpoint", "log_signature_verified"), False), (("activity", "verified_pinned_witness_count"), 6),
    (("activity", "all_seven_signed_fetched_current_checkpoint"), False),
    (("automatic_action",), True), (("external_mutation_performed",), True),
]:
    r = copy.deepcopy(pred); target = r
    for part in path[:-1]: target = target[part]
    target[path[-1]] = value
    raises(lambda r=r: T.validate_predecessor(r, p), f"predecessor mutation accepted: {path}")
r = copy.deepcopy(pred); r["activity"]["verified_pinned_witness_vkeys"] = r["activity"]["verified_pinned_witness_vkeys"][:-1]
raises(lambda: T.validate_predecessor(r, p), "predecessor pin loss accepted")
r = copy.deepcopy(pred); r["claims"]["continuous_witness_liveness_proven"] = True
raises(lambda: T.validate_predecessor(r, p), "predecessor liveness promotion accepted")

base_root = T.decode_root(T.BASELINE_ROOT_B64)
next_root = b"N" * 32

# Same checkpoint STATE is not temporal activity, even if surrounding signature material changes.
r = eval_case(checkpoint(T.BASELINE_SIZE, base_root, 7, unknown=5, skipped=3), "")
ok(r["verdict"] == T.SAME, "same state verdict")
ok(r["temporal_activity"]["distinct_successor_checkpoint_observed"] is False, "same state distinct false")
ok(r["temporal_activity"]["repeated_activity_established"] is False, "same state repeated false")
ok(r["temporal_activity"]["same_exact_pins_observed_across_two_distinct_states"] is False, "same state all-seven temporal false")
ok(r["claims"]["continuous_witness_liveness_proven"] is False, "same state liveness false")
ok(r["claims"]["continuous_witness_availability_proven"] is False, "same state availability false")

# Strong positive synthetic composition.
r = eval_case(checkpoint(7839, next_root, 7, unknown=20, skipped=9), "ok")
ok(r["verdict"] == T.STRONG, "strong verdict")
ok(r["temporal_activity"]["verified_pinned_witness_count"] == 7, "unknown does not inflate")
ok(r["temporal_activity"]["repeated_activity_established"] is True, "repeated established")
ok(r["temporal_activity"]["same_exact_pins_observed_across_two_distinct_states"] is True, "same exact pins")
ok(r["temporal_activity"]["append_only_relation_verified"] is True, "append relation")
ok(r["temporal_activity"]["state_ordering_basis"] == "MERKLE_APPEND_ONLY_CONSISTENCY_PROOF", "ordering basis")
ok(r["claims"]["trusted_time_proven"] is False, "ordering not trusted time")
ok(r["claims"]["global_non_equivocation_proven"] is False, "append not global non-equivocation")
ok(r["claims"]["all_witnesses_independent_proven"] is False, "seven keys not independence")
ok(r["automatic_action"] is False and r["external_mutation_performed"] is False, "no effects")
T.validate_receipt(r, p); ok(True, "strong receipt validates")
strong = copy.deepcopy(r)

# Distinctness/authentication/consistency hostile cases.
cases = [
    (checkpoint(7837, next_root, 7), "ok", T.AUTH_OR_CONSISTENCY_FAILED, "rollback"),
    (checkpoint(7838, next_root, 7), "ok", T.AUTH_OR_CONSISTENCY_FAILED, "same size different root"),
    (checkpoint(7839, base_root, 7), "ok", T.AUTH_OR_CONSISTENCY_FAILED, "advanced size same root"),
    (checkpoint(7839, next_root, 7, log_ok=False), "ok", T.AUTH_OR_CONSISTENCY_FAILED, "bad log signature"),
    (checkpoint(7839, next_root, 7, invalid=True), "ok", T.AUTH_OR_CONSISTENCY_FAILED, "invalid pinned sig"),
    (checkpoint(7839, next_root, 7), "bad", T.AUTH_OR_CONSISTENCY_FAILED, "invalid consistency"),
    (checkpoint(7839, next_root, 7), "malformed", T.AUTH_OR_CONSISTENCY_FAILED, "malformed consistency"),
    (checkpoint(7839, next_root, 3), "ok", T.INSUFFICIENT, "below quorum"),
    (checkpoint(7839, next_root, 0), "ok", T.INSUFFICIENT, "zero pinned"),
]
for cp, proof, verdict, label in cases:
    rr = eval_case(cp, proof)
    ok(rr["verdict"] == verdict, label)
    ok(rr["temporal_activity"]["same_exact_pins_observed_across_two_distinct_states"] is False, label + " no all-seven temporal")
    ok(rr["claims"]["continuous_witness_availability_proven"] is False, label + " no continuous availability")

# Quorum partial is evidence, never all-seven/continuous evidence.
for n in (4, 5, 6):
    rr = eval_case(checkpoint(7839, next_root, n), "ok")
    ok(rr["verdict"] == T.QUORUM, f"quorum {n}")
    ok(rr["temporal_activity"]["repeated_activity_established"] is True, f"quorum {n} repeated")
    ok(rr["temporal_activity"]["same_exact_pins_observed_across_two_distinct_states"] is False, f"quorum {n} not all seven")
    ok(rr["claims"]["all_seven_currently_active_proven"] is False, f"quorum {n} current false")

# External evidence failure is explicit and non-promoting.
er = T.external_unavailable_receipt(p, "network unavailable")
ok(er["verdict"] == T.EXTERNAL_UNAVAILABLE, "external unavailable verdict")
ok(er["successor_checkpoint"] is None, "external unavailable no successor")
ok(er["temporal_activity"]["repeated_activity_established"] is False, "external unavailable no repeat")
T.validate_receipt(er, p); ok(True, "external receipt validates")

# Frozen receipt validator rejects semantic promotions and fingerprint tampering.
mutators = []
mutators.append(lambda x: x["claims"].__setitem__("continuous_witness_liveness_proven", True))
mutators.append(lambda x: x["claims"].__setitem__("continuous_witness_availability_proven", True))
mutators.append(lambda x: x["claims"].__setitem__("trusted_time_proven", True))
mutators.append(lambda x: x["claims"].__setitem__("global_non_equivocation_proven", True))
mutators.append(lambda x: x.__setitem__("automatic_action", True))
mutators.append(lambda x: x.__setitem__("external_mutation_performed", True))
mutators.append(lambda x: x.__setitem__("receipt_fingerprint_sha256", "0" * 64))
mutators.append(lambda x: x["temporal_activity"].__setitem__("verified_pinned_witness_count", 8))
mutators.append(lambda x: x["temporal_activity"].__setitem__("repeated_activity_established", False))
mutators.append(lambda x: x["temporal_activity"].__setitem__("distinct_successor_checkpoint_observed", False))
mutators.append(lambda x: x["temporal_activity"].__setitem__("append_only_relation_verified", False))
mutators.append(lambda x: x["temporal_activity"].__setitem__("same_exact_pins_observed_across_two_distinct_states", False))
for i, mutate in enumerate(mutators):
    rr = copy.deepcopy(strong); mutate(rr)
    # Recompute fingerprint for semantic mutations except the explicit fingerprint mutation.
    if i != 6:
        rr["receipt_fingerprint_sha256"] = T.fingerprint_without_field(rr)
    raises(lambda rr=rr: T.validate_receipt(rr, p), f"receipt promotion mutation {i} accepted")

# Git-blob binding fails on content drift.
with tempfile.TemporaryDirectory() as td:
    root = Path(td); rel = "x.txt"; (root / rel).write_text("abc", encoding="utf-8")
    expected = T.git_blob_sha1(b"abc")
    ok(T.require_git_blob(root, rel, expected) == b"abc", "exact git blob accepted")
    raises(lambda: T.require_git_blob(root, rel, "0" * 40), "git blob drift accepted")

# On a real repository checkout (GitHub CI), prove the accepted #934 primitive is exact and loadable.
repo_root = HERE.parents[2] if len(HERE.parents) >= 3 else HERE
crypto_path = repo_root / p["crypto_reference_path"]
if crypto_path.exists():
    ok(T.git_blob_sha1(crypto_path.read_bytes()) == T.EXPECTED_CRYPTO_BLOB, "real #934 crypto blob exact")
    module = T.load_crypto(repo_root, p)
    ok(hasattr(module, "verify_consistency") and hasattr(module, "verify_witness_cosignatures"), "real #934 crypto API load")

print(f"TEMPORAL_DISTINCT_HOSTILE_PASS: {checks}/{checks}")
