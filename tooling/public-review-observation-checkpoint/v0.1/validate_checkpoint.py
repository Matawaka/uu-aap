#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
CHECKPOINT_PATH = HERE / "checkpoint.json"
SCHEMA_PATH = HERE / "checkpoint.schema.json"
ISSUE_RECEIPT_PATH = HERE / "repository-issues-live-receipt.json"
DISCUSSION_RECEIPT_PATH = HERE / "declared-discussions-live-receipt.json"
ORIGIN = "88f5896ac60c59e0a3449196466c3ea9dcd9ea87"

EXPECTED = {
    "issue_receipt_sha256": "9958c1601b129aeeff144ca8ee27f06cf013eb4fd4cc91ad17e9d8569835d307",
    "discussion_receipt_sha256": "d9973d1bad2f0aecbee8f20bddd2149de2bbb5101b5d9b6d04918482d6ef47f4",
    "issue_artifact_zip_sha256": "e738af95fca1a83ed07b739e206b1aafaea4adb4ebd816ec11dde6a6d28cbad6",
    "discussion_artifact_zip_sha256": "f3c96d249f87b8f538719702856ee635b1f9a3a3621f1f01eefb502ed39a2b2b",
    "repository_issue_collector_blob": "7dd45aca4dc01cd5302e8c4baabaf69e5560c784",
    "repository_issue_policy_blob": "c901cffec32b1e6929f13896689379154a7809ee",
    "discussion_collector_blob": "25386331004af2c398749ce80bd4e4d96a810c0a",
    "discussion_policy_blob": "6f22c55d8fc6e9e3bdbd1f7abc1b393e4ba5ed98",
}

SOURCE_PATHS = {
    "repository_issue_collector_blob": "tooling/public-review-repository-discovery/v0.2/collector.py",
    "repository_issue_policy_blob": "tooling/public-review-repository-discovery/v0.2/policy.json",
    "discussion_collector_blob": "tooling/public-review-discussion-discovery/v0.3/collector.py",
    "discussion_policy_blob": "tooling/public-review-discussion-discovery/v0.3/policy.json",
}

EXPECTED_ISSUE_META = {
    "path": "tooling/public-review-observation-checkpoint/v0.1/repository-issues-live-receipt.json",
    "sha256": EXPECTED["issue_receipt_sha256"],
    "observer_schema": "urn:uu-aap:public-review-repository-discovery:0.2",
    "source_run_id": 33370805576,
    "source_run_head_sha": "bef77bddd4fa6430bb16f14e52f1d5fee1aeb786",
    "source_artifact_id": 9749967593,
    "source_artifact_zip_sha256": EXPECTED["issue_artifact_zip_sha256"],
    "source_artifact_expires_at": "2026-09-30T07:59:51Z",
    "observed_at_utc": "2026-08-31T07:59:50Z",
    "status": "NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED",
    "known_historical_external_sources": 1,
    "new_external_account_sources": 0,
}

EXPECTED_DISCUSSION_META = {
    "path": "tooling/public-review-observation-checkpoint/v0.1/declared-discussions-live-receipt.json",
    "sha256": EXPECTED["discussion_receipt_sha256"],
    "observer_schema": "urn:uu-aap:public-review-discussion-discovery:0.3",
    "source_run_id": 33373077522,
    "source_run_head_sha": ORIGIN,
    "source_artifact_id": 9750806770,
    "source_artifact_zip_sha256": EXPECTED["discussion_artifact_zip_sha256"],
    "source_artifact_expires_at": "2026-09-30T08:28:47Z",
    "observed_at_utc": "2026-08-31T08:28:46Z",
    "status": "NO_EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED",
    "discussion_numbers": [8, 10],
    "external_account_sources": 0,
}

EXPECTED_COVERED_SURFACES = {
    "github_issues": {
        "repository_wide": True,
        "open_and_closed": True,
        "issue_bodies": True,
        "issue_comments": True,
        "pull_requests": False,
        "pull_request_comments": False,
    },
    "github_discussions": {
        "discussion_numbers": [8, 10],
        "discussion_bodies": True,
        "top_level_comments": True,
        "replies": True,
        "all_repository_discussions": False,
    },
}


def load_json_bytes(data: bytes):
    return json.loads(data.decode("utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load module {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def blob_at(ref: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"{ref}:{path}"], cwd=REPO_ROOT, text=True
    ).strip()


def validate_data(checkpoint: dict, issue_bytes: bytes, discussion_bytes: bytes, verify_git: bool = True):
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(checkpoint), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError("checkpoint schema validation failed: " + errors[0].message)

    if checkpoint["checkpoint_origin_frontier"] != ORIGIN:
        raise ValueError("checkpoint origin frontier drift")

    issue_meta = checkpoint["retained_receipts"]["repository_issue_discovery"]
    discussion_meta = checkpoint["retained_receipts"]["declared_discussion_discovery"]
    if issue_meta != EXPECTED_ISSUE_META:
        raise ValueError("repository-issue retained source metadata drift")
    if discussion_meta != EXPECTED_DISCUSSION_META:
        raise ValueError("Discussion retained source metadata drift")

    issue_digest = sha256_bytes(issue_bytes)
    discussion_digest = sha256_bytes(discussion_bytes)
    if issue_digest != EXPECTED["issue_receipt_sha256"]:
        raise ValueError("retained repository-issue receipt digest drift")
    if discussion_digest != EXPECTED["discussion_receipt_sha256"]:
        raise ValueError("retained Discussion receipt digest drift")

    issue_receipt = load_json_bytes(issue_bytes)
    discussion_receipt = load_json_bytes(discussion_bytes)

    issue_validator = load_module(
        "public_review_repository_discovery_v02_checkpoint",
        REPO_ROOT / "tooling/public-review-repository-discovery/v0.2/collector.py",
    )
    discussion_validator = load_module(
        "public_review_discussion_discovery_v03_checkpoint",
        REPO_ROOT / "tooling/public-review-discussion-discovery/v0.3/collector.py",
    )
    issue_validator.validate_receipt(issue_receipt)
    discussion_validator.validate_receipt(discussion_receipt)

    if issue_receipt["observed_at_utc"] != EXPECTED_ISSUE_META["observed_at_utc"]:
        raise ValueError("repository issue observation time drift")
    if issue_receipt["status"] != "NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED":
        raise ValueError("repository issue observation status drift")
    counts = issue_receipt["counts"]
    if counts != {
        "issue_objects": 363,
        "pull_request_objects_excluded": 0,
        "issue_comments": 208,
        "project_account_sources": 570,
        "automation_sources": 0,
        "unattributed_sources": 0,
        "external_account_sources": 1,
        "known_historical_external_sources": 1,
        "new_external_account_sources": 0,
    }:
        raise ValueError("repository issue observation count drift")
    if len(issue_receipt["known_historical_external_sources"]) != 1:
        raise ValueError("historical external issue-source count drift")
    historical = issue_receipt["known_historical_external_sources"][0]
    if (
        historical["issue_number"] != 422
        or historical["source_id"] != 5471862585
        or historical["url"] != "https://github.com/Matawaka/uu-aap/issues/422#issuecomment-5471862585"
        or historical["author_account_identifier"] != "84dnnvbdvp-debug"
        or historical["body_sha256"] != "23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8"
        or historical["classification"] != "KNOWN_HISTORICAL_EXTERNAL_SOURCE"
    ):
        raise ValueError("historical #422 binding drift")

    if discussion_receipt["observed_at_utc"] != EXPECTED_DISCUSSION_META["observed_at_utc"]:
        raise ValueError("Discussion observation time drift")
    if discussion_receipt["status"] != "NO_EXTERNAL_ACCOUNT_DISCUSSION_SOURCE_OBSERVED":
        raise ValueError("Discussion observation status drift")
    if discussion_receipt["target_discussion_numbers"] != [8, 10]:
        raise ValueError("Discussion target scope drift")
    if discussion_receipt["external_account_sources"]:
        raise ValueError("Discussion checkpoint unexpectedly contains external source")
    expected_discussion_observations = [
        {
            "discussion_number": 8,
            "url": "https://github.com/Matawaka/uu-aap/discussions/8",
            "closed": False,
            "is_answered": None,
            "top_level_comment_count": 0,
            "reply_count": 0,
            "project_account_source_count": 1,
            "automation_source_count": 0,
            "unattributed_source_count": 0,
            "external_account_source_count": 0,
        },
        {
            "discussion_number": 10,
            "url": "https://github.com/Matawaka/uu-aap/discussions/10",
            "closed": False,
            "is_answered": None,
            "top_level_comment_count": 0,
            "reply_count": 0,
            "project_account_source_count": 1,
            "automation_source_count": 0,
            "unattributed_source_count": 0,
            "external_account_source_count": 0,
        },
    ]
    if discussion_receipt["discussion_observations"] != expected_discussion_observations:
        raise ValueError("Discussion observation metadata/count drift")

    if checkpoint["status"] != "NO_NEW_EXTERNAL_REVIEW_SOURCE_OBSERVED_ON_DECLARED_GITHUB_SURFACES":
        raise ValueError("combined checkpoint status drift")
    if checkpoint["covered_surfaces"] != EXPECTED_COVERED_SURFACES:
        raise ValueError("checkpoint covered-surface scope drift")
    if any(checkpoint["scope_limitations"].values()):
        raise ValueError("checkpoint overclaimed observation scope")
    for key, value in checkpoint["boundaries"].items():
        if key in {"admission_decision", "disposition_decision"}:
            if value != "NOT_MADE":
                raise ValueError(f"checkpoint made {key}")
        elif value:
            raise ValueError(f"checkpoint escalated boundary: {key}")
    if any(checkpoint["non_effects"].values()):
        raise ValueError("checkpoint claimed an external effect")

    if set(checkpoint["accepted_validator_bindings"]) != set(SOURCE_PATHS):
        raise ValueError("accepted validator binding key drift")
    for key, path in SOURCE_PATHS.items():
        expected = EXPECTED[key]
        if checkpoint["accepted_validator_bindings"][key] != expected:
            raise ValueError(f"checkpoint source binding drift: {key}")
        if verify_git:
            origin_blob = blob_at(ORIGIN, path)
            if origin_blob != expected:
                raise ValueError(f"accepted origin source drift: {path}: {origin_blob}")
            head_blob = blob_at("HEAD", path)
            if head_blob != expected:
                raise ValueError(f"accepted validator changed in checkpoint branch: {path}: {head_blob}")


def validate_files(checkpoint_path=CHECKPOINT_PATH, issue_path=ISSUE_RECEIPT_PATH, discussion_path=DISCUSSION_RECEIPT_PATH):
    checkpoint = json.loads(Path(checkpoint_path).read_text(encoding="utf-8"))
    issue_bytes = Path(issue_path).read_bytes()
    discussion_bytes = Path(discussion_path).read_bytes()
    validate_data(checkpoint, issue_bytes, discussion_bytes, verify_git=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=CHECKPOINT_PATH)
    parser.add_argument("--issue-receipt", type=Path, default=ISSUE_RECEIPT_PATH)
    parser.add_argument("--discussion-receipt", type=Path, default=DISCUSSION_RECEIPT_PATH)
    args = parser.parse_args()
    validate_files(args.checkpoint, args.issue_receipt, args.discussion_receipt)
    print("PUBLIC_REVIEW_OBSERVATION_CHECKPOINT_V0_1_VALID")


if __name__ == "__main__":
    main()
