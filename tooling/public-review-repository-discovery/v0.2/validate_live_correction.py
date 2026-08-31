#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
ORIGIN = "d2e2f3a813dd6ea853a45f2108a32d671a3e41d4"

EXPECTED_FAILING_BLOBS = {
    "collector_blob": ("tooling/public-review-repository-discovery/v0.2/collector.py", "69d1cbc5fbf45b7c2355b66a03f973b21e2900a3"),
    "test_collector_blob": ("tooling/public-review-repository-discovery/v0.2/test_collector.py", "9f2e1582cde0fa73a671b25de19546a661e4b4da"),
    "workflow_blob": (".github/workflows/public-review-repository-discovery-v0.2.yml", "0aa20d5f28fa11aaa647c6996deb534276099a0a"),
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def blob_at(ref: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"{ref}:{path}"], cwd=REPO_ROOT, text=True
    ).strip()


def main():
    receipt = load(HERE / "live-correction-receipt.json")
    if receipt["schema"] != "urn:uu-aap:public-review-repository-discovery-live-correction:0.2":
        raise ValueError("live correction schema drift")
    if receipt["correction_origin_frontier"] != ORIGIN:
        raise ValueError("live correction origin drift")

    for key, (path, expected_blob) in EXPECTED_FAILING_BLOBS.items():
        observed = blob_at(ORIGIN, path)
        if observed != expected_blob:
            raise ValueError(f"failing implementation source drift: {path}: {observed}")
        if receipt["failing_implementation_bindings"].get(key) != expected_blob:
            raise ValueError(f"receipt failing-source binding drift: {key}")

    failed = receipt["failed_post_merge_run"]
    if failed != {
        "run_id": 33370105262,
        "job_id": 99419020061,
        "workflow": "Public Review Repository Discovery v0.2",
        "failure_stage": "Perform live read-only repository discovery",
        "failure_class": "EXCLUDED_PR_CONVERSATION_COMMENT_RESOLVED_AS_ISSUE_REFERENCE",
        "exception": "ValueError: issue comment references unobserved issue 9",
    }:
        raise ValueError("failed live-run evidence drift")

    observed = receipt["observed_source_shape"]
    if observed != {
        "comment_id": 5379236889,
        "issue_number_field": 9,
        "comment_html_url": "https://github.com/Matawaka/uu-aap/pull/9#issuecomment-5379236889",
        "issue_9_html_url": "https://github.com/Matawaka/uu-aap/pull/9",
        "issue_9_object_class": "PULL_REQUEST",
        "classification": "EXCLUDED_PULL_REQUEST_COMMENT",
    }:
        raise ValueError("observed PR-comment source shape drift")

    rule = receipt["correction_rule"]
    if rule != {
        "pull_comment_html_prefix": "https://github.com/Matawaka/uu-aap/pull/",
        "pull_request_comment_excluded_before_issue_resolution": True,
        "issue_comment_html_prefix": "https://github.com/Matawaka/uu-aap/issues/",
        "unknown_real_issue_comment_still_fails_closed": True,
        "unexpected_comment_html_url_fails_closed": True,
        "source_scope_expanded": False,
    }:
        raise ValueError("correction rule drift")

    if any(receipt["non_effects"].values()):
        raise ValueError("live correction semantic/authority scope expanded")

    current_collector = (HERE / "collector.py").read_text(encoding="utf-8")
    required = [
        'return "PULL_REQUEST_COMMENT"',
        'return "ISSUE_COMMENT"',
        'surface_kind = comment_surface_kind(comment, repository)',
        'if surface_kind == "PULL_REQUEST_COMMENT":',
        'raise ValueError(f"issue comment references unobserved issue {number}")',
    ]
    for marker in required:
        if marker not in current_collector:
            raise ValueError(f"corrected collector missing marker: {marker}")

    print("PUBLIC_REVIEW_REPOSITORY_DISCOVERY_V0_2_LIVE_CORRECTION_BINDINGS_PASS")


if __name__ == "__main__":
    main()
