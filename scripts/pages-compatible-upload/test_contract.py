#!/usr/bin/env python3
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
    assert bindings["predecessor_main"] == "eedfdf1a60e39b976b0490b570206aca271b95e2"

    p1_19 = bindings["p1_19_packager"]
    assert p1_19["blob"] == "317ac7ccc8edd506d23f6589d00326ba552fa442"
    assert git_blob_sha(ROOT / p1_19["path"]) == p1_19["blob"], "P1.20 changed historical P1.19 packager bytes"
    assert bindings["p1_19_contract"]["blob"] == "f4bbeebb53233ef4dc2d879ec1e6c1658f99c3b0"
    assert bindings["predecessor_physical_pages_owner"]["blob"] == "cacf4b81d7a1435415bb5478e8cfcebfba67b674"

    observed = bindings["observed_failed_deployment"]
    assert observed["workflow_run_id"] == "33355250883"
    assert observed["github_pages_artifact_id"] == "9744916228"
    assert observed["github_pages_artifact_digest"] == "sha256:6a80b9cff9411517857b4ae4005892c9d1c8fee59082bed0b60203c51fb1e300"
    assert observed["failed_deploy_job_ids"] == ["99376101734", "99376241967"]
    assert observed["pages_url"] == "https://matawaka.github.io/uu-aap/"
    assert observed["deployment_status"] == "deployment_failed"
    assert observed["artifact_tar_member_count"] == 137
    assert observed["artifact_tar_nojekyll_present"] is True
    assert observed["artifact_tar_link_count"] == 0
    assert observed["canonical_tar_uid"] == 0
    assert observed["canonical_tar_gid"] == 0

    uploader = bindings["pages_compatible_uploader"]
    assert uploader["commit"] == "fc324d3547104276b827a68afc52ff2a11cc49c9"
    assert uploader["version"] == "v5"
    assert uploader["hidden_files_input"] == "include-hidden-files"
    assert uploader["hidden_files_value"] is True

    owner = OWNER.read_text(encoding="utf-8")
    assert "P1.20" in owner, "P1.20 successor identity must remain visible in physical owner"
    assert "scripts/pages-compatible-upload/**" in owner
    assert "python scripts/pages-compatible-upload/test_contract.py" in owner

    # Preserve P1.19 as an independent canonical payload-fidelity proof.
    assert "scripts/pages-exact-packaging/package_pages.py" in owner
    assert '--finalized-root "${RUNNER_TEMP}/finalized-pages"' in owner
    assert '--artifact-tar "${RUNNER_TEMP}/artifact.tar"' in owner
    assert "P1.19" in owner

    # Physical Pages transport is the stable official hidden-preserving uploader,
    # not the root-owned canonical P1.19 tar uploaded directly as github-pages.
    exact_uploader = "actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9"
    assert exact_uploader in owner
    assert "path: ${{ runner.temp }}/finalized-pages" in owner
    assert "include-hidden-files: true" in owner
    assert "name: Upload validated composed Pages artifact" in owner, "retain historical P1.15 owner marker"
    assert "path: ${{ runner.temp }}/artifact.tar" not in owner
    assert "name: github-pages\n          path: ${{ runner.temp }}/artifact.tar" not in owner

    assert "if: github.event_name == 'push' && github.ref == 'refs/heads/main'" in owner
    deploy_owners = []
    for path in sorted((ROOT / ".github/workflows").glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        if "uses: actions/deploy-pages@" in text:
            deploy_owners.append(path.relative_to(ROOT).as_posix())
    assert deploy_owners == [".github/workflows/verifier-distribution-surface-v0.1.yml"]

    lowered = owner.lower()
    for forbidden in (
        "producer_authenticated: true",
        "trusted_timestamp_established: true",
        "truth_established: true",
        "identity_established: true",
        "authority_established: true",
        "responsibility_established: true",
        "publication_or_action_authority_established: true",
    ):
        assert forbidden not in lowered, f"P1.20 gained forbidden semantic promotion: {forbidden}"

    print("P1.20 predecessor deployment failure evidence bound: PASS")
    print("P1.20 historical P1.19 canonical packager bytes preserved: PASS")
    print("P1.20 official Pages uploader is hidden-preserving and finalized-root bounded: PASS")
    print("P1.20 one deploy-pages owner and main-only deployment: PASS")
    print("Transport compatibility != payload semantics or authority: PASS")


if __name__ == "__main__":
    main()
