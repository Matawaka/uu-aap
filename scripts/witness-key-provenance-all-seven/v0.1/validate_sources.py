#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
import importlib.util

D = Path(__file__).resolve().parent
root = D.parents[2]
profile = json.load(open(D/"profile.json", encoding="utf-8"))

def blob(path):
    return subprocess.check_output(["git", "hash-object", str(root/path)], text=True).strip()

pp = Path(profile["predecessor_profile_path"])
pr = Path(profile["predecessor_receipt_path"])
ps = Path(profile["pin_set_profile_path"])
assert blob(pp) == profile["predecessor_profile_git_blob"], (blob(pp), profile["predecessor_profile_git_blob"])
assert blob(pr) == profile["predecessor_receipt_git_blob"], (blob(pr), profile["predecessor_receipt_git_blob"])
assert blob(ps) == profile["pin_set_profile_git_blob"], (blob(ps), profile["pin_set_profile_git_blob"])

pre_profile = json.load(open(root/pp, encoding="utf-8"))
pre_receipt = json.load(open(root/pr, encoding="utf-8"))
pin_profile = json.load(open(root/ps, encoding="utf-8"))

spec = importlib.util.spec_from_file_location("reproof", D/"reproof.py")
rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
pin_set, prior = rp.validate_profile(profile, pre_profile, pre_receipt, pin_profile)
assert len(pin_set) == 7
assert len(prior) == 5
new = {s["witness_vkey"] for s in profile["new_sources"]}
assert len(new) == 2
assert prior.isdisjoint(new)
assert prior | new == pin_set
assert len({s["source_url"] for s in profile["new_sources"]}) == 2
print("VALID exact #936 predecessor bindings and exact two-missing-pin successor profile")
