#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
RECEIPT_PATH = HERE / "implementation-receipt.json"
POLICY_PATH = HERE / "policy.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def git_blob(commit: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"{commit}:{path}"], text=True
    ).strip()


def git_text(commit: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"{commit}:{path}"], text=True
    )


def require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def main():
    receipt = load_json(RECEIPT_PATH)
    policy = load_json(POLICY_PATH)

    require(receipt["schema"] == "urn:uu-aap:public-review-discussion-discovery-implementation:0.3", "implementation schema drift")
    origin = receipt["origin_frontier"]
    require(origin == "bef77bddd4fa6430bb16f14e52f1d5fee1aeb786", "origin frontier drift")

    expected_paths = {
        "public_review_blob": "PUBLIC_REVIEW.md",
        "poai_readme_blob": "proposals/poai/README.md",
        "v0_2_policy_blob": "tooling/public-review-repository-discovery/v0.2/policy.json",
        "v0_2_collector_blob": "tooling/public-review-repository-discovery/v0.2/collector.py",
        "v0_2_implementation_receipt_blob": "tooling/public-review-repository-discovery/v0.2/implementation-receipt.json",
        "v0_2_live_correction_receipt_blob": "tooling/public-review-repository-discovery/v0.2/live-correction-receipt.json",
        "v0_2_workflow_blob": ".github/workflows/public-review-repository-discovery-v0.2.yml",
    }
    bindings = receipt["source_bindings"]
    require(set(bindings) == set(expected_paths), "source binding key drift")
    for key, path in expected_paths.items():
        actual = git_blob(origin, path)
        require(actual == bindings[key], f"historical source binding drift: {key}")

    public_review = git_text(origin, "PUBLIC_REVIEW.md")
    poai_readme = git_text(origin, "proposals/poai/README.md")
    require(
        "https://github.com/Matawaka/uu-aap/discussions/8" in public_review,
        "PUBLIC_REVIEW.md no longer binds Discussion #8",
    )
    require(
        "https://github.com/Matawaka/uu-aap/discussions/10" in poai_readme,
        "PoAI README no longer binds Discussion #10",
    )

    v02_policy = json.loads(git_text(origin, "tooling/public-review-repository-discovery/v0.2/policy.json"))
    require("discussions" in v02_policy["excluded_channels"], "accepted v0.2 did not exclude Discussions")
    v02_receipt = json.loads(git_text(origin, "tooling/public-review-repository-discovery/v0.2/implementation-receipt.json"))
    require(v02_receipt["scope"]["discussions"] is False, "accepted v0.2 Discussion scope changed")

    require(policy["repository"] == "Matawaka/uu-aap", "policy repository drift")
    require(policy["project_account_identifier"] == "Matawaka", "project account drift")
    require(policy["target_discussion_numbers"] == [8, 10], "Discussion target scope drift")
    require(
        policy["included_source_kinds"] == ["DISCUSSION_BODY", "DISCUSSION_COMMENT", "DISCUSSION_REPLY"],
        "source kind scope drift",
    )
    require(policy["runtime"]["read_only"] is True, "read-only boundary lost")
    require(policy["runtime"]["scheduled_polling"] is False, "scheduled polling introduced")
    require(policy["runtime"]["automatic_admission"] is False, "automatic admission introduced")
    require(policy["runtime"]["automatic_disposition"] is False, "automatic disposition introduced")
    require(policy["runtime"]["graphql_endpoint"] == "https://api.github.com/graphql", "GraphQL endpoint drift")

    scope = receipt["scope"]
    require(scope["target_discussion_numbers"] == [8, 10], "receipt target scope drift")
    require(scope["discussion_body"] is True, "discussion body observation missing")
    require(scope["top_level_comments"] is True, "comment observation missing")
    require(scope["comment_replies"] is True, "reply observation missing")
    require(scope["other_discussions"] is False, "other Discussions were admitted into scope")
    require(scope["read_only"] is True, "receipt read-only boundary lost")
    require(scope["automatic_admission"] is False, "receipt automatic admission drift")
    require(scope["automatic_disposition"] is False, "receipt automatic disposition drift")
    require(scope["scheduled_polling"] is False, "receipt schedule drift")

    boundaries = receipt["classification_boundaries"]
    for key in (
        "project_account_is_external_source",
        "bot_account_is_external_source",
        "missing_account_is_external_account_source",
        "different_account_proves_human_identity",
        "different_account_proves_independence",
        "author_association_proves_standing_or_authority",
        "source_presence_proves_relevance",
        "source_presence_proves_truth",
        "github_answer_state_is_protocol_disposition",
    ):
        require(boundaries[key] is False, f"classification boundary escalated: {key}")
    require(
        boundaries["different_account_is_external_account_source_candidate"] is True,
        "external-account observation classification removed",
    )

    require(all(value is False for value in receipt["non_effects"].values()), "implementation receipt claims an external effect")

    print("PUBLIC_REVIEW_DISCUSSION_DISCOVERY_V0_3_IMPLEMENTATION_BINDINGS_PASS")


if __name__ == "__main__":
    main()
