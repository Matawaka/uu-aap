#!/usr/bin/env python3
from __future__ import annotations

import copy
import hashlib
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import passive_observer as observer  # noqa: E402
import prevention_registry as registry_mod  # noqa: E402


def assert_true(value, message):
    if not value:
        raise AssertionError(message)


def evidence(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def attempted(item, result: str, seed: str):
    item["attempt_state"] = result
    item["attempts"] = [{
        "attempted_at": "2026-08-23T14:00:00Z",
        "result": result,
        "evidence_sha256": evidence(seed),
        "note": "synthetic test evidence"
    }]


def test_registry_states():
    base = json.loads((ROOT / "reference.prevention-registry.json").read_text(encoding="utf-8"))
    summary = registry_mod.summarize(base)
    assert_true(summary["preventer_result"] == "incomplete", "reference registry must remain incomplete until operator verification/attempts")
    assert_true(summary["rescue_gate"] == "blocked_by_unresolved_preventer", "unattempted mandatory preventers must block escalation")
    assert_true(summary["claims"]["loss_confirmed"] is False, "registry cannot confirm loss")

    exhausted = copy.deepcopy(base)
    for idx, item in enumerate(exhausted["preventers"]):
        if item["mandatory_before_rescue"]:
            item["availability_state"] = "unavailable"
            attempted(item, "failed", f"failed-{idx}")
    summary = registry_mod.summarize(exhausted)
    assert_true(summary["preventer_result"] == "exhausted", "all mandatory evidence-bearing failures must satisfy preventer gate")
    assert_true(summary["rescue_gate"] == "preventer_gate_satisfied", "exhausted preventers should only satisfy the preventer gate")
    assert_true(summary["claims"]["rescue_eligible"] is False, "preventer exhaustion alone cannot establish rescue eligibility")

    restored = copy.deepcopy(exhausted)
    first = next(item for item in restored["preventers"] if item["mandatory_before_rescue"])
    first["availability_state"] = "available"
    attempted(first, "succeeded", "restored")
    summary = registry_mod.summarize(restored)
    assert_true(summary["preventer_result"] == "continuity_restored", "successful mandatory preventer must block rescue escalation")
    assert_true(summary["rescue_gate"] == "blocked_by_successful_preventer", "successful preventer must dominate")

    invalid = copy.deepcopy(base)
    first = next(item for item in invalid["preventers"] if item["mandatory_before_rescue"])
    first["attempt_state"] = "failed"
    try:
        registry_mod.summarize(invalid)
    except ValueError:
        pass
    else:
        raise AssertionError("failed preventer without evidence-bearing attempt must fail closed")


def make_file_spec(path: Path, expected_sha: str) -> dict:
    return {
        "artifact_type": "PassiveObserverSpec",
        "artifact_version": "0.2",
        "observer_id": "observer-test-a",
        "observer_domain_id": "test-process-a",
        "failure_domain_id": "test-storage-a",
        "evidence_class": "external_content_anchor",
        "probe_method": "file_sha256",
        "subject": "synthetic-anchor",
        "target": str(path),
        "expected": {"sha256": expected_sha},
        "timeout_seconds": 5,
        "claims": {
            "read_only": True,
            "may_mutate_target": False,
            "may_confirm_loss": False,
            "domain_independence_proven": False
        }
    }


def test_passive_observer():
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "anchor.bin"
        before = b"known-good\n"
        path.write_bytes(before)
        digest = hashlib.sha256(before).hexdigest()
        spec = make_file_spec(path, digest)
        positive = observer.observe(spec, "2026-08-23T14:00:00Z")
        assert_true(positive["result"] == "positive" and positive["indicator"] == "content_match", "matching content anchor must be positive")
        assert_true(path.read_bytes() == before, "observer must not mutate target bytes")
        assert_true(positive["claims"]["loss_confirmed"] is False, "observer must never confirm loss")
        assert_true(positive["claims"]["domain_independence_proven"] is False, "runner cannot self-prove topology independence")

        spec_bad = make_file_spec(path, "0" * 64)
        negative = observer.observe(spec_bad, "2026-08-23T14:01:00Z")
        assert_true(negative["result"] == "negative" and negative["indicator"] == "content_mismatch", "digest mismatch must be negative evidence")
        assert_true(negative["claims"]["rescue_eligible"] is False, "negative observer signal alone cannot make rescue eligible")

    credential_spec = {
        "artifact_type": "PassiveObserverSpec",
        "artifact_version": "0.2",
        "observer_id": "observer-test-web",
        "observer_domain_id": "domain-web",
        "failure_domain_id": "failure-web",
        "evidence_class": "canonical_read_path",
        "probe_method": "http_head",
        "subject": "credential-test",
        "target": "https://user:secret@example.invalid/repo",
        "expected": {"http_status": 200},
        "claims": {"read_only": True, "may_mutate_target": False, "may_confirm_loss": False, "domain_independence_proven": False}
    }
    try:
        observer.validate_spec(credential_spec)
    except ValueError:
        pass
    else:
        raise AssertionError("credential-bearing observer target must be rejected")

    ssh_spec = copy.deepcopy(credential_spec)
    ssh_spec["target"] = "git@example.invalid:owner/repo.git"
    ssh_spec["probe_method"] = "git_ls_remote"
    try:
        observer.validate_spec(ssh_spec)
    except ValueError:
        pass
    else:
        raise AssertionError("SSH observer target must be rejected by no-credentials reference runner")


def main():
    test_registry_states()
    test_passive_observer()
    print("Project Survival Plane v0.2 tests: PASS")


if __name__ == "__main__":
    main()
