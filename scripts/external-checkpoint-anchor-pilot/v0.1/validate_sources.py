#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PROFILE = json.loads((HERE / "profile.json").read_text(encoding="utf-8"))


def fail(message: str) -> None:
    raise SystemExit(f"EXTERNAL_CHECKPOINT_ANCHOR_SOURCE_BINDING_FAIL: {message}")


def git_blob(path: str) -> str:
    p = subprocess.run(["git", "rev-parse", f"HEAD:{path}"], cwd=ROOT, text=True, capture_output=True)
    if p.returncode != 0:
        fail(f"cannot bind repository path {path}: {p.stderr.strip()}")
    return p.stdout.strip()


if PROFILE["repository_predecessor_main"] != "f7d5149254892803b84bb31bdc127751c418b544":
    fail("repository predecessor drift")

pred = PROFILE["predecessor_audit"]
if pred != {
    "path": "research/external-anchor-sufficiency-audit/v0.1/implementation-receipt.json",
    "blob": "1133edd106e2499541a278e88ae36a2862f9b972",
}:
    fail("#928 predecessor binding drift")
if git_blob(pred["path"]) != pred["blob"]:
    fail("#928 implementation receipt bytes drift")

external = PROFILE["external_source"]
if external["repository"] != "MarkovianProtocol/tlog-bitcoin-anchor":
    fail("external repository drift")
if external["commit"] != "b75d339e9ed5cce5ef4c2cee1cfa78c3e1e1abf1":
    fail("external source commit drift")
expected_files = {
    "rootcommit_json": ("rootcommit/mkv_rootcommit.json", "f6083550fa9dbbc1ba5bf5ec07e3b292665932cc"),
    "anchored_checkpoint": ("rootcommit/mkv_checkpoint.rootcommit.txt", "1fefd6d579b33e532cd7158954635446c4226234"),
    "ots_proof": ("rootcommit/rootcommit_preimage.bin.ots", "7b3d48c7573b7481ec45011b76f695c130d5c1a2"),
    "vector_manifest": ("rootcommit/vectors/manifest.json", "cbf876a66479d77dedb976cc19664d461bb03864"),
}
for key, (path, blob) in expected_files.items():
    item = external["files"].get(key)
    if item != {"path": path, "blob": blob}:
        fail(f"external file binding drift: {key}")

pilot_text = (HERE / "pilot.py").read_text(encoding="utf-8")
for forbidden in ["verify_claim_leaf", "verify_rootcommit.py", "run_rootcommit_vectors.py"]:
    if forbidden in pilot_text:
        fail(f"pilot must not import/count external verifier as proof: {forbidden}")
if "root_from_inclusion" not in pilot_text or "parse_ots_commitment" not in pilot_text:
    fail("independent Merkle/OTS verification surfaces missing")

profile_text = json.dumps(PROFILE, sort_keys=True).lower()
for forbidden in ["trust_score", "security_score", "non_equivocation_score", "canonical_verdict"]:
    if forbidden in profile_text:
        fail(f"forbidden scalar/ranking surface in profile: {forbidden}")

print("EXTERNAL_CHECKPOINT_ANCHOR_SOURCE_BINDING_PASS")
