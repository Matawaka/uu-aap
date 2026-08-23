#!/usr/bin/env python3
"""Create and verify non-authoritative, read-only continuity captures for a Git repository."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TOOL_VERSION = "0.1"
MANIFEST_SCHEMA = "urn:uu-aap:continuity:manifest:v0.1"


class ContinuityError(RuntimeError):
    pass


def run(cmd: list[str], cwd: Path | None = None) -> str:
    proc = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if proc.returncode != 0:
        raise ContinuityError(f"command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stdout}")
    return proc.stdout.strip()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def utc_stamp() -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y%m%dT%H%M%SZ"), now.isoformat().replace("+00:00", "Z")


def repo_name(repo: str) -> str:
    tail = repo.rstrip("/\\").split("/")[-1]
    if tail.endswith(".git"):
        tail = tail[:-4]
    return tail or "repository"


def ensure_git() -> None:
    if shutil.which("git") is None:
        raise ContinuityError("git executable not found")
    run(["git", "--version"])


def ensure_mirror(repo: str, mirror: Path) -> None:
    mirror.parent.mkdir(parents=True, exist_ok=True)
    if not mirror.exists():
        run(["git", "clone", "--mirror", repo, str(mirror)])
        return
    if not (mirror / "HEAD").exists():
        raise ContinuityError(f"existing mirror path is not a bare Git repository: {mirror}")
    existing = run(["git", "remote", "get-url", "origin"], cwd=mirror)
    if existing != repo:
        raise ContinuityError(
            "mirror origin mismatch; refusing to repoint an existing continuity mirror\n"
            f"expected: {repo}\nactual:   {existing}"
        )
    # No prune: upstream ref deletion must not silently erase local continuity evidence.
    run(["git", "remote", "update", "origin"], cwd=mirror)


def list_refs(mirror: Path) -> list[dict[str, str]]:
    raw = run(
        ["git", "for-each-ref", "--format=%(refname)%00%(objectname)"],
        cwd=mirror,
    )
    refs: list[dict[str, str]] = []
    if not raw:
        return refs
    for line in raw.splitlines():
        ref, sha = line.split("\x00", 1)
        refs.append({"ref": ref, "object_sha": sha})
    return refs


def list_tags(mirror: Path) -> list[dict[str, str]]:
    raw = run(["git", "tag", "--list"], cwd=mirror)
    tags: list[dict[str, str]] = []
    for tag in [x for x in raw.splitlines() if x.strip()]:
        object_sha = run(["git", "rev-parse", f"refs/tags/{tag}"], cwd=mirror)
        commit_sha = run(["git", "rev-list", "-n", "1", f"refs/tags/{tag}"], cwd=mirror)
        tags.append({"name": tag, "tag_object_or_target_sha": object_sha, "commit_sha": commit_sha})
    return tags


def previous_manifest(captures_root: Path) -> dict[str, str] | None:
    manifests = sorted(captures_root.glob("*/continuity-manifest.json"))
    if not manifests:
        return None
    previous = manifests[-1]
    return {
        "relative_path": str(previous.relative_to(captures_root.parent)).replace(os.sep, "/"),
        "sha256": sha256_file(previous),
    }


def capture(args: argparse.Namespace) -> int:
    ensure_git()
    root = Path(args.root).expanduser().resolve()
    name = repo_name(args.repo)
    mirror = root / "mirror" / f"{name}.git"
    captures_root = root / "captures"
    captures_root.mkdir(parents=True, exist_ok=True)
    prev = previous_manifest(captures_root)

    ensure_mirror(args.repo, mirror)

    fsck_output = run(["git", "fsck", "--full"], cwd=mirror)
    main_ref = f"refs/heads/{args.main_branch}"
    main_sha = run(["git", "rev-parse", "--verify", main_ref], cwd=mirror)
    if args.expected_main and main_sha.lower() != args.expected_main.lower():
        raise ContinuityError(
            "main frontier mismatch; no continuity capture created\n"
            f"expected: {args.expected_main}\nactual:   {main_sha}"
        )
    tree_sha = run(["git", "rev-parse", f"{main_ref}^{{tree}}"], cwd=mirror)

    stamp, captured_at = utc_stamp()
    capture_dir = captures_root / stamp
    if capture_dir.exists():
        raise ContinuityError(f"capture directory already exists: {capture_dir}")
    capture_dir.mkdir(parents=False)

    bundle = capture_dir / f"{name}-{stamp}.bundle"
    run(["git", "bundle", "create", str(bundle), "--all"], cwd=mirror)
    bundle_verify = run(["git", "bundle", "verify", str(bundle)])
    bundle_sha = sha256_file(bundle)

    manifest: dict[str, Any] = {
        "$schema": "./continuity-manifest.schema.json",
        "schema_id": MANIFEST_SCHEMA,
        "tool_version": TOOL_VERSION,
        "captured_at_utc": captured_at,
        "source": {
            "repository": args.repo,
            "main_branch": args.main_branch,
            "main_commit_sha": main_sha,
            "main_tree_sha": tree_sha,
        },
        "integrity": {
            "git_fsck": "pass",
            "git_fsck_output": fsck_output,
            "bundle_verify": "pass",
            "bundle_verify_output": bundle_verify,
            "bundle_file": bundle.name,
            "bundle_sha256": bundle_sha,
        },
        "refs": list_refs(mirror),
        "tags": list_tags(mirror),
        "lineage": {"previous_manifest": prev},
        "boundary": {
            "remote_mutation_performed": False,
            "canonical_successor_claimed": False,
            "authority_transferred": False,
            "kontur_activated_or_modified": False,
            "distributed_consensus_claimed": False,
        },
    }

    manifest_path = capture_dir / "continuity-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest_sha = sha256_file(manifest_path)
    (capture_dir / "continuity-manifest.sha256").write_text(
        f"{manifest_sha}  continuity-manifest.json\n", encoding="utf-8"
    )
    # Completion marker is written last. Its presence means bundle + manifest were fully generated.
    (capture_dir / "CAPTURE_COMPLETE").write_text(
        f"manifest_sha256={manifest_sha}\n", encoding="utf-8"
    )

    print("CONTINUITY CAPTURE VERIFIED")
    print(f"mirror:   {mirror}")
    print(f"bundle:   {bundle}")
    print(f"manifest: {manifest_path}")
    print(f"main:     {main_sha}")
    print(f"tree:     {tree_sha}")
    print(f"sha256:   {bundle_sha}")
    return 0


def verify(args: argparse.Namespace) -> int:
    ensure_git()
    manifest_path = Path(args.manifest).expanduser().resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_id") != MANIFEST_SCHEMA:
        raise ContinuityError("unexpected continuity manifest schema_id")
    bundle = manifest_path.parent / manifest["integrity"]["bundle_file"]
    if not bundle.exists():
        raise ContinuityError(f"bundle not found: {bundle}")
    actual_sha = sha256_file(bundle)
    expected_sha = manifest["integrity"]["bundle_sha256"]
    if actual_sha != expected_sha:
        raise ContinuityError(
            f"bundle SHA-256 mismatch\nexpected: {expected_sha}\nactual:   {actual_sha}"
        )
    verify_output = run(["git", "bundle", "verify", str(bundle)])
    print("CONTINUITY CAPTURE VALID")
    print(f"manifest: {manifest_path}")
    print(f"bundle:   {bundle}")
    print(f"sha256:   {actual_sha}")
    print(verify_output)
    return 0


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Create and verify read-only Git continuity captures without remote mutation."
    )
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("capture", help="create/update a mirror and write a dated bundle + manifest")
    c.add_argument("--repo", required=True, help="canonical Git repository URL or local Git path")
    c.add_argument("--root", required=True, help="local continuity root directory")
    c.add_argument("--main-branch", default="main")
    c.add_argument("--expected-main", help="optional exact expected main commit SHA; mismatch fails closed")
    c.set_defaults(func=capture)

    v = sub.add_parser("verify", help="verify bundle digest and Git bundle integrity")
    v.add_argument("--manifest", required=True, help="path to continuity-manifest.json")
    v.set_defaults(func=verify)
    return p


def main() -> int:
    try:
        args = parser().parse_args()
        return args.func(args)
    except (ContinuityError, KeyError, json.JSONDecodeError, OSError) as exc:
        print(f"CONTINUITY ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
