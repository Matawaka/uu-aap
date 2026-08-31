#!/usr/bin/env python3
"""P1.17 distribution-only gates for deploying the exact P1.16-finalized Pages tree."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BINDINGS = HERE / "source-bindings.json"
OWNER = ROOT / ".github/workflows/verifier-distribution-surface-v0.1.yml"


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "c7263b4cbfd28ec93ff267673382fb6754e49b62"
    assert git_blob_sha(ROOT / bindings["p1_16_finalizer"]["path"]) == bindings["p1_16_finalizer"]["blob"]
    assert git_blob_sha(ROOT / bindings["p1_16_adversarial_test"]["path"]) == bindings["p1_16_adversarial_test"]["blob"]
    assert git_blob_sha(ROOT / bindings["p1_16_workflow"]["path"]) == bindings["p1_16_workflow"]["blob"]

    owner = OWNER.read_text(encoding="utf-8")
    assert "scripts/pages-composition-integrity/**" in owner, "physical owner must trigger on P1.16 inputs"
    assert "scripts/pages-finalized-distribution/**" in owner, "physical owner must trigger on P1.17 distribution inputs"
    assert ".github/workflows/pages-finalized-distribution-v0.1.yml" in owner, "P1.17 workflow must trigger owner validation"

    assert "--p1-15-root \"${RUNNER_TEMP}/composed-pages\"" in owner
    assert "--output \"${RUNNER_TEMP}/finalized-pages\"" in owner
    assert "--verify-only \"${RUNNER_TEMP}/finalized-pages\"" in owner
    assert 'test -s "${RUNNER_TEMP}/finalized-pages/pages-integrity-envelope.json"' in owner
    assert 'test -s "${RUNNER_TEMP}/finalized-pages/pages-composition-receipt.json"' in owner
    assert 'test -s "${RUNNER_TEMP}/finalized-pages/verifier/integrity-capsule/capsule-manifest.json"' in owner

    assert "path: ${{ runner.temp }}/finalized-pages" in owner, "uploaded Pages artifact must be P1.16-finalized tree"
    assert "path: ${{ runner.temp }}/composed-pages" not in owner, "raw P1.15 tree must not be uploaded"
    assert "if: github.event_name == 'push' && github.ref == 'refs/heads/main'" in owner, "PR deployment must remain disabled"

    deploy_owners = []
    for workflow in sorted((ROOT / ".github/workflows").glob("*.yml")):
        text = workflow.read_text(encoding="utf-8")
        if "uses: actions/deploy-pages@" in text:
            deploy_owners.append(workflow.relative_to(ROOT).as_posix())
    assert deploy_owners == [".github/workflows/verifier-distribution-surface-v0.1.yml"], (
        f"exactly one physical deploy-pages owner required, got {deploy_owners}"
    )

    assert "producer_authenticated" not in owner
    assert "truth_established" not in owner
    assert "authority_established" not in owner
    print("P1.17 owner uploads exact P1.16-finalized tree: PASS")
    print("P1.17 one physical deploy-pages owner: PASS")
    print("P1.17 deployment mechanics != semantic/publication authority: PASS")


if __name__ == "__main__":
    main()
