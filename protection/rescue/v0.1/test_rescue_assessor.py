#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("rescue_assessor", ROOT / "rescue_assessor.py")
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)
policy = json.loads((ROOT / "reference.project-rescue-policy.json").read_text())
H = hashlib.sha256(b"fixture").hexdigest()


def obs(i, minute, cls, observer, failure, result="unavailable", indicator="temporary_error", subject="canonical_origin"):
    return {
        "observation_id": f"obs-{i}",
        "observed_at": f"2026-08-23T12:{minute:02d}:00Z" if minute < 60 else f"2026-08-23T{12 + minute//60:02d}:{minute%60:02d}:00Z",
        "observer_domain_id": observer,
        "failure_domain_id": failure,
        "evidence_class": cls,
        "subject": subject,
        "result": result,
        "indicator": indicator,
        "evidence_ref": None,
        "evidence_sha256": H,
        "claims": {"establishes_loss_alone": False, "contains_credentials": False}
    }


def base_case():
    return {
        "artifact_type": "ProjectRescueCase",
        "artifact_version": "0.1",
        "case_id": "urn:test:case:1",
        "project_id": policy["project_id"],
        "opened_at": "2026-08-23T12:00:00Z",
        "last_known_good_frontier": {"kind": "git_commit", "ref": "abc123", "sha256": H},
        "observations": [],
        "preventers": [
            {"preventer_id": p, "status": "exhausted", "evidence_ref": None, "evidence_sha256": H}
            for p in policy["mandatory_preventers"]
        ],
        "recovery_sources": [{
            "source_id": "bundle-1", "source_kind": "git_bundle", "failure_domain_id": "offline-a",
            "verified": True, "content_sha256": H, "frontier_ref": "abc123",
            "claims": {"canonical": False, "authority_transfer": False}
        }],
        "claims": {"human_authorization_present": False, "canonical_successor_established": False, "automatic_recovery_executed": False}
    }


c = base_case()
r = mod.evaluate(policy, c, "2026-08-23T12:40:00Z")
assert r["state"] == "healthy" and not r["claims"]["loss_confirmed"]

c = base_case(); c["observations"] = [obs(1, 0, "canonical_read_path", "net-a", "github")]
r = mod.evaluate(policy, c, "2026-08-23T12:40:00Z")
assert r["state"] == "degraded"

c = base_case(); c["observations"] = [
    obs(1, 0, "canonical_read_path", "net-a", "github"),
    obs(2, 31, "canonical_control_path", "net-a", "github", subject="owner_or_admin_control"),
    obs(3, 32, "provider_status_path", "net-a", "github")
]
r = mod.evaluate(policy, c, "2026-08-23T12:40:00Z")
assert r["state"] == "loss_suspected"

c = base_case(); c["observations"] = [
    obs(1, 0, "canonical_read_path", "net-a", "github-read", indicator="object_missing"),
    obs(2, 31, "independent_human_custodian", "human-b", "account-b", indicator="custodian_unavailable", subject="owner_or_admin_control"),
    obs(3, 32, "provider_status_path", "status-provider", "provider-control", indicator="provider_confirmed_deleted")
]
r = mod.evaluate(policy, c, "2026-08-23T12:40:00Z")
assert r["state"] == "rescue_eligible" and r["claims"]["loss_confirmed"] and not r["claims"]["execution_authority_granted"]

c2 = copy.deepcopy(c); c2["preventers"][0]["status"] = "available_not_attempted"
r2 = mod.evaluate(policy, c2, "2026-08-23T12:40:00Z")
assert r2["state"] == "loss_confirmed" and r2["decision"] == "loss_confirmed_not_rescue_eligible"

c3 = copy.deepcopy(c); c3["recovery_sources"][0]["verified"] = False
r3 = mod.evaluate(policy, c3, "2026-08-23T12:40:00Z")
assert r3["state"] == "loss_confirmed"

c4 = base_case(); c4["observations"] = [
    obs(1, 0, "canonical_read_path", "net-a", "github-read"),
    obs(2, 181, "independent_human_custodian", "human-b", "account-b", indicator="custodian_unavailable", subject="owner_or_admin_control"),
    obs(3, 361, "provider_status_path", "status-provider", "provider-control")
]
r4 = mod.evaluate(policy, c4, "2026-08-23T18:05:00Z")
assert r4["state"] == "rescue_eligible" and r4["loss_classification"] == "availability_loss"

c5 = copy.deepcopy(c4); c5["observations"].append(obs(4, 362, "canonical_read_path", "net-c", "github-read", result="available", indicator="reachable"))
r5 = mod.evaluate(policy, c5, "2026-08-23T18:06:00Z")
assert r5["state"] == "loss_confirmation_pending" and not r5["claims"]["loss_confirmed"]

print("Project Rescue Protocol v0.1 tests: success")
