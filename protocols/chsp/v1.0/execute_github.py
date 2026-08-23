#!/usr/bin/env python3
"""Explicit operator entrypoint for one CHSP v1.0 GitHub execution event.

Nothing executes without --commit, an exact authorization SHA-256, complete predecessor
artifacts, and CHSP_GITHUB_TOKEN supplied through the process environment.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import chsp_v10 as C
from github_rest_adapter import GitHubRestAdapter


def write_new_json(path: Path, value: dict) -> None:
    if path.exists() or path.is_symlink():
        raise ValueError(f"output already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def main() -> int:
    parser = argparse.ArgumentParser(description="Execute one exact CHSP v1.0 GitHub transition")
    parser.add_argument("--policy", required=True)
    parser.add_argument("--envelope", required=True)
    parser.add_argument("--recheck", required=True)
    parser.add_argument("--authorization", required=True)
    parser.add_argument("--authorization-assessment", required=True)
    parser.add_argument("--execution-request", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--receipt-out", required=True)
    parser.add_argument("--assessment-out", required=True)
    parser.add_argument("--authorization-sha256", required=True)
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    if not args.commit:
        raise SystemExit("refusing external execution without explicit --commit")

    policy = C.load_json(Path(args.policy))
    envelope = C.load_json(Path(args.envelope))
    recheck = C.load_json(Path(args.recheck))
    authorization = C.load_json(Path(args.authorization))
    authorization_assessment = C.load_json(Path(args.authorization_assessment))
    request = C.load_json(Path(args.execution_request))

    if authorization.get("authorization_sha256") != args.authorization_sha256:
        raise SystemExit("authorization SHA-256 confirmation does not match artifact")

    token = os.environ.get("CHSP_GITHUB_TOKEN")
    if not token:
        raise SystemExit("CHSP_GITHUB_TOKEN is required in the process environment")

    receipt_path = Path(args.receipt_out)
    assessment_path = Path(args.assessment_out)
    if receipt_path.exists() or assessment_path.exists():
        raise SystemExit("receipt/assessment output path already exists")

    adapter = GitHubRestAdapter(token)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    receipt = C.execute_exact_transition(
        envelope, recheck, authorization, authorization_assessment, request,
        policy, adapter, Path(args.state_dir), C.iso_z(now),
    )
    assessment = C.assess_execution(receipt, C.iso_z(now))
    write_new_json(receipt_path, receipt)
    write_new_json(assessment_path, assessment)
    print(json.dumps({"result":receipt["result"],"receipt_sha256":receipt["receipt_sha256"],"assessment_state":assessment["state"]}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
