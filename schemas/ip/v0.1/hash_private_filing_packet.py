#!/usr/bin/env python3
"""Hash a private filing directory without exposing document contents.

Run locally against a directory outside the public repository. The output contains
only relative paths, byte sizes, per-file SHA-256 values and a canonical package
SHA-256. Do not commit the private directory or an output manifest if filenames
alone reveal sensitive information.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

DOMAIN = b"UU-AAP-PRIVATE-FILING-PACKET-v0.1\n"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(root: Path) -> dict:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError(f"not a directory: {root}")

    files: list[dict] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"symlink not allowed in private filing packet: {path}")
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if not relative or relative.startswith("../"):
            raise ValueError(f"invalid relative path: {relative}")
        files.append(
            {
                "path": relative,
                "size_bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )

    if not files:
        raise ValueError("private filing packet directory is empty")

    canonical = bytearray(DOMAIN)
    for entry in files:
        canonical.extend(entry["path"].encode("utf-8"))
        canonical.extend(b"\0")
        canonical.extend(str(entry["size_bytes"]).encode("ascii"))
        canonical.extend(b"\0")
        canonical.extend(entry["sha256"].encode("ascii"))
        canonical.extend(b"\n")

    return {
        "manifest_version": "0.1",
        "canonicalization": "UU-AAP-PRIVATE-FILING-PACKET-v0.1",
        "package_digest": "sha256:" + hashlib.sha256(canonical).hexdigest(),
        "file_count": len(files),
        "total_size_bytes": sum(entry["size_bytes"] for entry in files),
        "files": files,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: hash_private_filing_packet.py DIRECTORY", file=sys.stderr)
        return 2
    try:
        manifest = build_manifest(Path(argv[1]))
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
