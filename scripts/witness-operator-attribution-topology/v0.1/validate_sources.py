#!/usr/bin/env python3
import importlib.util
import json
import subprocess
from pathlib import Path

D = Path(__file__).resolve().parent
root = D.parents[2]
profile = json.load(open(D / "profile.json", encoding="utf-8"))


def blob(path):
    return subprocess.check_output(["git", "hash-object", str(root / path)], text=True).strip()

pp = Path(profile["predecessor_profile_path"])
pr = Path(profile["predecessor_receipt_path"])
ps = Path(profile["pin_set_profile_path"])
assert blob(pp) == profile["predecessor_profile_git_blob"], (blob(pp), profile["predecessor_profile_git_blob"])
assert blob(pr) == profile["predecessor_receipt_git_blob"], (blob(pr), profile["predecessor_receipt_git_blob"])
assert blob(ps) == profile["pin_set_profile_git_blob"], (blob(ps), profile["pin_set_profile_git_blob"])

pre_profile = json.load(open(root / pp, encoding="utf-8"))
pre_receipt = json.load(open(root / pr, encoding="utf-8"))
pin_profile = json.load(open(root / ps, encoding="utf-8"))

spec = importlib.util.spec_from_file_location("topology", D / "topology.py")
tp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tp)
pin_set = tp.validate_profile(profile, pre_profile, pre_receipt, pin_profile)

assert len(pin_set) == 7
assert len(profile["operators"]) == 6
assert len({op["operator_label"] for op in profile["operators"]}) == 6
assert len({tp.normalize_url(op["about_url"]) for op in profile["operators"]}) == 6
trust = [op for op in profile["operators"] if op["operator_label"] == "TrustFabric"]
assert len(trust) == 1 and len(trust[0]["witness_vkeys"]) == 2
assert sum(len(op["witness_vkeys"]) for op in profile["operators"]) == 7
assert profile["registry"]["source_classification"] == "NETWORK_CURATED_OPERATOR_TABLE"
print("VALID exact #940 predecessor bindings and exact seven-pin/six-public-label attribution topology")
