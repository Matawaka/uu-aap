#!/usr/bin/env python3
"""P1.12 distribution-only surface tests over historical P1.11 integrity semantics."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
PACKAGE_SRC = REPO_ROOT / "packages" / "uuaap-verifier-presentation" / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from uuaap_verifier_presentation import (  # noqa:E402
    validate_disposition_integrity_input,
    validate_disposition_integrity_result,
    verify_disposition_integrity,
)

BINDINGS = HERE / "source-bindings.json"
P1_11_APP = REPO_ROOT / "scripts" / "verifier-disposition-integrity" / "app.js"


def run(*args: str) -> None:
    subprocess.run(args, cwd=REPO_ROOT, check=True)


def main() -> None:
    bindings = json.loads(BINDINGS.read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "9d9f4f07b1b2c7352cbda8a8851cbc5ff45267f7"
    assert bindings["p1_11_python"]["blob"] == "2b5b312486841b4ab3463bc8ef9afc2ef94e200c"
    assert bindings["p1_11_browser"]["blob"] == "34bed235823e80c391f3130ea17b4af42a54a364"

    with tempfile.TemporaryDirectory() as tmp:
        site = Path(tmp) / "site"
        run("python", "scripts/verifier-distribution-surface/build_site.py", "--output", str(site))
        reference_before = (site / "verifier/index.html").read_bytes()
        run("python", "scripts/verifier-interactive-surface/build_interactive_site.py", "--site", str(site))
        run("python", "scripts/verifier-evidence-adapter/build_adapter_site.py", "--site", str(site))
        run("python", "scripts/verifier-candidate-acceptance/build_acceptance_site.py", "--site", str(site))
        run("python", "scripts/verifier-contestability/build_contestability_site.py", "--site", str(site))
        run("python", "scripts/verifier-scoped-attestations/build_attestation_site.py", "--site", str(site))
        run("python", "scripts/verifier-candidate-federation/build_candidate_site.py", "--site", str(site))
        run("python", "scripts/verifier-federated-disposition/build_disposition_site.py", "--site", str(site))
        run("python", str(HERE / "build_integrity_site.py"), "--site", str(site))

        integrity = site / "verifier/integrity"
        assert (integrity / "index.html").is_file()
        assert (integrity / "core.js").read_bytes() == P1_11_APP.read_bytes(), "deployed P1.11 browser core changed"
        assert (site / "verifier/index.html").read_bytes() == reference_before, "immutable reference changed"

        record = json.loads((integrity / "example.json").read_text(encoding="utf-8"))
        result = json.loads((integrity / "example-result.json").read_text(encoding="utf-8"))
        validate_disposition_integrity_input(record)
        validate_disposition_integrity_result(result)
        assert verify_disposition_integrity(record) == result
        assert result["canonical_rematerialization_equal"] is True
        assert result["p1_3_materialized_input_valid"] is True
        assert result["aggregate_score_present"] is False
        assert result["aggregate_verdict_present"] is False

        page = (integrity / "index.html").read_text(encoding="utf-8")
        for local_dep in (
            "../interactive/app.js", "../adapt/app.js", "../attest/app.js",
            "../candidates/app.js", "../disposition/app.js", "core.js", "ui.js",
        ):
            assert local_dep in page, f"missing local dependency {local_dep}"
        assert "http://" not in page.lower() and "https://" not in page.lower()
        ui = (integrity / "ui.js").read_text(encoding="utf-8")
        for forbidden in ("fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "eval(", "innerHTML"):
            assert forbidden not in ui, f"forbidden P1.12 UI primitive: {forbidden}"
        assert "UUAAPDispositionIntegrity" in ui and "verifyDispositionIntegrity" in ui

        input_before = (integrity / "example.json").read_bytes()
        result_before = (integrity / "example-result.json").read_bytes()
        core_before = (integrity / "core.js").read_bytes()
        run("python", "scripts/verifier-policy-localization/build_policy_l10n.py", "--site", str(site))
        run("python", "scripts/verifier-contestability/localize_contestability.py", "--site", str(site))
        run("python", "scripts/verifier-scoped-attestations/localize_attestation.py", "--site", str(site))
        run("python", "scripts/verifier-candidate-federation/localize_candidates.py", "--site", str(site))
        run("python", "scripts/verifier-federated-disposition/localize_disposition.py", "--site", str(site))
        run("python", str(HERE / "localize_integrity.py"), "--site", str(site))

        assert (integrity / "example.json").read_bytes() == input_before
        assert (integrity / "example-result.json").read_bytes() == result_before
        assert (integrity / "core.js").read_bytes() == core_before
        assert (site / "verifier/index.html").read_bytes() == reference_before
        localized = (integrity / "index.html").read_text(encoding="utf-8")
        assert 'data-locale="ru"' in localized
        assert 'data-i18n="integrity.heading"' in localized
        assert 'data-i18n="root.integrity_link"' in (site / "index.html").read_text(encoding="utf-8")
        messages = json.loads((site / "verifier/assets/messages.json").read_text(encoding="utf-8"))
        assert set(messages["en"]) == set(messages["ru"])
        assert "integrity.semantic" in messages["en"]

    print("P1.11 browser core deployed byte-identically: PASS")
    print("P1.11 canonical input/result exposed without semantic rewrite: PASS")
    print("P1.12 localization changes shell only: PASS")
    print("P1.12 local-only browser surface: PASS")
    print("integrity surface != publication/action authority: PASS")


if __name__ == "__main__":
    main()
