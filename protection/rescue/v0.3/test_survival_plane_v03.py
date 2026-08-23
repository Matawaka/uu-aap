#!/usr/bin/env python3
import copy
import hashlib
import json
import tempfile
from pathlib import Path

from observer_topology import evaluate
from rescue_capsule import create_capsule, file_sha256, verify_capsule

ROOT = Path(__file__).resolve().parent
POLICY = ROOT / "reference.observer-topology-policy.json"
FIXED_AT = "2026-08-23T12:00:00Z"


def h(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def attestation(observer, attestor, od, fd, cd, pd, nd, evidence_class, valid_until="2027-08-23T12:00:00Z"):
    return {
        "artifact_type": "ObserverDeploymentAttestation",
        "artifact_version": "0.3",
        "attestation_id": f"att-{observer}",
        "observer_id": observer,
        "observer_spec_sha256": h("spec-" + observer),
        "attestor_id": attestor,
        "attestor_domain_id": "attestor-domain-" + attestor,
        "issued_at": "2026-08-22T12:00:00Z",
        "valid_until": valid_until,
        "deployment_domains": {
            "observer_domain_id": od,
            "failure_domain_id": fd,
            "custodian_domain_id": cd,
            "provider_domain_id": pd,
            "network_domain_id": nd
        },
        "evidence": [{
            "evidence_class": evidence_class,
            "evidence_ref": "evidence:" + observer,
            "evidence_sha256": h("evidence-" + observer)
        }],
        "claims": {
            "observer_self_attestation": False,
            "deployment_evidence_reviewed": True,
            "contains_credentials": False,
            "canonical_authority_granted": False,
            "loss_confirmed": False,
            "rescue_eligible": False,
            "universal_physical_independence_proven": False
        }
    }


def write_set(directory, values):
    directory.mkdir(parents=True, exist_ok=True)
    for i, value in enumerate(values, 1):
        (directory / f"{i:02d}.json").write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def expect_fail(fn, label):
    try:
        fn()
    except Exception:
        return
    raise AssertionError(label)


def main():
    a1 = attestation("observer-a", "human-a", "observer-domain-a", "failure-a", "custodian-a", "provider-a", "network-a", "custodian_attestation")
    a2 = attestation("observer-b", "human-b", "observer-domain-b", "failure-b", "custodian-b", "provider-b", "network-b", "provider_receipt")

    with tempfile.TemporaryDirectory() as td:
        root = Path(td)

        good_dir = root / "attestations-good"
        write_set(good_dir, [a1, a2])
        assessment = evaluate(POLICY, good_dir, root / "assessment.json", FIXED_AT)
        assert assessment["decision"] == "independence_sufficient_for_policy"
        assert assessment["claims"]["independence_sufficient_for_policy"] is True
        assert assessment["claims"]["universal_physical_independence_proven"] is False
        assert assessment["claims"]["loss_confirmed"] is False
        assert assessment["claims"]["rescue_eligible"] is False
        assert assessment["metrics"]["provider_domains"] == 2

        duplicate = copy.deepcopy(a2)
        duplicate["observer_id"] = "observer-a"
        duplicate_dir = root / "attestations-duplicate"
        write_set(duplicate_dir, [a1, duplicate])
        result = evaluate(POLICY, duplicate_dir, root / "duplicate-assessment.json", FIXED_AT)
        assert result["decision"] == "independence_insufficient_for_policy"
        assert result["metrics"]["invalid_attestations"] >= 1

        expired = copy.deepcopy(a2)
        expired["valid_until"] = "2026-08-23T11:00:00Z"
        expired_dir = root / "attestations-expired"
        write_set(expired_dir, [a1, expired])
        result = evaluate(POLICY, expired_dir, root / "expired-assessment.json", FIXED_AT)
        assert result["decision"] == "independence_insufficient_for_policy"
        assert result["metrics"]["expired_attestations"] == 1

        same_provider = copy.deepcopy(a2)
        same_provider["deployment_domains"]["provider_domain_id"] = "provider-a"
        provider_dir = root / "attestations-provider"
        write_set(provider_dir, [a1, same_provider])
        result = evaluate(POLICY, provider_dir, root / "provider-assessment.json", FIXED_AT)
        assert result["decision"] == "independence_insufficient_for_policy"
        assert result["metrics"]["provider_domains"] == 1

        self_attested = copy.deepcopy(a2)
        self_attested["attestor_id"] = self_attested["observer_id"]
        self_dir = root / "attestations-self"
        write_set(self_dir, [a1, self_attested])
        result = evaluate(POLICY, self_dir, root / "self-assessment.json", FIXED_AT)
        assert result["decision"] == "independence_insufficient_for_policy"

        source1 = root / "frontier.json"
        source2 = root / "observation.json"
        source1.write_text('{"frontier":"23dbf817"}\n', encoding="utf-8")
        source2.write_text('{"result":"negative","loss_confirmed":false}\n', encoding="utf-8")
        before1, before2 = file_sha256(source1), file_sha256(source2)
        capsule = root / "capsule"
        create_capsule(
            "Matawaka/uu-aap",
            "git:23dbf817eb36aa0a4c5fc2f30dea762028ef7e3c",
            capsule,
            [f"frontier_evidence:{source1}", f"passive_observation:{source2}"],
            FIXED_AT,
        )
        manifest = verify_capsule(capsule)
        assert manifest["claims"]["capsule_internal_integrity_only"] is True
        assert manifest["claims"]["rescue_authorized"] is False
        assert manifest["claims"]["canonical_successor_established"] is False
        assert file_sha256(source1) == before1 and file_sha256(source2) == before2
        assert all(Path(x["source_label"]).name == x["source_label"] for x in manifest["items"])

        tampered = capsule / manifest["items"][0]["stored_path"]
        with tampered.open("ab") as f:
            f.write(b"tamper")
        expect_fail(lambda: verify_capsule(capsule), "tampered capsule item accepted")

        capsule2 = root / "capsule-no-marker"
        create_capsule(
            "Matawaka/uu-aap",
            "git:23dbf817eb36aa0a4c5fc2f30dea762028ef7e3c",
            capsule2,
            [f"external_anchor:{source1}"],
            FIXED_AT,
        )
        (capsule2 / "CAPSULE_COMPLETE").unlink()
        expect_fail(lambda: verify_capsule(capsule2), "incomplete capsule accepted")

    print("Project Survival Plane v0.3 tests: PASS")


if __name__ == "__main__":
    main()
