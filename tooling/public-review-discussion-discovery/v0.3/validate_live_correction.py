#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
ORIGIN = "abc32846b0287d7997f63535aa11749a697313ea"

EXPECTED_FAILING_BLOBS = {
    "collector_blob": (
        "tooling/public-review-discussion-discovery/v0.3/collector.py",
        "da8bdf5dc9bbd8befcfa304e36bb6110ef7e1cd8",
    ),
    "receipt_schema_blob": (
        "tooling/public-review-discussion-discovery/v0.3/receipt.schema.json",
        "4db52a548292de3694a7d90656a4468f94121215",
    ),
    "test_collector_blob": (
        "tooling/public-review-discussion-discovery/v0.3/test_collector.py",
        "eb6a24775e02845b01e8a9556464f8f4f08112be",
    ),
    "workflow_blob": (
        ".github/workflows/public-review-discussion-discovery-v0.3.yml",
        "6f5e42493c3661299e0bd91b2120a1c4118c5e9f",
    ),
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def blob_at(ref: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"{ref}:{path}"], cwd=REPO_ROOT, text=True
    ).strip()


def require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def main():
    receipt = load(HERE / "live-correction-receipt.json")
    require(
        receipt["schema"] == "urn:uu-aap:public-review-discussion-discovery-live-correction:0.3",
        "live correction schema drift",
    )
    require(receipt["correction_origin_frontier"] == ORIGIN, "live correction origin drift")

    bindings = receipt["failing_implementation_bindings"]
    require(set(bindings) == set(EXPECTED_FAILING_BLOBS), "failing binding key drift")
    for key, (path, expected_blob) in EXPECTED_FAILING_BLOBS.items():
        observed = blob_at(ORIGIN, path)
        require(observed == expected_blob, f"failing implementation source drift: {path}: {observed}")
        require(bindings[key] == expected_blob, f"receipt failing-source binding drift: {key}")

    require(
        receipt["failed_post_merge_run"]
        == {
            "run_id": 33372285062,
            "job_id": 99425877682,
            "workflow": "Public Review Discussion Discovery v0.3",
            "failure_stage": "Perform live read-only Discussion discovery",
            "failure_class": "NULLABLE_GITHUB_IS_ANSWERED_REJECTED_AS_INVALID",
            "exception": "ValueError: Discussion #8 answered state invalid",
        },
        "failed live-run evidence drift",
    )

    require(
        receipt["observed_live_shape"]
        == {
            "discussion_number": 8,
            "graphql_field": "isAnswered",
            "observed_value": None,
            "observed_value_class": "NULLABLE_GITHUB_METADATA",
            "classification": "GITHUB_METADATA_NULL_NOT_PROTOCOL_DISPOSITION",
        },
        "observed nullable metadata binding drift",
    )

    require(
        receipt["correction_rule"]
        == {
            "null_is_preserved_as_null": True,
            "boolean_true_is_preserved": True,
            "boolean_false_is_preserved": True,
            "string_or_numeric_answer_state_is_rejected": True,
            "null_is_coerced_to_false": False,
            "github_answer_state_is_protocol_disposition": False,
            "discussion_scope_expanded": False,
        },
        "nullable answer correction rule drift",
    )
    require(all(value is False for value in receipt["non_effects"].values()), "correction expanded semantic/authority scope")

    schema_text = (HERE / "receipt.schema.json").read_text(encoding="utf-8")
    collector_text = (HERE / "collector.py").read_text(encoding="utf-8")
    tests_text = (HERE / "test_collector.py").read_text(encoding="utf-8")

    require(
        '"is_answered": {"type": ["boolean", "null"]}' in schema_text,
        "corrected schema does not preserve nullable answer metadata",
    )
    for marker in (
        'answer_state = discussion.get("isAnswered")',
        'if answer_state is not None and not isinstance(answer_state, bool):',
        '"is_answered": answer_state,',
        '"github_answer_state_is_protocol_disposition": False,',
    ):
        require(marker in collector_text, f"corrected collector missing marker: {marker}")
    for marker in (
        "is_answered=None",
        'assert fetched["isAnswered"] is None',
        'assert receipt["discussion_observations"][0]["is_answered"] is None',
        'bad_answer["isAnswered"] = "false"',
        "nullable_answer=PASS",
    ):
        require(marker in tests_text, f"corrected tests missing marker: {marker}")

    print("PUBLIC_REVIEW_DISCUSSION_DISCOVERY_V0_3_NULLABLE_ANSWER_CORRECTION_BINDINGS_PASS")


if __name__ == "__main__":
    main()
