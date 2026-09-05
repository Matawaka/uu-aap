#!/usr/bin/env python3
import importlib.util,json,subprocess
from pathlib import Path
D=Path(__file__).resolve().parent; root=D.parents[2]; p=json.load(open(D/"profile.json"))
def blob(x): return subprocess.check_output(["git","hash-object",str(root/x)],text=True).strip()
for path,key in ((p["predecessor_profile_path"],"predecessor_profile_git_blob"),(p["predecessor_receipt_path"],"predecessor_receipt_git_blob"),(p["pin_set_profile_path"],"pin_set_profile_git_blob")):
 assert blob(Path(path))==p[key],(path,blob(Path(path)),p[key])
pp=json.load(open(root/p["predecessor_profile_path"])); pr=json.load(open(root/p["predecessor_receipt_path"])); pins=json.load(open(root/p["pin_set_profile_path"]))
spec=importlib.util.spec_from_file_location("topology",D/"topology.py"); tp=importlib.util.module_from_spec(spec); spec.loader.exec_module(tp); pin_set=tp.validate_profile(p,pp,pr,pins)
assert len(pin_set)==7 and len(p["operators"])==6
assert len({tp.normalize_url(o["attribution_url"]) for o in p["operators"]})==6
assert len({tp.normalize_url(o["key_material_url"]) for o in p["operators"]})==6
geomys=next(o for o in p["operators"] if o["operator_label"]=="Geomys"); assert geomys["key_material_relation"]=="OPERATOR_PAGE_LINK" and tp.normalize_url(geomys["attribution_url"])!=tp.normalize_url(geomys["key_material_url"])
trust=next(o for o in p["operators"] if o["operator_label"]=="TrustFabric"); assert len(trust["witness_vkeys"])==2
print("VALID exact #940 predecessor bindings and split attribution/key-material topology")
