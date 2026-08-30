#!/usr/bin/env python3
"""P1.6 policy/localization boundary tests over the full P1.2-P1.5 Pages stack."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
MESSAGES = HERE / "messages.json"
RUNTIME = HERE / "runtime.js"
BROWSER_TEST = HERE / "test-browser.js"
BINDINGS = HERE / "policy-bindings.json"
BUILDER = HERE / "build_policy_l10n.py"
DIMENSIONS = ["integrity", "identity", "provenance", "availability", "authority", "responsibility", "truth"]


def run(*args: str) -> None:
    subprocess.run([sys.executable, *args], cwd=REPO_ROOT, check=True)


def main() -> None:
    catalog = json.loads(MESSAGES.read_text(encoding="utf-8"))
    assert set(catalog) == {"en", "ru"}
    assert set(catalog["en"]) == set(catalog["ru"])
    assert len(catalog["en"]) >= 50, "localization surface unexpectedly small"

    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    predecessor = bindings["repository_predecessor_main"]
    assert isinstance(predecessor, str) and len(predecessor) == 40
    subprocess.run(["git", "merge-base", "--is-ancestor", predecessor, "HEAD"], cwd=REPO_ROOT, check=True)
    for path, metadata in bindings["sources"].items():
        actual = subprocess.check_output(["git", "hash-object", path], cwd=REPO_ROOT, text=True).strip()
        assert actual == metadata["git_blob_sha"], f"policy source changed: {path}"

    runtime_source = RUNTIME.read_text(encoding="utf-8")
    for forbidden in (
        "fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
        "localStorage", "sessionStorage", "document.cookie", "eval(", "Function(",
        "http://", "https://",
    ):
        assert forbidden not in runtime_source, f"P1.6 runtime boundary violated by {forbidden}"
    assert 'querySelectorAll("[data-i18n]")' in runtime_source
    assert 'querySelectorAll("[data-locale]")' in runtime_source
    assert "documentElement.lang" in runtime_source
    assert "textContent" in runtime_source

    with tempfile.TemporaryDirectory() as temp_dir:
        site = Path(temp_dir) / "site"
        run("scripts/verifier-distribution-surface/build_site.py", "--output", str(site))
        reference_before = (site / "verifier/index.html").read_bytes()
        run("scripts/verifier-interactive-surface/build_interactive_site.py", "--site", str(site))
        run("scripts/verifier-evidence-adapter/build_adapter_site.py", "--site", str(site))
        run("scripts/verifier-candidate-acceptance/build_acceptance_site.py", "--site", str(site))
        assert (site / "verifier/index.html").read_bytes() == reference_before

        json_before = {path.relative_to(site).as_posix(): path.read_bytes() for path in site.rglob("*.json")}
        presentation_before = json.loads((site / "verifier/presentation.json").read_text(encoding="utf-8"))
        assert presentation_before["dimension_order"] == DIMENSIONS

        run(str(BUILDER.relative_to(REPO_ROOT)), "--site", str(site))

        assert (site / "verifier/index.html").read_bytes() == reference_before, "immutable P1.1 reference changed"
        for relative, before in json_before.items():
            assert (site / relative).read_bytes() == before, f"P1.6 rewrote existing JSON: {relative}"

        for relative in ("index.html", "verifier/interactive/index.html", "verifier/adapt/index.html", "verifier/accept/index.html"):
            text = (site / relative).read_text(encoding="utf-8")
            assert "data-l10n-controls" in text, relative
            assert text.count("data-locale=") == 2, relative
            assert "data-i18n=" in text, relative
            assert "policy/" in text, relative

        reference = (site / "verifier/index.html").read_text(encoding="utf-8")
        assert "data-l10n-controls" not in reference
        assert "l10n.js" not in reference
        for dimension in DIMENSIONS:
            assert f'data-dimension="{dimension}"' in reference

        policy = (site / "verifier/policy/index.html").read_text(encoding="utf-8")
        assert "SECURITY.md" in policy
        assert "CONTRIBUTING.md" in policy
        assert "CODE_OF_CONDUCT.md" in policy
        assert "data-i18n=\"policy.heading\"" in policy
        assert "WCAG compliant" not in policy
        assert "http://" not in policy and "https://" not in policy

        compiled = site / "verifier/assets/l10n.js"
        assert compiled.is_file()
        assert "__UUAAP_L10N_CATALOG__" not in compiled.read_text(encoding="utf-8")
        assert (site / "verifier/assets/messages.json").is_file()
        subprocess.run(["node", str(BROWSER_TEST), str(compiled)], cwd=REPO_ROOT, check=True)

        assert (site / "verifier/interactive/example.json").read_bytes() == json_before["verifier/interactive/example.json"]
        assert (site / "verifier/adapt/example-result.json").read_bytes() == json_before["verifier/adapt/example-result.json"]
        assert (site / "verifier/accept/materialized-input.json").read_bytes() == json_before["verifier/accept/materialized-input.json"]

    print("P1.6 EN/RU catalog parity: PASS")
    print("localized static shell != localized protocol semantics")
    print("all pre-existing verifier JSON -> byte-identical")
    print("immutable P1.1 reference -> byte-identical")
    print("policy sources -> exact Git-blob bound")


if __name__ == "__main__":
    main()
