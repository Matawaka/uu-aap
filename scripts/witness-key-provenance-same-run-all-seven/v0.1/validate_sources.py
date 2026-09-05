#!/usr/bin/env python3
import importlib.util
import json
import subprocess
from pathlib import Path

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
pin_set = rp.validate_profile(profile, pre_profile, pre_receipt, pin_profile)
assert len(pin_set) == 7
assert {s["witness_vkey"] for s in profile["sources"]} == pin_set
assert len({s["source_url"] for s in profile["sources"]}) == 6
assert sum(1 for s in profile["sources"] if s["source_url"] == "https://transparency.dev/witnesses") == 2
geomys = [s for s in profile["sources"] if s["id"] == "geomys-navigli"]
assert len(geomys) == 1 and geomys[0]["expected_git_blob"] == "95a3e95134487229343bb6197f6fa1723cfa20d7"
print("VALID exact #938 predecessor bindings and exact same-run seven-pin/six-URL source profile")
