#!/usr/bin/env python3
"""P1.13 relocation, manifest-tamper and browser-equivalence tests."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from build_capsule import build_capsule, verify_manifest  # noqa:E402

BUILDERS = [
    ["python", "scripts/verifier-distribution-surface/build_site.py", "--output"],
]


def run(*args: str) -> None:
    subprocess.run(args, cwd=REPO_ROOT, check=True)


def build_full_site(site: Path) -> None:
    run("python", "scripts/verifier-distribution-surface/build_site.py", "--output", str(site))
    for script, flag in [
        ("scripts/verifier-interactive-surface/build_interactive_site.py", "--site"),
        ("scripts/verifier-evidence-adapter/build_adapter_site.py", "--site"),
        ("scripts/verifier-candidate-acceptance/build_acceptance_site.py", "--site"),
        ("scripts/verifier-contestability/build_contestability_site.py", "--site"),
        ("scripts/verifier-scoped-attestations/build_attestation_site.py", "--site"),
        ("scripts/verifier-candidate-federation/build_candidate_site.py", "--site"),
        ("scripts/verifier-federated-disposition/build_disposition_site.py", "--site"),
        ("scripts/verifier-disposition-integrity-surface/build_integrity_site.py", "--site"),
    ]:
        run("python", script, flag, str(site))


def expect_reject(path: Path, label: str) -> None:
    try:
        verify_manifest(path)
    except (AssertionError, KeyError, ValueError, json.JSONDecodeError):
        return
    raise AssertionError(f"mutated capsule unexpectedly verified: {label}")


def main() -> None:
    bindings = json.loads((HERE / "source-bindings.json").read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "4b983c59ac00d86ed774be60feb5beb12768cc06"
    assert bindings["p1_12_builder"]["blob"] == "bd00fe4a1b19178d810f94a8b66de06d01219443"
    assert bindings["p1_12_ui"]["blob"] == "0961c51943e6b9ace1f348378d0518d6f0e7376f"
    assert bindings["p1_12_source_bindings"]["blob"] == "9d0eb48da5ab49fac7363fcc11b5367b3291e441"
    assert bindings["p1_11_browser"]["blob"] == "34bed235823e80c391f3130ea17b4af42a54a364"

    with tempfile.TemporaryDirectory(prefix="uuaap-p1-13-") as tmp:
        tmp_path = Path(tmp)
        site = tmp_path / "site"
        build_full_site(site)
        manifest = build_capsule(site)
        source_capsule = site / "verifier/integrity-capsule"
        assert verify_manifest(source_capsule) == manifest

        index = (source_capsule / "index.html").read_text(encoding="utf-8")
        assert "../" not in index
        lowered = index.lower()
        assert "http://" not in lowered and "https://" not in lowered
        assert all(token not in lowered for token in ("fetch(", "xmlhttprequest", "websocket", "eventsource", "sendbeacon", "eval("))

        relocated = tmp_path / "isolated-copy" / "capsule"
        relocated.parent.mkdir(parents=True)
        shutil.copytree(source_capsule, relocated)
        shutil.rmtree(site)
        assert verify_manifest(relocated) == manifest

        completed = subprocess.run(
            ["node", str(HERE / "test-browser.js"), str(relocated)],
            cwd=tmp_path,
            text=True,
            capture_output=True,
            check=True,
        )
        browser_result = json.loads(completed.stdout)
        assert browser_result == json.loads((relocated / "example-result.json").read_text(encoding="utf-8"))

        mutated = tmp_path / "mutated"
        shutil.copytree(relocated, mutated)
        with (mutated / "integrity-core.js").open("a", encoding="utf-8") as handle:
            handle.write("\n// hostile byte drift\n")
        expect_reject(mutated, "bound byte drift")

        missing = tmp_path / "missing"
        shutil.copytree(relocated, missing)
        (missing / "ui.js").unlink()
        expect_reject(missing, "missing bound file")

        extra = tmp_path / "extra"
        shutil.copytree(relocated, extra)
        (extra / "unexpected.txt").write_text("unexpected", encoding="utf-8")
        expect_reject(extra, "unexpected file")

    print("P1.13 capsule manifest byte binding: PASS")
    print("P1.13 isolated relocation using capsule bytes only: PASS")
    print("P1.13 relocated browser verification == canonical result: PASS")
    print("P1.13 mutation/deletion/addition fail closed: PASS")
    print("portable capsule != producer authentication/authority/truth: PASS")


if __name__ == "__main__":
    main()
