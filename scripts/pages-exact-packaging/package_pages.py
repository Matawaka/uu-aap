#!/usr/bin/env python3
"""P1.19 package the exact P1.16-finalized tree into the github-pages artifact.tar."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
P1_16_PATH = REPO_ROOT / "scripts/pages-composition-integrity/finalize_pages.py"
ENVELOPE_NAME = "pages-integrity-envelope.json"
PACKAGE_RECEIPT_SCHEMA = "urn:uu-aap:exact-finalized-pages-packaging-receipt:0.1"


def _load_p1_16():
    spec = importlib.util.spec_from_file_location("uuaap_p1_16_finalizer", P1_16_PATH)
    assert spec and spec.loader, "unable to load historical P1.16 finalizer"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


P1_16 = _load_p1_16()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_file_set(root: Path) -> list[str]:
    assert root.is_dir(), "P1.16 finalized root is required"
    paths: list[str] = []
    for path in root.rglob("*"):
        assert not path.is_symlink(), f"symlink forbidden in exact Pages package: {path}"
        if path.is_file():
            rel = path.relative_to(root).as_posix()
            pure = PurePosixPath(rel)
            assert not pure.is_absolute() and ".." not in pure.parts, f"unsafe package path: {rel}"
            paths.append(rel)
    paths.sort()
    assert len(paths) == len(set(paths)), "duplicate finalized payload path"
    return paths


def _normalized_tarinfo(source: Path, arcname: str) -> tarfile.TarInfo:
    info = tarfile.TarInfo(arcname)
    stat = source.stat()
    info.size = stat.st_size
    info.mode = stat.st_mode & 0o777
    info.mtime = 0
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    info.type = tarfile.REGTYPE
    return info


def package_exact_tree(finalized_root: str | Path, artifact_tar: str | Path) -> dict[str, Any]:
    root = Path(finalized_root)
    tar_path = Path(artifact_tar)
    envelope = P1_16.verify_integrity_envelope(root)
    paths = canonical_file_set(root)
    declared = sorted([item["path"] for item in envelope["files"]] + [ENVELOPE_NAME])
    assert paths == declared, "P1.19 package source must equal P1.16 envelope payload + envelope"
    assert ".nojekyll" in paths, "P1.19 must preserve P1.16 .nojekyll payload"
    assert not any(path == ".git" or path.startswith(".git/") for path in paths), ".git forbidden"
    assert not any(path == ".github" or path.startswith(".github/") for path in paths), ".github forbidden"

    tar_path.parent.mkdir(parents=True, exist_ok=True)
    assert not tar_path.exists(), "artifact.tar must not already exist"
    with tarfile.open(tar_path, "w", format=tarfile.PAX_FORMAT) as archive:
        for rel in paths:
            source = root / Path(*PurePosixPath(rel).parts)
            info = _normalized_tarinfo(source, rel)
            with source.open("rb") as handle:
                archive.addfile(info, handle)

    receipt = verify_artifact_tar(tar_path, expected_root=root)
    return receipt


def verify_artifact_tar(artifact_tar: str | Path, *, expected_root: str | Path | None = None) -> dict[str, Any]:
    tar_path = Path(artifact_tar)
    assert tar_path.is_file() and not tar_path.is_symlink(), "artifact.tar missing"
    with tarfile.open(tar_path, "r:") as archive:
        members = archive.getmembers()
        assert members, "artifact.tar must not be empty"
        member_paths: list[str] = []
        for member in members:
            assert member.isfile(), f"only regular file members permitted: {member.name}"
            pure = PurePosixPath(member.name)
            assert not pure.is_absolute() and ".." not in pure.parts, f"unsafe tar member: {member.name}"
            canonical = pure.as_posix()
            assert canonical == member.name, f"non-canonical tar member: {member.name}"
            member_paths.append(canonical)
        assert member_paths == sorted(member_paths), "artifact.tar member order must be canonical"
        assert len(member_paths) == len(set(member_paths)), "duplicate artifact.tar member"
        assert ".nojekyll" in member_paths, "artifact.tar lost .nojekyll"
        assert ENVELOPE_NAME in member_paths, "artifact.tar lost P1.16 envelope"

        with tempfile.TemporaryDirectory(prefix="uuaap-p1-19-") as temp:
            extracted = Path(temp) / "extracted"
            extracted.mkdir()
            archive.extractall(extracted, filter="data")
            extracted_envelope = P1_16.verify_integrity_envelope(extracted)
            extracted_paths = canonical_file_set(extracted)
            assert extracted_paths == member_paths, "archive member/extracted file set diverged"

            if expected_root is not None:
                expected = Path(expected_root)
                P1_16.verify_integrity_envelope(expected)
                expected_paths = canonical_file_set(expected)
                assert expected_paths == extracted_paths, "archive round-trip path set changed"
                for rel in expected_paths:
                    left = expected / Path(*PurePosixPath(rel).parts)
                    right = extracted / Path(*PurePosixPath(rel).parts)
                    assert left.read_bytes() == right.read_bytes(), f"archive round-trip byte drift: {rel}"

    return {
        "schema": PACKAGE_RECEIPT_SCHEMA,
        "artifact_tar_sha256": sha256_file(tar_path),
        "artifact_tar_bytes": tar_path.stat().st_size,
        "packaged_file_count": len(member_paths),
        "includes_p1_16_envelope": True,
        "includes_nojekyll": True,
        "p1_16_payload_file_count": extracted_envelope["payload_file_count"],
        "p1_16_payload_tree_sha256": extracted_envelope["payload_tree_sha256"],
        "verification_scope": "exact_p1_16_finalized_tree_archive_fidelity",
        "non_effects": {
            "producer_authenticated": False,
            "trusted_timestamp_established": False,
            "trust_anchor_established": False,
            "truth_established": False,
            "identity_established": False,
            "authority_established": False,
            "responsibility_established": False,
            "publication_or_action_authority_established": False,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--finalized-root")
    parser.add_argument("--artifact-tar", required=True)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--receipt")
    args = parser.parse_args()

    if args.verify_only:
        assert not args.finalized_root, "verify-only consumes artifact.tar only"
        receipt = verify_artifact_tar(args.artifact_tar)
    else:
        assert args.finalized_root, "packaging requires --finalized-root"
        receipt = package_exact_tree(args.finalized_root, args.artifact_tar)

    if args.receipt:
        output = Path(args.receipt)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
