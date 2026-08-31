#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]

EXPECTED = {
    "v0_1_collector_blob": ("tooling/public-review-intake-observation/v0.1/collector.py", "91ce1cc830384c2c7757b047dc7cec951201cb41"),
    "v0_1_receipt_schema_blob": ("tooling/public-review-intake-observation/v0.1/receipt.schema.json", "d8e06c6d6cdd17c7e82fca14d6238319843f735e"),
    "v0_1_surfaces_blob": ("tooling/public-review-intake-observation/v0.1/surfaces.json", "3b7109b7760b38f2c62288c0517579dad3cdd06b"),
    "v0_1_implementation_receipt_blob": ("tooling/public-review-intake-observation/v0.1/implementation-receipt.json", "c4b1a9855fcfda5899f36d23bd757376376338fd"),
    "v0_1_workflow_blob": (".github/workflows/public-review-intake-observation-v0.1.yml", "4b2ab0649c966dcadc247638b2f6d65df3834498"),
    "run_001_result_blob": ("pilots/core-pilot-002/run-001/result/v0.1/result.json", "edc9a7e4f26492d16875727e17188c5e2a486ced"),
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def blob_at(ref: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"{ref}:{path}"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()


def main():
    receipt = load(HERE / "implementation-receipt.json")
    policy = load(HERE / "policy.json")

    if receipt["schema"] != "urn:uu-aap:public-review-repository-discovery-implementation:0.2":
        raise ValueError("implementation schema drift")
    origin = receipt["origin_frontier"]
    if origin != "391bc0820e9c17b4b9dde3271640ce52d39149d8":
        raise ValueError("origin frontier drift")

    for key, (path, expected_blob) in EXPECTED.items():
        observed = blob_at(origin, path)
        if observed != expected_blob:
            raise ValueError(f"origin source binding drift: {path}: {observed}")
        if receipt["source_bindings"].get(key) != expected_blob:
            raise ValueError(f"implementation receipt source binding drift: {key}")

    historical = receipt["historical_external_source_binding"]
    if historical != {
        "issue_number": 422,
        "comment_id": 5471862585,
        "source_account_identifier": "84dnnvbdvp-debug",
        "body_sha256": "23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8",
        "accepted_lineage": ["#845", "#846", "#849"],
        "classification": "KNOWN_HISTORICAL_EXTERNAL_SOURCE",
    }:
        raise ValueError("historical external source binding drift")

    registry = policy["known_historical_external_sources"]
    if len(registry) != 1:
        raise ValueError("historical source registry size drift")
    source = registry[0]
    if (
        source["source_kind"] != "ISSUE_COMMENT"
        or source["issue_number"] != historical["issue_number"]
        or source["source_id"] != historical["comment_id"]
        or source["author_account_identifier"] != historical["source_account_identifier"]
        or source["body_sha256"] != historical["body_sha256"]
        or source["accepted_lineage"] != historical["accepted_lineage"]
    ):
        raise ValueError("policy historical source does not match implementation receipt")

    if policy["included_channels"] != ["issue_bodies", "issue_comments"]:
        raise ValueError("included channel scope drift")
    if policy["excluded_channels"] != [
        "pull_requests",
        "pull_request_comments",
        "discussions",
        "commit_comments",
        "email",
        "social_media",
    ]:
        raise ValueError("excluded channel scope drift")
    if policy["issue_states"] != ["open", "closed"]:
        raise ValueError("issue state scope drift")

    runtime = policy["runtime"]
    if runtime != {
        "read_only": True,
        "scheduled_polling": False,
        "automatic_admission": False,
        "automatic_disposition": False,
        "accepted_push_live_discovery": True,
        "manual_live_discovery": True,
    }:
        raise ValueError("runtime boundary drift")

    if receipt["scope"]["pull_requests"] or receipt["scope"]["pull_request_comments"]:
        raise ValueError("PR channel unexpectedly included")
    if receipt["scope"]["discussions"] or receipt["scope"]["commit_comments"]:
        raise ValueError("non-issue GitHub channel unexpectedly included")
    if not receipt["scope"]["read_only"]:
        raise ValueError("read-only scope lost")
    if receipt["scope"]["automatic_admission"] or receipt["scope"]["automatic_disposition"]:
        raise ValueError("decision authority introduced")
    if receipt["scope"]["scheduled_polling"]:
        raise ValueError("recurring schedule introduced")

    if any(receipt["non_effects"].values()):
        raise ValueError("implementation receipt external effect escalated")

    boundaries = receipt["classification_boundaries"]
    if boundaries["different_account_proves_human_identity"]:
        raise ValueError("identity escalation")
    if boundaries["different_account_proves_independence"]:
        raise ValueError("independence escalation")
    if boundaries["author_association_proves_standing_or_authority"]:
        raise ValueError("standing/authority escalation")
    if boundaries["source_presence_proves_relevance"] or boundaries["source_presence_proves_truth"]:
        raise ValueError("relevance/truth escalation")
    if boundaries["known_historical_source_is_new_source"]:
        raise ValueError("historical source rediscovery enabled")

    print("PUBLIC_REVIEW_REPOSITORY_DISCOVERY_V0_2_IMPLEMENTATION_BINDINGS_PASS")


if __name__ == "__main__":
    main()
