#!/usr/bin/env python3
"""Adversarial tests for one physical Pages artifact containing PoAI docs + verifier."""
from __future__ import annotations

import json
import sys
import tempfile
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compose_pages import compose_pages, verify_composed_artifact  # noqa:E402


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except (AssertionError, OSError, ValueError, json.JSONDecodeError):
        return
    raise AssertionError(f"mutation unexpectedly accepted: {label}")


def fixture(root: Path) -> tuple[Path, Path]:
    docs = root / "docs"
    verifier = root / "verifier-site"
    (docs / "poai").mkdir(parents=True)
    (verifier / "verifier" / "integrity-capsule").mkdir(parents=True)
    (docs / "index.html").write_bytes(b"<html>PoAI root</html>\n")
    (docs / "poai" / "index.html").write_bytes(b"<html>PoAI tool</html>\n")
    (docs / "poai" / "app.js").write_bytes(b"console.log('poai');\n")
    (verifier / "index.html").write_bytes(
        b'<html><a href="verifier/">Verifier</a><a href="verifier/integrity-capsule/">Capsule</a></html>\n'
    )
    (verifier / ".nojekyll").write_bytes(b"")
    (verifier / "verifier" / "index.html").write_bytes(b"<html>immutable verifier</html>\n")
    (verifier / "verifier" / "presentation.json").write_bytes(b'{"schema":"test"}\n')
    (verifier / "verifier" / "integrity-capsule" / "index.html").write_bytes(b"<html>capsule</html>\n")
    return docs, verifier


def main() -> None:
    bindings = json.loads((HERE / "source-bindings.json").read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "5c4a1b3ecc3b3a766c7224912e21944c4509a17c"
    assert bindings["historical_verifier_pages_workflow"]["blob"] == "a4dc13eb03095ad77183cf277d9e606dd364cd19"
    assert bindings["historical_poai_pages_workflow"]["blob"] == "707e38e392d965f893166fd94ab817edb994918b"
    assert bindings["poai_root_index"]["blob"] == "0a0d47c17c1c666f6f32f1e569097248c160662d"
    assert bindings["verifier_root_builder"]["blob"] == "4a1a8cc9d14859541c5b4a94680ccac2b21a7f63"

    with tempfile.TemporaryDirectory(prefix="uuaap-pages-composition-") as tmp:
        root = Path(tmp)
        docs, verifier = fixture(root)
        output = root / "output"
        receipt = compose_pages(docs, verifier, output)
        assert verify_composed_artifact(docs, verifier, output) == receipt
        assert (output / "index.html").read_bytes() == (docs / "index.html").read_bytes()
        assert (output / "poai/index.html").read_bytes() == (docs / "poai/index.html").read_bytes()
        assert (output / "verifier/index.html").read_bytes() == (verifier / "verifier/index.html").read_bytes()
        assert (output / "verifier-start.html").read_bytes() == (verifier / "index.html").read_bytes()
        assert receipt["source_collisions"] == ["index.html"]
        assert receipt["root_owner"] == "PoAI docs/index.html"
        assert all(value is False for value in receipt["non_effects"].values())

        tampered_verifier = root / "tampered-verifier"
        compose_pages(docs, verifier, tampered_verifier)
        (tampered_verifier / "verifier/presentation.json").write_bytes(b"tampered\n")
        expect_reject(
            lambda: verify_composed_artifact(docs, verifier, tampered_verifier),
            "verifier bytes changed after composition",
        )

        tampered_docs = root / "tampered-docs"
        compose_pages(docs, verifier, tampered_docs)
        (tampered_docs / "poai/app.js").write_bytes(b"tampered\n")
        expect_reject(
            lambda: verify_composed_artifact(docs, verifier, tampered_docs),
            "PoAI docs bytes changed after composition",
        )

        unexpected = root / "unexpected"
        compose_pages(docs, verifier, unexpected)
        (unexpected / "foreign.txt").write_text("unexpected", encoding="utf-8")
        expect_reject(
            lambda: verify_composed_artifact(docs, verifier, unexpected),
            "unexpected output path",
        )

        reserved_docs = root / "reserved-docs"
        reserved_docs.mkdir()
        for source in docs.rglob("*"):
            relative = source.relative_to(docs)
            target = reserved_docs / relative
            if source.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            elif source.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
        (reserved_docs / "verifier").mkdir()
        (reserved_docs / "verifier" / "unowned.html").write_text("collision", encoding="utf-8")
        expect_reject(
            lambda: compose_pages(reserved_docs, verifier, root / "reserved-output"),
            "docs occupies verifier URL tree",
        )

        second_collision_docs = root / "second-collision-docs"
        second_collision_docs.mkdir()
        for source in docs.rglob("*"):
            relative = source.relative_to(docs)
            target = second_collision_docs / relative
            if source.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            elif source.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
        (second_collision_docs / ".nojekyll").write_bytes(b"")
        expect_reject(
            lambda: compose_pages(second_collision_docs, verifier, root / "collision-output"),
            "unexpected second root collision",
        )

        verifier_extra = root / "verifier-extra"
        verifier_extra.mkdir()
        for source in verifier.rglob("*"):
            relative = source.relative_to(verifier)
            target = verifier_extra / relative
            if source.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            elif source.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
        (verifier_extra / "other-root.txt").write_text("unowned", encoding="utf-8")
        expect_reject(
            lambda: compose_pages(docs, verifier_extra, root / "extra-root-output"),
            "verifier introduced unowned top-level path",
        )

    print("P1.15 exactly one intentional source collision (root index): PASS")
    print("P1.15 PoAI docs bytes preserved at historical paths: PASS")
    print("P1.15 verifier tree bytes preserved at /verifier/: PASS")
    print("P1.15 former verifier root landing preserved at /verifier-start.html: PASS")
    print("P1.15 tamper and unowned-path rejection: PASS")
    print("Pages composition != semantic merge or publication/action authority: PASS")


if __name__ == "__main__":
    main()
