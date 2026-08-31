#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import tarfile
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


p1_16 = load(ROOT / "scripts/pages-composition-integrity/finalize_pages.py", "p1_16")
pack = load(HERE / "package_pages.py", "p1_19")


def write(root: Path, rel: str, data: bytes) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def make_p1_15(root: Path) -> None:
    write(root, ".nojekyll", b"")
    write(root, "index.html", b"root\n")
    write(root, "poai/index.html", b"poai\n")
    write(root, "verifier-start.html", b"verifier start\n")
    write(root, "verifier/index.html", b"verifier\n")
    write(root, "verifier/integrity-capsule/capsule-manifest.json", b"{}\n")
    receipt = {
        "schema": p1_16.P1_15_RECEIPT_SCHEMA,
        "allowed_source_collisions": ["index.html"],
        "composition": "synthetic_p1_19_test",
        "non_effects": {
            "authority_established": False,
            "identity_established": False,
            "publication_or_action_authority_established": False,
            "responsibility_established": False,
            "semantic_contracts_merged": False,
            "truth_established": False,
        },
        "poai_docs": {"file_count": 1, "tree_sha256": "0" * 64},
        "root_owner": "PoAI docs/index.html",
        "source_collisions": ["index.html"],
        "validated_verifier_site": {"file_count": 1, "tree_sha256": "1" * 64},
        "verifier_root_landing_relocated_to": "verifier-start.html",
    }
    write(root, "pages-composition-receipt.json", (json.dumps(receipt, sort_keys=True) + "\n").encode())


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except Exception:
        return
    raise AssertionError(f"expected reject: {label}")


def main() -> None:
    bindings = json.loads((HERE / "source-bindings.json").read_text(encoding="utf-8"))
    assert bindings["predecessor_main"] == "383a0809a1328c1f12da810216b45e6d5d91fa4d"
    assert bindings["observed_failed_packaging"]["missing_p1_16_path"] == ".nojekyll"

    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        p1_15_root = base / "p1-15"
        p1_15_root.mkdir()
        make_p1_15(p1_15_root)
        finalized = base / "finalized"
        envelope = p1_16.finalize_pages(p1_15_root, finalized)
        assert p1_16.verify_integrity_envelope(finalized) == envelope
        assert (finalized / ".nojekyll").is_file()

        artifact = base / "artifact.tar"
        receipt = pack.package_exact_tree(finalized, artifact)
        assert receipt["includes_nojekyll"] is True
        assert receipt["includes_p1_16_envelope"] is True
        assert receipt["packaged_file_count"] == envelope["payload_file_count"] + 1
        assert receipt["p1_16_payload_tree_sha256"] == envelope["payload_tree_sha256"]
        assert all(value is False for value in receipt["non_effects"].values())
        assert pack.verify_artifact_tar(artifact)["artifact_tar_sha256"] == hashlib.sha256(artifact.read_bytes()).hexdigest()

        with tarfile.open(artifact, "r:") as archive:
            names = archive.getnames()
        assert ".nojekyll" in names
        assert p1_16.ENVELOPE_NAME in names
        assert names == sorted(names)

        # Recreate the exact predecessor action's dotfile exclusion in a hostile archive.
        missing_dotfile = base / "artifact-missing-dotfile.tar"
        with tarfile.open(missing_dotfile, "w") as archive:
            for rel in pack.canonical_file_set(finalized):
                if rel.startswith("."):
                    continue
                archive.add(finalized / rel, arcname=rel, recursive=False)
        expect_reject(lambda: pack.verify_artifact_tar(missing_dotfile), "dotfile exclusion")

        # Same file set but a changed payload must fail historical P1.16 verification after extraction.
        mutated_root = base / "mutated"
        import shutil
        shutil.copytree(finalized, mutated_root)
        (mutated_root / "index.html").write_bytes(b"ROOT\n")
        mutated_tar = base / "mutated.tar"
        with tarfile.open(mutated_tar, "w") as archive:
            for rel in pack.canonical_file_set(mutated_root):
                archive.add(mutated_root / rel, arcname=rel, recursive=False)
        expect_reject(lambda: pack.verify_artifact_tar(mutated_tar), "payload mutation")

    print("P1.19 exact P1.16 tree -> artifact.tar round-trip: PASS")
    print("P1.19 .nojekyll retained in github-pages payload: PASS")
    print("P1.19 predecessor dotfile exclusion and payload mutation: REJECTED")
    print("P1.19 archive fidelity != semantic/publication authority: PASS")


if __name__ == "__main__":
    main()
