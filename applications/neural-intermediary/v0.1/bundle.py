# SPDX-License-Identifier: Apache-2.0
"""Data-only, bounded archive. Raw input bytes survive pack/replay unchanged."""
import hashlib
import io
import json
import re
import stat
import zipfile
import zlib

import core
import check

MEMBERS = {"policy.json", "observations.json", "report.json", "manifest.json"}
LIMIT = core.MAX_BYTES * 4 + 4096


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pack(policy_bytes, observation_bytes):
    policy, observations = core.parse(policy_bytes), core.parse(observation_bytes)
    report = core.evaluate(policy, observations)
    core.require(check.verify(policy, observations, report)["status"] == "CHECKED_BOUNDED", "checker_disagreement")
    members = {"policy.json": policy_bytes, "observations.json": observation_bytes, "report.json": core.canonical(report)}
    members["manifest.json"] = core.canonical({"schema": "matawaka.intermediary.bundle/v0.1",
                                              "files": {k: {"sha256": sha(v), "bytes": len(v)} for k, v in sorted(members.items())}})
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, value in sorted(members.items()):
            core.require(len(value) <= core.MAX_BYTES, "bundle_member_limit")
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            archive.writestr(info, value)
    return stream.getvalue()


def restore(data, *, expected_policy_sha256, expected_bundle_sha256=None):
    """The policy pin must come from the caller, never from the archive itself."""
    core.require(type(data) is bytes and len(data) <= LIMIT, "bundle_byte_limit")
    for pin in (expected_policy_sha256, expected_bundle_sha256):
        core.require(pin is None or type(pin) is str and re.fullmatch(r"[0-9a-f]{64}", pin), "bundle_pin_shape")
    core.require(expected_policy_sha256 is not None, "policy_pin_required")
    if expected_bundle_sha256 is not None:
        core.require(sha(data) == expected_bundle_sha256, "bundle_pin_mismatch")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = archive.infolist()
            core.require(len(infos) == 4 and {i.filename for i in infos} == MEMBERS, "bundle_members")
            for item in infos:
                core.require(item.orig_filename == item.filename and not item.is_dir() and not item.flag_bits & 1,
                             "bundle_member_kind")
                core.require(stat.S_IFMT(item.external_attr >> 16) == stat.S_IFREG, "bundle_not_regular")
                core.require(item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), "bundle_compression")
                core.require(0 <= item.file_size <= core.MAX_BYTES, "bundle_member_limit")
            members = {i.filename: archive.read(i) for i in infos}
    except (zipfile.BadZipFile, zipfile.LargeZipFile, RuntimeError, OSError, EOFError, zlib.error):
        raise core.Refused("bundle_unreadable") from None
    manifest = core.parse(members["manifest.json"])
    core.exact(manifest, "schema files", "bundle_manifest_shape")
    core.require(manifest["schema"] == "matawaka.intermediary.bundle/v0.1", "bundle_version")
    core.require(type(manifest["files"]) is dict and set(manifest["files"]) == MEMBERS - {"manifest.json"}, "bundle_inventory")
    for name, expected in manifest["files"].items():
        core.exact(expected, "sha256 bytes", "bundle_inventory_shape")
        core.require(type(expected["bytes"]) is int and expected == {"sha256": sha(members[name]), "bytes": len(members[name])}, "bundle_integrity")
    core.require(sha(members["policy.json"]) == expected_policy_sha256, "policy_pin_mismatch")
    policy, observations, report = [core.parse(members[k]) for k in ("policy.json", "observations.json", "report.json")]
    fresh = core.evaluate(policy, observations)
    core.require(core.canonical(fresh) == core.canonical(report), "bundle_reassessment_mismatch")
    verification = check.verify(policy, observations, report)
    core.require(verification["status"] == "CHECKED_BOUNDED", "checker_disagreement")
    return {"report": report, "verification": verification, "policy_bytes": members["policy.json"],
            "observation_bytes": members["observations.json"], "bundle_sha256": sha(data),
            "origin_authenticated": False}
