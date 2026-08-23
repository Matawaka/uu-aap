#!/usr/bin/env python3
import json
import sys
from pathlib import Path

REQUIRED_IDS = {
    "recovery-resume-v0.1",
    "capability-ceiling-v0.1",
    "pause-degradation-v0.1",
    "exploratory-disposition-v0.1",
    "human-observation-v0.1",
}
REQUIRED_INVARIANTS = {f"K{i}" for i in range(1, 11)}
EXPECTED_PATHS = {
    "recovery-resume-v0.1": (
        "docs/SUSTAINABILITY-RECOVERY-RESUME-v0.1.md",
        "schemas/sustainability/v0.1/recovery-resume-contract.schema.json",
        "schemas/sustainability/v0.1/tests/test_recovery_resume_contract_v01.py",
    ),
    "capability-ceiling-v0.1": (
        "docs/SUSTAINABILITY-CAPABILITY-CEILING-v0.1.md",
        "schemas/sustainability/v0.1/capability-ceiling-contract.schema.json",
        "schemas/sustainability/v0.1/tests/test_capability_ceiling_contract_v01.py",
    ),
    "pause-degradation-v0.1": (
        "docs/SUSTAINABILITY-PAUSE-DEGRADATION-v0.1.md",
        "schemas/sustainability/v0.1/pause-degradation-contract.schema.json",
        "schemas/sustainability/v0.1/tests/test_pause_degradation_contract_v01.py",
    ),
    "exploratory-disposition-v0.1": (
        "docs/SUSTAINABILITY-EXPLORATORY-DISPOSITION-v0.1.md",
        "schemas/sustainability/v0.1/exploratory-disposition-contract.schema.json",
        "schemas/sustainability/v0.1/tests/test_exploratory_disposition_contract_v01.py",
    ),
    "human-observation-v0.1": (
        "docs/SUSTAINABILITY-HUMAN-OBSERVATION-v0.1.md",
        "schemas/sustainability/v0.1/human-observation-contract.schema.json",
        "schemas/sustainability/v0.1/tests/test_human_observation_contract_v01.py",
    ),
}

def require(cond, message):
    if not cond:
        raise ValueError(message)

def assess(data, repo_root: Path):
    components = data["components"]
    ids = [c["id"] for c in components]
    require(len(ids) == len(set(ids)), "duplicate component id")
    require(set(ids) == REQUIRED_IDS, "required component set mismatch")

    covered = set()
    for component in components:
        cid = component["id"]
        expected = EXPECTED_PATHS[cid]
        actual = (component["document_path"], component["schema_path"], component["test_path"])
        require(actual == expected, f"path binding mismatch for {cid}")
        for rel in actual:
            path = repo_root / rel
            require(path.is_file(), f"missing bound artifact: {rel}")
        covered.update(component["invariants"])

    require(covered == REQUIRED_INVARIANTS, "K1-K10 coverage mismatch")
    coverage = data["coverage"]
    require(set(coverage) == REQUIRED_INVARIANTS, "coverage key mismatch")
    require(all(coverage[k] is True for k in REQUIRED_INVARIANTS), "coverage must be true for K1-K10")
    require(data["result"] == "kernel-v0.1-operationally-covered", "unexpected result")

    claims = data["claims"]
    require(claims["authority_effect"] == "none", "closure cannot create authority")
    for key in (
        "external_execution_authorized",
        "capability_expansion_authorized",
        "canonical_authority_established",
        "kontur_activation_authorized",
        "universal_completeness_claimed",
    ):
        require(claims[key] is False, f"unsafe positive claim: {key}")
    require(claims["future_evolution_allowed"] is True, "future evolution must remain allowed")
    require(claims["new_capability_requires_new_attributable_authorization"] is True,
            "new capability must require new attributable authorization")
    return {"valid": True, "result": data["result"], "covered_invariants": sorted(covered)}

def main():
    if len(sys.argv) not in (2, 3):
        raise SystemExit("usage: kernel_conformance_assessor.py <artifact.json> [repo-root]")
    artifact = Path(sys.argv[1])
    repo_root = Path(sys.argv[2]) if len(sys.argv) == 3 else Path.cwd()
    data = json.loads(artifact.read_text(encoding="utf-8"))
    print(json.dumps(assess(data, repo_root), sort_keys=True, separators=(",", ":")))

if __name__ == "__main__":
    main()
