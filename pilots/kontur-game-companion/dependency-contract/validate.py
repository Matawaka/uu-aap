#!/usr/bin/env python3
import copy
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MANIFEST = HERE / "game-companion-chain.json"

ORIGIN_FRONTIER = "2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")

EXPECTED = [
    (
        "observational-lane", 446,
        "75c150a192db68d0c167d2408bd436e54b71d475",
        {
            "spec": "pilots/kontur-game-companion/observational-lane/README.md",
            "fixture": "pilots/kontur-game-companion/observational-lane/observation-cases.json",
            "validator": "pilots/kontur-game-companion/observational-lane/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-observational-lane.yml",
        },
    ),
    (
        "assistance-gate", 452,
        "3fc4b66d6eebe90321baea3c92dbad80f3b0afc0",
        {
            "spec": "pilots/kontur-game-companion/assistance-gate/README.md",
            "fixture": "pilots/kontur-game-companion/assistance-gate/assistance-gate-cases.json",
            "validator": "pilots/kontur-game-companion/assistance-gate/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-assistance-gate.yml",
        },
    ),
    (
        "shared-discovery-memory", 453,
        "b3df9ac63171e6596421a5e7e1dd20cb6a5df615",
        {
            "spec": "pilots/kontur-game-companion/shared-discovery-memory/README.md",
            "fixture": "pilots/kontur-game-companion/shared-discovery-memory/shared-memory-cases.json",
            "validator": "pilots/kontur-game-companion/shared-discovery-memory/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-shared-discovery-memory.yml",
        },
    ),
    (
        "bounded-initiative", 454,
        "282f1320b8fffbb1f4beb388082ec8d59924f67a",
        {
            "spec": "pilots/kontur-game-companion/bounded-initiative/README.md",
            "fixture": "pilots/kontur-game-companion/bounded-initiative/initiative-cases.json",
            "validator": "pilots/kontur-game-companion/bounded-initiative/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-bounded-initiative.yml",
        },
    ),
    (
        "focus-diversity", 455,
        "b45eaf9ba8864023d822340181ae129f1245beb1",
        {
            "spec": "pilots/kontur-game-companion/focus-diversity/README.md",
            "fixture": "pilots/kontur-game-companion/focus-diversity/focus-cases.json",
            "validator": "pilots/kontur-game-companion/focus-diversity/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-focus-diversity.yml",
        },
    ),
    (
        "interaction-receipt", 456,
        "7c97e26aa3b7504d48b9ded6f0dfdccab444f8bd",
        {
            "spec": "pilots/kontur-game-companion/interaction-receipt/README.md",
            "fixture": "pilots/kontur-game-companion/interaction-receipt/interaction-receipt-cases.json",
            "validator": "pilots/kontur-game-companion/interaction-receipt/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-interaction-receipt.yml",
        },
    ),
    (
        "pause-resume", 457,
        "2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee",
        {
            "spec": "pilots/kontur-game-companion/pause-resume/README.md",
            "fixture": "pilots/kontur-game-companion/pause-resume/pause-resume-cases.json",
            "validator": "pilots/kontur-game-companion/pause-resume/validate.py",
            "workflow": ".github/workflows/kontur-game-companion-pause-resume.yml",
        },
    ),
]

EXPECTED_NON_EFFECTS = {
    "live_response_generation",
    "proactive_messaging",
    "background_activity",
    "autonomous_gameplay",
    "game_account_control",
    "external_effect",
    "action_permit",
    "successor_permit",
    "behavioral_profile",
    "psychological_inference",
    "mood_inference",
    "attention_tracking",
    "engagement_maximization",
    "retention_optimization",
    "cross_game_preference_profile",
    "total_history_capture",
    "stable_core_promotion",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def binding_digest(artifacts: dict) -> str:
    payload = {role: artifacts[role]["bound_sha256"] for role in sorted(artifacts)}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_bytes(encoded)


def git(root: Path, *args: str, binary: bool = False):
    proc = subprocess.run(
        ["git", "-C", str(root), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        detail = proc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"git {' '.join(args)} failed: {detail}")
    return proc.stdout if binary else proc.stdout.decode("utf-8", errors="strict").strip()


def validate(data: dict, root: Path, repo_checks: bool = True):
    errors = []

    if data.get("schema_version") != "0.1":
        errors.append("schema_version must be 0.1")
    if data.get("contract") != "KONTUR_GAME_COMPANION_CROSS_LAYER_DEPENDENCY":
        errors.append("unexpected contract")
    if data.get("origin_frontier") != ORIGIN_FRONTIER:
        errors.append("origin_frontier changed")

    audit = data.get("audit_reference")
    if audit != {"pr": 458, "findings": ["F-001", "F-002", "F-004"], "authority_effect": "NONE"}:
        errors.append("audit reference must remain evidence-only and exact")

    non_effects = data.get("non_effects")
    if not isinstance(non_effects, dict) or set(non_effects) != EXPECTED_NON_EFFECTS:
        errors.append("non_effect set mismatch")
    elif any(non_effects.values()):
        errors.append("all non-effects must remain false")

    layers = data.get("layers")
    expected_ids = [item[0] for item in EXPECTED]
    if not isinstance(layers, list) or [x.get("id") for x in layers if isinstance(x, dict)] != expected_ids:
        errors.append("layer identity/order mismatch")
        return errors

    layer_by_id = {layer["id"]: layer for layer in layers}
    if len(layer_by_id) != len(layers):
        errors.append("duplicate layer id")

    for layer, (expected_id, expected_pr, expected_commit, expected_paths) in zip(layers, EXPECTED):
        if layer.get("id") != expected_id:
            errors.append(f"{expected_id}: id mismatch")
            continue
        if layer.get("origin_pr") != expected_pr:
            errors.append(f"{expected_id}: origin PR mismatch")
        commit = layer.get("origin_commit_sha")
        if commit != expected_commit or not isinstance(commit, str) or not COMMIT_RE.fullmatch(commit):
            errors.append(f"{expected_id}: origin commit mismatch")

        artifacts = layer.get("artifacts")
        if not isinstance(artifacts, dict) or set(artifacts) != {"spec", "fixture", "validator", "workflow"}:
            errors.append(f"{expected_id}: artifact role set mismatch")
            continue

        for role, expected_path in expected_paths.items():
            artifact = artifacts.get(role)
            if not isinstance(artifact, dict):
                errors.append(f"{expected_id}/{role}: artifact missing")
                continue
            if set(artifact) != {"path", "origin_sha256", "bound_sha256"}:
                errors.append(f"{expected_id}/{role}: artifact fields mismatch")
            if artifact.get("path") != expected_path:
                errors.append(f"{expected_id}/{role}: path mismatch")
            for hash_field in ("origin_sha256", "bound_sha256"):
                value = artifact.get(hash_field)
                if not isinstance(value, str) or not SHA256_RE.fullmatch(value):
                    errors.append(f"{expected_id}/{role}: invalid {hash_field}")

        if layer.get("binding_digest") != binding_digest(artifacts):
            errors.append(f"{expected_id}: binding digest mismatch")

        if repo_checks and isinstance(commit, str) and COMMIT_RE.fullmatch(commit):
            try:
                git(root, "cat-file", "-e", f"{commit}^{{commit}}")
                proc = subprocess.run(
                    ["git", "-C", str(root), "merge-base", "--is-ancestor", commit, "HEAD"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                )
                if proc.returncode != 0:
                    errors.append(f"{expected_id}: origin commit is not an ancestor of HEAD")
            except RuntimeError as exc:
                errors.append(f"{expected_id}: {exc}")

            for role, artifact in artifacts.items():
                path = artifact.get("path")
                if not isinstance(path, str):
                    continue
                current_path = root / path
                if not current_path.is_file():
                    errors.append(f"{expected_id}/{role}: current artifact missing")
                    continue
                current_hash = sha256_bytes(current_path.read_bytes())
                if current_hash != artifact.get("bound_sha256"):
                    errors.append(f"{expected_id}/{role}: current bound hash drift")
                try:
                    origin_bytes = git(root, "show", f"{commit}:{path}", binary=True)
                    origin_hash = sha256_bytes(origin_bytes)
                    if origin_hash != artifact.get("origin_sha256"):
                        errors.append(f"{expected_id}/{role}: origin hash mismatch")
                except RuntimeError as exc:
                    errors.append(f"{expected_id}/{role}: {exc}")

    edges = data.get("edges")
    expected_edges = list(zip(expected_ids[:-1], expected_ids[1:]))
    if not isinstance(edges, list) or len(edges) != len(expected_edges):
        errors.append("edge count mismatch")
        return errors

    for edge, (source, target) in zip(edges, expected_edges):
        if edge.get("from") != source or edge.get("to") != target:
            errors.append(f"edge {source}->{target}: identity/order mismatch")
            continue
        if edge.get("relation") != "EXACT_PREDECESSOR_ARTIFACT_SET":
            errors.append(f"edge {source}->{target}: relation mismatch")
        if edge.get("predecessor_binding_digest") != layer_by_id[source].get("binding_digest"):
            errors.append(f"edge {source}->{target}: predecessor binding mismatch")
        if edge.get("successor_binding_digest") != layer_by_id[target].get("binding_digest"):
            errors.append(f"edge {source}->{target}: successor binding mismatch")

    return errors


def expect_rejected(name: str, mutated: dict, root: Path, repo_checks: bool = False):
    errors = validate(mutated, root, repo_checks=repo_checks)
    if not errors:
        raise AssertionError(f"mutation unexpectedly accepted: {name}")


def mutation_suite(base: dict, root: Path):
    mutations = []

    def add(name, fn, repo=False):
        item = copy.deepcopy(base)
        fn(item)
        mutations.append((name, item, repo))

    add("schema", lambda d: d.__setitem__("schema_version", "0.2"))
    add("contract", lambda d: d.__setitem__("contract", "OTHER"))
    add("frontier", lambda d: d.__setitem__("origin_frontier", "0" * 40))
    add("audit-authority", lambda d: d["audit_reference"].__setitem__("authority_effect", "REMEDIATION"))
    add("audit-findings", lambda d: d["audit_reference"].__setitem__("findings", ["F-001"]))
    add("live-response", lambda d: d["non_effects"].__setitem__("live_response_generation", True))
    add("action-permit", lambda d: d["non_effects"].__setitem__("action_permit", True))
    add("successor-permit", lambda d: d["non_effects"].__setitem__("successor_permit", True))
    add("stable-core-promotion", lambda d: d["non_effects"].__setitem__("stable_core_promotion", True))
    add("missing-layer", lambda d: d["layers"].pop())
    add("reordered-layers", lambda d: d["layers"].__setitem__(slice(0, 2), list(reversed(d["layers"][:2]))))
    add("wrong-pr", lambda d: d["layers"][1].__setitem__("origin_pr", 999))
    add("wrong-commit", lambda d: d["layers"][1].__setitem__("origin_commit_sha", "f" * 40))
    add("missing-artifact-role", lambda d: d["layers"][2]["artifacts"].pop("fixture"))
    add("wrong-artifact-path", lambda d: d["layers"][2]["artifacts"]["fixture"].__setitem__("path", "README.md"))
    add("invalid-origin-hash", lambda d: d["layers"][3]["artifacts"]["spec"].__setitem__("origin_sha256", "xyz"))
    add("invalid-bound-hash", lambda d: d["layers"][3]["artifacts"]["spec"].__setitem__("bound_sha256", "xyz"))
    add("wrong-binding-digest", lambda d: d["layers"][4].__setitem__("binding_digest", "0" * 64))
    add("missing-edge", lambda d: d["edges"].pop())
    add("reversed-edge", lambda d: (d["edges"][0].__setitem__("from", "assistance-gate"), d["edges"][0].__setitem__("to", "observational-lane")))
    add("self-edge", lambda d: d["edges"][1].__setitem__("to", "assistance-gate"))
    add("wrong-relation", lambda d: d["edges"][2].__setitem__("relation", "PROSE_ONLY"))
    add("wrong-predecessor-digest", lambda d: d["edges"][3].__setitem__("predecessor_binding_digest", "0" * 64))
    add("wrong-successor-digest", lambda d: d["edges"][4].__setitem__("successor_binding_digest", "0" * 64))

    # Repository-level mutation: keep the structure internally consistent while
    # claiming a different currently-bound byte state. Only repository hashing
    # can reject this mutation.
    def mutate_bound_hash(d):
        layer = d["layers"][0]
        layer["artifacts"]["fixture"]["bound_sha256"] = "1" * 64
        layer["binding_digest"] = binding_digest(layer["artifacts"])
        d["edges"][0]["predecessor_binding_digest"] = layer["binding_digest"]

    add("repo-bound-byte-drift", mutate_bound_hash, True)

    def mutate_origin_hash(d):
        d["layers"][0]["artifacts"]["fixture"]["origin_sha256"] = "2" * 64

    add("repo-origin-byte-drift", mutate_origin_hash, True)

    for name, mutated, repo_checks in mutations:
        expect_rejected(name, mutated, root, repo_checks=repo_checks)

    return len(mutations)


def main():
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"FAIL: cannot load manifest: {exc}", file=sys.stderr)
        return 1

    errors = validate(data, ROOT, repo_checks=True)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1

    try:
        mutation_count = mutation_suite(data, ROOT)
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    print(
        "OK: Game Companion cross-layer dependency contract; "
        f"{len(data['layers'])} layers, {len(data['edges'])} exact edges, "
        f"{mutation_count} fail-closed mutations rejected"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
