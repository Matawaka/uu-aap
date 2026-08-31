#!/usr/bin/env python3
"""Adversarial tests for P1.16 relocatable unified Pages integrity envelope."""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from finalize_pages import (  # noqa:E402
    ENVELOPE_NAME,
    ENVELOPE_SCHEMA,
    PREDECESSOR_MAIN,
    SOURCE_BINDINGS,
    finalize_pages,
    verify_integrity_envelope,
)


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except (AssertionError, OSError, ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def fixture(root: Path) -> Path:
    pages = root / "p1-15"
    (pages / "poai").mkdir(parents=True)
    (pages / "verifier" / "integrity-capsule").mkdir(parents=True)
    (pages / ".nojekyll").write_bytes(b"")
    (pages / "index.html").write_bytes(b"<html>PoAI root</html>\n")
    (pages / "poai" / "index.html").write_bytes(b"<html>PoAI</html>\n")
    (pages / "verifier-start.html").write_bytes(b"<html>Verifier start</html>\n")
    (pages / "verifier" / "index.html").write_bytes(b"<html>Verifier</html>\n")
    (pages / "verifier" / "integrity-capsule" / "capsule-manifest.json").write_text(
        json.dumps({"schema": "synthetic-capsule"}) + "\n",
        encoding="utf-8",
    )
    receipt = {
        "schema": "urn:uu-aap:pages-composition-receipt:0.1",
        "composition": "poai_docs_root_plus_validated_verifier_tree",
        "root_owner": "PoAI docs/index.html",
        "verifier_root_landing_relocated_to": "verifier-start.html",
        "source_collisions": ["index.html"],
        "allowed_source_collisions": ["index.html"],
        "poai_docs": {"file_count": 2, "tree_sha256": "0" * 64},
        "validated_verifier_site": {"file_count": 4, "tree_sha256": "1" * 64},
        "non_effects": {
            "semantic_contracts_merged": False,
            "truth_established": False,
            "identity_established": False,
            "authority_established": False,
            "responsibility_established": False,
            "publication_or_action_authority_established": False,
        },
    }
    (pages / "pages-composition-receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n",
        encoding="utf-8",
    )
    return pages


def clone(source: Path, target: Path) -> Path:
    shutil.copytree(source, target)
    return target


def mutate_envelope(root: Path, mutate) -> None:
    path = root / ENVELOPE_NAME
    value = json.loads(path.read_text(encoding="utf-8"))
    mutate(value)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    bindings = json.loads((HERE / "source-bindings.json").read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == PREDECESSOR_MAIN
    assert bindings["p1_15_compose_pages"]["blob"] == SOURCE_BINDINGS["p1_15_compose_pages"]["blob"]
    assert bindings["p1_15_adversarial_test"]["blob"] == SOURCE_BINDINGS["p1_15_adversarial_test"]["blob"]
    assert bindings["p1_15_workflow"]["blob"] == SOURCE_BINDINGS["p1_15_workflow"]["blob"]
    assert bindings["p1_15_physical_pages_owner"]["blob"] == SOURCE_BINDINGS["p1_15_physical_pages_owner"]["blob"]

    with tempfile.TemporaryDirectory(prefix="uuaap-p1-16-") as tmp:
        root = Path(tmp)
        source = fixture(root)
        final_a = root / "final-a"
        final_b = root / "final-b"
        envelope_a = finalize_pages(source, final_a)
        envelope_b = finalize_pages(source, final_b)
        assert envelope_a == envelope_b, "identical P1.15 bytes must produce identical P1.16 envelope semantics"
        assert (final_a / ENVELOPE_NAME).read_bytes() == (final_b / ENVELOPE_NAME).read_bytes(), (
            "P1.16 envelope bytes must be deterministic"
        )
        assert envelope_a["schema"] == ENVELOPE_SCHEMA
        assert envelope_a["predecessor_main"] == PREDECESSOR_MAIN
        assert envelope_a["source_bindings"] == SOURCE_BINDINGS
        assert all(value is False for value in envelope_a["non_effects"].values())

        for path in source.rglob("*"):
            if path.is_file():
                relative = path.relative_to(source)
                assert (final_a / relative).read_bytes() == path.read_bytes(), f"P1.15 payload changed: {relative}"

        relocated = clone(final_a, root / "relocated-independent-root")
        shutil.rmtree(source)
        shutil.rmtree(final_b)
        assert verify_integrity_envelope(relocated) == envelope_a, (
            "relocated verification must not require the original P1.15 source root"
        )

        tampered_payload = clone(relocated, root / "tampered-payload")
        (tampered_payload / "verifier/index.html").write_bytes(b"tampered\n")
        expect_reject(lambda: verify_integrity_envelope(tampered_payload), "payload byte drift")

        deleted_payload = clone(relocated, root / "deleted-payload")
        (deleted_payload / "poai/index.html").unlink()
        expect_reject(lambda: verify_integrity_envelope(deleted_payload), "payload deletion")

        extra_payload = clone(relocated, root / "extra-payload")
        (extra_payload / "unexpected.txt").write_text("unexpected", encoding="utf-8")
        expect_reject(lambda: verify_integrity_envelope(extra_payload), "payload addition")

        receipt_drift = clone(relocated, root / "receipt-drift")
        receipt_path = receipt_drift / "pages-composition-receipt.json"
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        receipt["root_owner"] = "mutated"
        receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        expect_reject(lambda: verify_integrity_envelope(receipt_drift), "embedded P1.15 receipt drift")

        manifest_digest = clone(relocated, root / "manifest-digest")
        mutate_envelope(manifest_digest, lambda value: value.__setitem__("payload_tree_sha256", "f" * 64))
        expect_reject(lambda: verify_integrity_envelope(manifest_digest), "envelope tree digest drift")

        manifest_count = clone(relocated, root / "manifest-count")
        mutate_envelope(manifest_count, lambda value: value.__setitem__("payload_file_count", value["payload_file_count"] + 1))
        expect_reject(lambda: verify_integrity_envelope(manifest_count), "envelope file-count drift")

        manifest_path = clone(relocated, root / "manifest-path")
        def drift_path(value: dict) -> None:
            value["files"][0]["path"] = "renamed.bin"
        mutate_envelope(manifest_path, drift_path)
        expect_reject(lambda: verify_integrity_envelope(manifest_path), "envelope path drift")

        manifest_order = clone(relocated, root / "manifest-order")
        def reverse_files(value: dict) -> None:
            value["files"] = list(reversed(value["files"]))
        mutate_envelope(manifest_order, reverse_files)
        expect_reject(lambda: verify_integrity_envelope(manifest_order), "envelope order drift")

        binding_drift = clone(relocated, root / "binding-drift")
        def mutate_binding(value: dict) -> None:
            value["source_bindings"]["p1_15_compose_pages"]["blob"] = "0" * 40
        mutate_envelope(binding_drift, mutate_binding)
        expect_reject(lambda: verify_integrity_envelope(binding_drift), "historical source-binding drift")

        if hasattr(Path, "symlink_to"):
            symlinked = clone(relocated, root / "symlinked")
            target = symlinked / "poai/index.html"
            target.unlink()
            try:
                target.symlink_to(symlinked / "index.html")
            except OSError:
                pass
            else:
                expect_reject(lambda: verify_integrity_envelope(symlinked), "symlink substitution")

    print("P1.16 deterministic envelope bytes: PASS")
    print("P1.16 relocated verification without source root: PASS")
    print("P1.16 payload mutation/deletion/addition rejection: PASS")
    print("P1.16 embedded P1.15 receipt binding: PASS")
    print("P1.16 envelope digest/count/path/order/source-binding drift rejection: PASS")
    print("Relocated byte integrity != producer authentication/truth/authority/action authority: PASS")


if __name__ == "__main__":
    main()
