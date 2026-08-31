#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OWNER = ROOT / ".github/workflows/verifier-distribution-surface-v0.1.yml"
BINDINGS = HERE / "source-bindings.json"


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "383a0809a1328c1f12da810216b45e6d5d91fa4d"
    for key in ("p1_16_finalizer", "p1_17_distribution_test", "p1_18_observer", "p1_18_workflow"):
        item = bindings[key]
        assert git_blob_sha(ROOT / item["path"]) == item["blob"], f"P1.19 historical binding drift: {key}"
    assert bindings["predecessor_physical_pages_owner"]["blob"] == "a6bc0fe12094a7dc54ee46f9779632cb68832fe8"

    finding = bindings["observed_failed_packaging"]
    assert finding["missing_p1_16_path"] == ".nojekyll"
    assert finding["upload_pages_artifact_action_sha"] == "7b1f4a764d45c48632c6b24a0339c27f5614fb0b"

    owner = OWNER.read_text(encoding="utf-8")
    assert "scripts/pages-exact-packaging/**" in owner
    assert "scripts/pages-exact-packaging/package_pages.py" in owner
    assert '--finalized-root "${RUNNER_TEMP}/finalized-pages"' in owner
    assert '--artifact-tar "${RUNNER_TEMP}/artifact.tar"' in owner
    assert '--verify-only' in owner
    assert "actions/upload-pages-artifact@" not in owner, "dotfile-dropping upload-pages-artifact packaging must be removed"
    assert "uses: actions/upload-artifact@v4" in owner
    assert "name: github-pages" in owner
    assert "path: ${{ runner.temp }}/artifact.tar" in owner
    assert "include-hidden-files: false" in owner, "only non-hidden artifact.tar is uploaded; hidden payload is inside tar"
    assert "if: github.event_name == 'push' && github.ref == 'refs/heads/main'" in owner
    assert "P1.19" in owner

    deploy_owners = []
    for path in sorted((ROOT / ".github/workflows").glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        if "uses: actions/deploy-pages@" in text:
            deploy_owners.append(path.relative_to(ROOT).as_posix())
    assert deploy_owners == [".github/workflows/verifier-distribution-surface-v0.1.yml"]

    lowered = owner.lower()
    assert "producer_authenticated: true" not in lowered
    assert "truth_established: true" not in lowered
    assert "authority_established: true" not in lowered
    assert "publication_or_action_authority_established: true" not in lowered

    print("P1.19 predecessor packaging gap evidence bound: PASS")
    print("P1.19 physical owner packages artifact.tar explicitly and preserves .nojekyll: PASS")
    print("P1.19 one deploy-pages owner and main-only deployment: PASS")


if __name__ == "__main__":
    main()
