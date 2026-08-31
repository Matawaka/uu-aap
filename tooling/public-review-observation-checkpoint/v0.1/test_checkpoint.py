#!/usr/bin/env python3
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("checkpoint_validator", HERE / "validate_checkpoint.py")
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def must_reject(label, checkpoint, issue_bytes, discussion_bytes):
    try:
        mod.validate_data(checkpoint, issue_bytes, discussion_bytes, verify_git=False)
    except (ValueError, RuntimeError):
        return
    raise AssertionError(f"hostile checkpoint case accepted: {label}")


def main():
    checkpoint = json.loads((HERE / "checkpoint.json").read_text(encoding="utf-8"))
    issue_bytes = (HERE / "repository-issues-live-receipt.json").read_bytes()
    discussion_bytes = (HERE / "declared-discussions-live-receipt.json").read_bytes()
    mod.validate_data(checkpoint, issue_bytes, discussion_bytes, verify_git=False)

    hostiles = []
    x = copy.deepcopy(checkpoint); x["status"] = "NO_EXTERNAL_REVIEW_EXISTS_ANYWHERE"; hostiles.append(("global status escalation", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["scope_limitations"]["global_external_review_absence_proven"] = True; hostiles.append(("global absence", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["scope_limitations"]["future_external_review_absence_proven"] = True; hostiles.append(("future absence", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["scope_limitations"]["all_possible_github_surfaces_observed"] = True; hostiles.append(("all GitHub surfaces", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["scope_limitations"]["actions_artifact_is_producer_authentication"] = True; hostiles.append(("artifact producer auth", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["boundaries"]["external_validation_established"] = True; hostiles.append(("external validation", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["boundaries"]["claim_truth_established"] = True; hostiles.append(("truth escalation", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["boundaries"]["admission_decision"] = "ADMIT"; hostiles.append(("admission", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["boundaries"]["disposition_decision"] = "ACCEPT"; hostiles.append(("disposition", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["non_effects"]["release_or_tag_created"] = True; hostiles.append(("release effect", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["covered_surfaces"]["github_discussions"]["all_repository_discussions"] = True; hostiles.append(("Discussion scope expansion", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["covered_surfaces"]["github_discussions"]["discussion_numbers"] = [8, 10, 12]; hostiles.append(("Discussion target expansion", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["retained_receipts"]["repository_issue_discovery"]["sha256"] = "0" * 64; hostiles.append(("issue digest metadata drift", x, issue_bytes, discussion_bytes))
    x = copy.deepcopy(checkpoint); x["retained_receipts"]["declared_discussion_discovery"]["source_artifact_zip_sha256"] = "0" * 64; hostiles.append(("Discussion artifact digest drift", x, issue_bytes, discussion_bytes))
    hostiles.append(("issue retained byte drift", copy.deepcopy(checkpoint), issue_bytes + b" ", discussion_bytes))
    hostiles.append(("Discussion retained byte drift", copy.deepcopy(checkpoint), issue_bytes, discussion_bytes + b" "))

    issue_obj = json.loads(issue_bytes.decode("utf-8"))
    issue_obj["known_historical_external_sources"][0]["body_sha256"] = "0" * 64
    mutated_issue = (json.dumps(issue_obj, indent=2) + "\n").encode("utf-8")
    x = copy.deepcopy(checkpoint); x["retained_receipts"]["repository_issue_discovery"]["sha256"] = hashlib.sha256(mutated_issue).hexdigest()
    hostiles.append(("historical source rewrite", x, mutated_issue, discussion_bytes))

    discussion_obj = json.loads(discussion_bytes.decode("utf-8"))
    discussion_obj["discussion_observations"][0]["external_account_source_count"] = 1
    mutated_discussion = (json.dumps(discussion_obj, indent=2) + "\n").encode("utf-8")
    x = copy.deepcopy(checkpoint); x["retained_receipts"]["declared_discussion_discovery"]["sha256"] = hashlib.sha256(mutated_discussion).hexdigest()
    hostiles.append(("Discussion source-count rewrite", x, issue_bytes, mutated_discussion))

    for label, cp, ib, db in hostiles:
        must_reject(label, cp, ib, db)

    print(f"PUBLIC_REVIEW_OBSERVATION_CHECKPOINT_V0_1_TESTS_PASS hostile={len(hostiles)}")


if __name__ == "__main__":
    main()
