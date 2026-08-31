#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BINDINGS = HERE / "source-bindings.json"
WORKFLOW = ROOT / ".github/workflows/verifier-pages-post-deploy-observability-v0.1.yml"


def git_blob_sha(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "eb269e088a9e0080160c157e0983188dc745067a"
    for key in (
        "p1_16_finalizer",
        "p1_17_distribution_test",
        "p1_17_distribution_workflow",
        "p1_17_physical_pages_owner",
    ):
        item = bindings[key]
        assert git_blob_sha(ROOT / item["path"]) == item["blob"], f"historical binding drift: {key}"

    observed = bindings["observed_predecessor_deployment"]
    assert observed["workflow_run_id"] == "33351714167"
    assert observed["artifact_id"] == "9743838315"
    assert observed["artifact_digest"].startswith("sha256:")
    assert observed["pages_url"] == "https://matawaka.github.io/uu-aap/"

    workflow = WORKFLOW.read_text(encoding="utf-8")
    assert "workflow_run:" in workflow
    assert "P1.2 Verifier Distribution Surface v0.1" in workflow
    assert "github.event.workflow_run.conclusion == 'success'" in workflow
    assert "github.event.workflow_run.event == 'push'" in workflow
    assert "github.event.workflow_run.head_branch == 'main'" in workflow
    assert "actions/download-artifact@v4" in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert "scripts/pages-composition-integrity/finalize_pages.py" in workflow
    assert "scripts/pages-post-deploy-observability/verify_deployed.py" in workflow
    assert "https://matawaka.github.io/uu-aap/" in workflow

    lowered = workflow.lower()
    for forbidden in (
        "pages: write",
        "id-token: write",
        "actions/deploy-pages@",
        "actions/upload-pages-artifact@",
        "gh pr ",
        "gh issue ",
        "git push",
        "git tag",
        "create release",
    ):
        assert forbidden not in lowered, f"observer workflow gained forbidden mutation/deploy surface: {forbidden}"

    deploy_owners = []
    for path in sorted((ROOT / ".github/workflows").glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        if "uses: actions/deploy-pages@" in text:
            deploy_owners.append(path.relative_to(ROOT).as_posix())
    assert deploy_owners == [".github/workflows/verifier-distribution-surface-v0.1.yml"]

    observer = (HERE / "verify_deployed.py").read_text(encoding="utf-8").lower()
    for forbidden in (
        "subprocess",
        "os.system",
        "git push",
        "requests.post",
        "urlopen(request, data=",
        "method=\"post\"",
        "method='post'",
    ):
        assert forbidden not in observer, f"observer implementation gained mutation primitive: {forbidden}"

    print("P1.18 historical P1.16/P1.17 bindings: PASS")
    print("P1.18 workflow_run is main-push-success bounded and read-only: PASS")
    print("P1.18 exactly one physical deploy-pages owner remains: PASS")


if __name__ == "__main__":
    main()
