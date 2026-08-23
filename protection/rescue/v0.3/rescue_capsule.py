#!/usr/bin/env python3
import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_ROLES = {
    "frontier_evidence", "continuity_manifest", "metadata_manifest", "prevention_registry",
    "prevention_assessment", "passive_observation", "observer_attestation",
    "observer_topology_assessment", "rescue_case", "rescue_assessment",
    "recovery_source_manifest", "kontur_replica_manifest", "external_anchor",
}
SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def canonical_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def file_sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_time(value):
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return dt.astimezone(timezone.utc)


def iso_z(dt):
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_item(raw):
    if ":" not in raw:
        raise ValueError("item must be ROLE:PATH")
    role, path = raw.split(":", 1)
    if role not in ALLOWED_ROLES:
        raise ValueError(f"unsupported item role: {role}")
    p = Path(path)
    if not p.exists() or not p.is_file() or p.is_symlink():
        raise ValueError(f"item must be an existing regular non-symlink file: {path}")
    return role, p


def self_digest(manifest):
    value = copy.deepcopy(manifest)
    value["manifest_sha256"] = "0" * 64
    return sha256_bytes(canonical_bytes(value))


def create_capsule(project_id, frontier_ref, out_dir, raw_items, at=None):
    if not project_id or not frontier_ref:
        raise ValueError("project_id and frontier_ref are required")
    if not raw_items:
        raise ValueError("at least one item is required")
    now = parse_time(at) if at else datetime.now(timezone.utc)
    target = Path(out_dir)
    if target.exists():
        raise ValueError("output directory already exists")
    parent = target.parent if target.parent != Path("") else Path(".")
    parent.mkdir(parents=True, exist_ok=True)
    temp = parent / (target.name + ".tmp")
    if temp.exists():
        shutil.rmtree(temp)
    (temp / "items").mkdir(parents=True)

    items = []
    try:
        parsed = [parse_item(x) for x in raw_items]
        for index, (role, src) in enumerate(parsed, start=1):
            safe_base = SAFE_NAME.sub("_", src.name) or "artifact"
            stored = f"items/{index:04d}-{role}-{safe_base}"
            dst = temp / stored
            with src.open("rb") as rf, dst.open("xb") as wf:
                shutil.copyfileobj(rf, wf, length=1024 * 1024)
                wf.flush()
                os.fsync(wf.fileno())
            src_hash = file_sha256(src)
            dst_hash = file_sha256(dst)
            if src_hash != dst_hash:
                raise ValueError(f"copy verification failed for {src.name}")
            items.append({
                "role": role,
                "source_label": src.name,
                "stored_path": stored,
                "size_bytes": dst.stat().st_size,
                "sha256": dst_hash,
            })

        binding = {
            "project_id": project_id,
            "frontier_ref": frontier_ref,
            "items": items,
        }
        capsule_id = "rescue-capsule-" + sha256_bytes(canonical_bytes(binding))[:20]
        manifest = {
            "artifact_type": "RescueCapsuleManifest",
            "artifact_version": "0.3",
            "capsule_id": capsule_id,
            "created_at": iso_z(now),
            "project_id": project_id,
            "frontier_ref": frontier_ref,
            "items": items,
            "manifest_sha256": "0" * 64,
            "claims": {
                "capsule_internal_integrity_only": True,
                "evidence_truth_certified": False,
                "rescue_authorized": False,
                "recovery_executed": False,
                "canonical_successor_established": False,
                "ownership_transferred": False,
                "kontur_activated": False,
                "execution_authority_granted": False,
            },
        }
        manifest["manifest_sha256"] = self_digest(manifest)
        manifest_path = temp / "rescue-capsule-manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        with manifest_path.open("rb") as mf:
            os.fsync(mf.fileno())
        marker = temp / "CAPSULE_COMPLETE"
        marker.write_text(manifest["manifest_sha256"] + "\n", encoding="ascii")
        with marker.open("rb") as cm:
            os.fsync(cm.fileno())
        os.replace(temp, target)
        return target
    except Exception:
        if temp.exists():
            shutil.rmtree(temp, ignore_errors=True)
        raise


def verify_capsule(capsule_dir):
    root = Path(capsule_dir)
    manifest_path = root / "rescue-capsule-manifest.json"
    marker_path = root / "CAPSULE_COMPLETE"
    if not root.is_dir() or not manifest_path.is_file() or not marker_path.is_file():
        raise ValueError("incomplete rescue capsule")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("artifact_type") != "RescueCapsuleManifest" or manifest.get("artifact_version") != "0.3":
        raise ValueError("unsupported rescue capsule manifest")
    expected_manifest_hash = manifest.get("manifest_sha256", "")
    if not HEX64.fullmatch(expected_manifest_hash):
        raise ValueError("invalid manifest SHA-256")
    if self_digest(manifest) != expected_manifest_hash:
        raise ValueError("rescue capsule manifest self-digest mismatch")
    if marker_path.read_text(encoding="ascii").strip() != expected_manifest_hash:
        raise ValueError("CAPSULE_COMPLETE mismatch")

    seen = set()
    for item in manifest.get("items", []):
        stored = item.get("stored_path", "")
        if stored in seen:
            raise ValueError("duplicate stored_path in manifest")
        seen.add(stored)
        rel = Path(stored)
        if rel.is_absolute() or ".." in rel.parts or not stored.startswith("items/"):
            raise ValueError("unsafe stored_path")
        path = root / rel
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"missing or unsafe capsule item: {stored}")
        if path.stat().st_size != item.get("size_bytes"):
            raise ValueError(f"size mismatch: {stored}")
        digest = file_sha256(path)
        if digest != item.get("sha256"):
            raise ValueError(f"SHA-256 mismatch: {stored}")
    if not manifest.get("items"):
        raise ValueError("capsule has no items")
    return manifest


def main():
    parser = argparse.ArgumentParser(description="Create or verify a local hash-bound UU-AAP Rescue Capsule")
    sub = parser.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create")
    c.add_argument("--project-id", required=True)
    c.add_argument("--frontier-ref", required=True)
    c.add_argument("--out-dir", required=True)
    c.add_argument("--item", action="append", required=True, help="ROLE:PATH; repeat for multiple artifacts")
    c.add_argument("--at", help="ISO-8601 creation time for deterministic tests")
    v = sub.add_parser("verify")
    v.add_argument("--capsule-dir", required=True)
    args = parser.parse_args()

    try:
        if args.cmd == "create":
            path = create_capsule(args.project_id, args.frontier_ref, args.out_dir, args.item, args.at)
            print(path)
        else:
            manifest = verify_capsule(args.capsule_dir)
            print(f"RESCUE CAPSULE VERIFIED {manifest['capsule_id']} {manifest['manifest_sha256']}")
    except Exception as exc:
        print(f"rescue capsule operation failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
