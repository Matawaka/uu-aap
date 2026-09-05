#!/usr/bin/env python3
import json
import subprocess
import hashlib
from pathlib import Path

D=Path(__file__).resolve().parent
profile=json.load(open(D/"profile.json",encoding="utf-8"))
root=D.parents[2]

def blob(path):
    return subprocess.check_output(["git","hash-object",str(root/path)],text=True).strip()

pp=Path(profile["predecessor_profile_path"]); pr=Path(profile["predecessor_receipt_path"])
assert blob(pp)==profile["predecessor_profile_git_blob"], (blob(pp),profile["predecessor_profile_git_blob"])
assert blob(pr)==profile["predecessor_receipt_git_blob"], (blob(pr),profile["predecessor_receipt_git_blob"])
base=json.load(open(root/pp,encoding="utf-8")); receipt=json.load(open(root/pr,encoding="utf-8"))
checkpoint=root/Path(profile["predecessor_checkpoint_path"]); consistency=root/Path("scripts/anchored-witnessed-consistency-pilot/v0.1/current-consistency.txt")
assert hashlib.sha256(checkpoint.read_bytes()).hexdigest()==profile["predecessor_checkpoint_sha256"]
assert hashlib.sha256(consistency.read_bytes()).hexdigest()==profile["predecessor_consistency_sha256"]
assert receipt["receipt_fingerprint_sha256"]==profile["required_predecessor_receipt_fingerprint_sha256"]
assert receipt["later_checkpoint"]["checkpoint_sha256"]==profile["predecessor_checkpoint_sha256"]
assert receipt["consistency"]["proof_text_sha256"]==profile["predecessor_consistency_sha256"]
assert base["quorum_min"]==profile["quorum_min"]==4
assert base["key_provenance_assurance"]==profile["required_predecessor_key_provenance_assurance"]
assert receipt["verdict"]==profile["required_predecessor_verdict"]
assert receipt["later_checkpoint"]["key_provenance_assurance"]==profile["required_predecessor_key_provenance_assurance"]
pinned=set(base["witness_vkeys"]); assert len(pinned)==7
assert all(s["witness_vkey"] in pinned for s in profile["operator_sources"])
assert len({s["witness_vkey"] for s in profile["operator_sources"]})==5
assert len({s["source_url"] for s in profile["operator_sources"]})==4
assert len({s["source_url"].split('/')[2] for s in profile["operator_sources"]})==4
print("VALID exact #934 source bindings and bounded operator-source profile")
