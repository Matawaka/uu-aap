#!/usr/bin/env python3
"""P1.18 byte-oriented observation of public Pages against an exact P1.16 artifact envelope."""
from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

ENVELOPE_NAME = "pages-integrity-envelope.json"
ENVELOPE_SCHEMA = "urn:uu-aap:relocatable-pages-integrity-envelope:0.1"
RECEIPT_SCHEMA = "urn:uu-aap:post-deployment-byte-observation:0.1"
DEFAULT_BASE_URL = "https://matawaka.github.io/uu-aap/"
NON_EFFECTS = {
    "producer_authenticated": False,
    "truth_established": False,
    "identity_established": False,
    "authority_established": False,
    "responsibility_established": False,
    "trusted_timestamp_established": False,
    "external_trust_anchor_established": False,
    "future_availability_guaranteed": False,
    "publication_or_action_authority_established": False,
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_path(value: Any) -> str:
    assert isinstance(value, str) and value, "manifest path must be non-empty string"
    assert "\\" not in value and "?" not in value and "#" not in value and "\x00" not in value, "non-canonical path"
    path = PurePosixPath(value)
    assert not path.is_absolute(), "absolute manifest path forbidden"
    assert all(part not in {"", ".", ".."} for part in path.parts), "dot/empty path segment forbidden"
    normalized = path.as_posix()
    assert normalized == value, f"path normalization drift: {value!r} -> {normalized!r}"
    return normalized


def load_expected_envelope(expected_root: Path) -> tuple[bytes, dict[str, Any]]:
    assert expected_root.is_dir(), "expected artifact root missing"
    path = expected_root / ENVELOPE_NAME
    raw = path.read_bytes()
    envelope = json.loads(raw.decode("utf-8"))
    assert envelope["schema"] == ENVELOPE_SCHEMA, "unexpected envelope schema"
    files = envelope["files"]
    assert isinstance(files, list), "files must be array"
    assert envelope["payload_file_count"] == len(files), "payload count mismatch"
    seen: set[str] = set()
    for index, item in enumerate(files):
        assert isinstance(item, dict) and set(item) == {"path", "bytes", "sha256"}, f"files[{index}] shape changed"
        rel = canonical_path(item["path"])
        assert rel not in seen, f"duplicate manifest path: {rel}"
        seen.add(rel)
        assert isinstance(item["bytes"], int) and item["bytes"] >= 0, f"files[{index}].bytes"
        digest = item["sha256"]
        assert isinstance(digest, str) and len(digest) == 64 and all(c in "0123456789abcdef" for c in digest), f"files[{index}].sha256"
        local = expected_root / Path(*PurePosixPath(rel).parts)
        assert local.is_file(), f"expected artifact payload missing: {rel}"
        data = local.read_bytes()
        assert len(data) == item["bytes"], f"expected artifact byte length drift: {rel}"
        assert sha256_bytes(data) == digest, f"expected artifact digest drift: {rel}"
    assert envelope.get("verification_scope") == "relocated_byte_consistency_against_this_envelope"
    non_effects = envelope.get("non_effects")
    assert isinstance(non_effects, dict) and non_effects
    assert all(value is False for value in non_effects.values()), "P1.16 non-effects must remain false"
    return raw, envelope


def origin_tuple(url: str) -> tuple[str, str, int | None]:
    parsed = urllib.parse.urlparse(url)
    assert parsed.scheme in {"http", "https"} and parsed.hostname, "http(s) base URL required"
    return parsed.scheme.lower(), parsed.hostname.lower(), parsed.port


def fetch_bytes(base_url: str, rel_path: str, *, cache_bust: str, timeout: float) -> tuple[bytes, dict[str, Any]]:
    rel_path = canonical_path(rel_path)
    base = base_url if base_url.endswith("/") else base_url + "/"
    target = urllib.parse.urljoin(base, urllib.parse.quote(rel_path, safe="/-._~"))
    separator = "&" if "?" in target else "?"
    request_url = f"{target}{separator}p1_18={urllib.parse.quote(cache_bust, safe='')}"
    request = urllib.request.Request(
        request_url,
        headers={
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "UU-AAP-P1.18-Deployed-Byte-Observer/0.1",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        status = getattr(response, "status", response.getcode())
        assert status == 200, f"HTTP {status} for {rel_path}"
        final_url = response.geturl()
        assert origin_tuple(final_url) == origin_tuple(base), f"cross-origin redirect for {rel_path}: {final_url}"
        body = response.read()
        metadata = {
            "path": rel_path,
            "status": status,
            "final_url": final_url.split("?", 1)[0],
            "bytes": len(body),
            "sha256": sha256_bytes(body),
        }
        return body, metadata


def observe_once(expected_raw: bytes, envelope: dict[str, Any], *, base_url: str, cache_bust: str, timeout: float) -> dict[str, Any]:
    remote_envelope_raw, envelope_metadata = fetch_bytes(
        base_url, ENVELOPE_NAME, cache_bust=cache_bust, timeout=timeout
    )
    assert remote_envelope_raw == expected_raw, "public envelope bytes differ from exact workflow artifact envelope"
    observations = []
    for item in envelope["files"]:
        body, metadata = fetch_bytes(base_url, item["path"], cache_bust=cache_bust, timeout=timeout)
        assert len(body) == item["bytes"], f"public byte length mismatch: {item['path']}"
        assert metadata["sha256"] == item["sha256"], f"public SHA-256 mismatch: {item['path']}"
        observations.append(metadata)
    assert len(observations) == envelope["payload_file_count"]
    return {"envelope": envelope_metadata, "files": observations}


def observe_with_retry(
    expected_root: Path,
    *,
    base_url: str,
    triggering_run_id: str,
    head_sha: str,
    artifact_id: str,
    artifact_digest: str,
    max_attempts: int,
    retry_seconds: float,
    timeout: float,
) -> dict[str, Any]:
    expected_raw, envelope = load_expected_envelope(expected_root)
    assert max_attempts >= 1
    errors: list[str] = []
    observation: dict[str, Any] | None = None
    used_attempt = 0
    for attempt in range(1, max_attempts + 1):
        used_attempt = attempt
        try:
            observation = observe_once(
                expected_raw,
                envelope,
                base_url=base_url,
                cache_bust=f"{head_sha}-{attempt}",
                timeout=timeout,
            )
            break
        except (AssertionError, OSError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            errors.append(f"attempt {attempt}: {type(exc).__name__}: {exc}")
            if attempt < max_attempts:
                time.sleep(retry_seconds)
    if observation is None:
        raise AssertionError("post-deployment observation failed after bounded retry: " + " | ".join(errors))

    observed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "schema": RECEIPT_SCHEMA,
        "status": "OBSERVED_PUBLIC_BYTES_MATCH_EXACT_DEPLOYED_ARTIFACT_ENVELOPE",
        "observed_at_utc": observed_at,
        "observation_time_is_trusted_timestamp": False,
        "base_url": base_url if base_url.endswith("/") else base_url + "/",
        "triggering_workflow_run_id": str(triggering_run_id),
        "triggering_head_sha": head_sha,
        "expected_artifact": {
            "artifact_id": str(artifact_id),
            "artifact_digest": artifact_digest,
            "envelope_sha256": sha256_bytes(expected_raw),
            "payload_file_count": envelope["payload_file_count"],
            "payload_tree_sha256": envelope["payload_tree_sha256"],
        },
        "attempts_used": used_attempt,
        "prior_attempt_errors": errors,
        "public_envelope": observation["envelope"],
        "observed_payloads": observation["files"],
        "all_envelope_listed_payload_bytes_matched": True,
        "non_effects": dict(NON_EFFECTS),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-root", required=True)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--triggering-run-id", required=True)
    parser.add_argument("--head-sha", required=True)
    parser.add_argument("--artifact-id", required=True)
    parser.add_argument("--artifact-digest", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--max-attempts", type=int, default=12)
    parser.add_argument("--retry-seconds", type=float, default=5.0)
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args()
    receipt = observe_with_retry(
        Path(args.expected_root),
        base_url=args.base_url,
        triggering_run_id=args.triggering_run_id,
        head_sha=args.head_sha,
        artifact_id=args.artifact_id,
        artifact_digest=args.artifact_digest,
        max_attempts=args.max_attempts,
        retry_seconds=args.retry_seconds,
        timeout=args.timeout,
    )
    output = Path(args.receipt)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"P1.18 public payload bytes verified: {len(receipt['observed_payloads'])}")
    print(f"P1.18 envelope SHA-256: {receipt['expected_artifact']['envelope_sha256']}")
    print("P1.18 public byte match != producer/truth/identity/authority/responsibility/timestamp: PASS")


if __name__ == "__main__":
    main()
