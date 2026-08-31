#!/usr/bin/env python3
"""P1.14 verifier Pages publication test, compatible with later repository-wide composition."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
P1_13 = REPO_ROOT / "scripts" / "verifier-disposition-integrity-capsule"
sys.path.insert(0, str(P1_13))
from build_capsule import verify_manifest  # noqa:E402


def run(*args: str) -> None:
    subprocess.run(args, cwd=REPO_ROOT, check=True)


def git_blob(path: str) -> str:
    return subprocess.check_output(["git", "hash-object", path], cwd=REPO_ROOT, text=True).strip()


def build_localized_site(site: Path) -> None:
    run(sys.executable, "scripts/verifier-distribution-surface/build_site.py", "--output", str(site))
    for script in [
        "scripts/verifier-interactive-surface/build_interactive_site.py",
        "scripts/verifier-evidence-adapter/build_adapter_site.py",
        "scripts/verifier-candidate-acceptance/build_acceptance_site.py",
        "scripts/verifier-contestability/build_contestability_site.py",
        "scripts/verifier-scoped-attestations/build_attestation_site.py",
        "scripts/verifier-candidate-federation/build_candidate_site.py",
        "scripts/verifier-federated-disposition/build_disposition_site.py",
        "scripts/verifier-disposition-integrity-surface/build_integrity_site.py",
    ]:
        run(sys.executable, script, "--site", str(site))

    reference = site / "verifier/index.html"
    expected_reference = (REPO_ROOT / "scripts/verifier-presentation-contract/reference.html").read_bytes()
    assert reference.read_bytes() == expected_reference, "immutable verifier reference drifted before localization"

    for script in [
        "scripts/verifier-policy-localization/build_policy_l10n.py",
        "scripts/verifier-contestability/localize_contestability.py",
        "scripts/verifier-scoped-attestations/localize_attestation.py",
        "scripts/verifier-candidate-federation/localize_candidates.py",
        "scripts/verifier-federated-disposition/localize_disposition.py",
        "scripts/verifier-disposition-integrity-surface/localize_integrity.py",
    ]:
        run(sys.executable, script, "--site", str(site))

    assert reference.read_bytes() == expected_reference, "immutable verifier reference drifted after localization"


def main() -> None:
    bindings = json.loads((HERE / "source-bindings.json").read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "6a35732a1f4c9a23a263c0f3fc16dc405467da0a"
    for key in ("p1_13_builder", "p1_13_test", "p1_13_workflow"):
        item = bindings[key]
        assert git_blob(item["path"]) == item["blob"], f"historical binding drift: {key}"

    distribution = REPO_ROOT / bindings["distribution_owner_predecessor"]["path"]
    workflow_text = distribution.read_text(encoding="utf-8")
    assert "python scripts/verifier-disposition-integrity-capsule/test.py" in workflow_text
    assert "python scripts/verifier-disposition-integrity-capsule/build_capsule.py --site" in workflow_text
    assert "verifier/integrity-capsule/capsule-manifest.json" in workflow_text
    assert "actions/deploy-pages@" in workflow_text

    # P1.14's semantic invariant is one verifier deployment owner. P1.15 later reconciles
    # the repository-wide PoAI/docs collision by retaining this owner as the only physical
    # deploy-pages workflow and making the old PoAI workflow validation-only.
    deployment_owners: list[str] = []
    for pattern in ("*.yml", "*.yaml"):
        for path in sorted((REPO_ROOT / ".github/workflows").glob(pattern)):
            text = path.read_text(encoding="utf-8")
            if "actions/deploy-pages@" in text:
                deployment_owners.append(path.name)
    assert deployment_owners == ["verifier-distribution-surface-v0.1.yml"], (
        f"unexpected repository Pages deployment-owner set: {deployment_owners}"
    )
    poai_workflow = (REPO_ROOT / ".github/workflows/poai-pages.yml").read_text(encoding="utf-8")
    assert "actions/deploy-pages@" not in poai_workflow, "PoAI validation workflow must not deploy independently"
    assert "python scripts/pages-composition/compose_pages.py" in workflow_text, (
        "physical verifier owner must compose PoAI docs before deployment"
    )
    p1_14_workflow = (REPO_ROOT / ".github/workflows/verifier-integrity-capsule-pages-v0.1.yml").read_text(encoding="utf-8")
    assert "actions/deploy-pages@" not in p1_14_workflow, "P1.14 must not create a second verifier deploy owner"

    with tempfile.TemporaryDirectory(prefix="uuaap-p1-14-") as tmp:
        site = Path(tmp) / "pages"
        build_localized_site(site)
        run(sys.executable, "scripts/verifier-disposition-integrity-capsule/build_capsule.py", "--site", str(site))

        capsule = site / "verifier/integrity-capsule"
        manifest = verify_manifest(capsule)
        assert (capsule / "capsule-manifest.json").is_file()
        assert (capsule / "index.html").is_file()
        assert manifest["source_surface"] == "UU-AAP/P1.12"
        assert manifest["verification_core"] == "UU-AAP/P1.11"
        assert manifest["non_effects"]["producer_authenticated"] is False
        assert manifest["non_effects"]["truth_established"] is False
        assert manifest["non_effects"]["authority_established"] is False
        assert manifest["non_effects"]["publication_or_action_authority_established"] is False

        root = (site / "index.html").read_text(encoding="utf-8")
        assert 'href="verifier/integrity-capsule/"' in root, "verifier-only build root missing portable capsule link"
        assert (site / "verifier/index.html").read_bytes() == (
            REPO_ROOT / "scripts/verifier-presentation-contract/reference.html"
        ).read_bytes()

    print("P1.14 historical P1.13 bindings: PASS")
    print("P1.14 verifier artifact still built and validated independently: PASS")
    print("repository-wide physical Pages deployment owner reconciled to verifier distribution workflow: PASS")
    print("P1.14 capsule present in validated verifier artifact: PASS")
    print("public capsule != producer authentication/truth/authority/action permission: PASS")


if __name__ == "__main__":
    main()
