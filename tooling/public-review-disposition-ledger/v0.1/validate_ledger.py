#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LEDGER_PATH = HERE / "ledger.json"
SCHEMA_PATH = HERE / "ledger.schema.json"
IMPL_PATH = HERE / "implementation-receipt.json"
RESULT_PATH = ROOT / "pilots/core-pilot-002/run-001/result/v0.1/result.json"
STAGE_B_PATH = ROOT / "protocols/responsibility-status-provenance/v0.1/implementation-receipt.json"
STAGE_C_PATH = ROOT / "protocols/responsibility-assurance/v0.1/implementation-receipt.json"

ORIGIN = "1b662c46aecb7c2590905ca1ab5f3150c6e4d1d2"
RUN001 = "26bdda55acf6368726428184d8eed489dbc2c9ad"
STAGE_B = "5201cb686bcef52053e055595c2315c36aa1ec56"
STAGE_C = "967e026eac9de58753fc01934d7e6a431b9c973c"

EXPECTED = {
    "public_review_blob": "83cf9f1dacffcde3f030764f5fb0e6afe0fdb190",
    "result_blob": "edc9a7e4f26492d16875727e17188c5e2a486ced",
    "stage_b_blob": "3ecba920eb366c15c1c7555cb54dc8574e05a73b",
    "stage_c_blob": "d5316c2281f5927c76783235b1fa33c7a94d86f1",
    "source_body_sha256": "23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8",
    "decision_body_sha256": "d1137cb69f2445cbd9b5bba0d275898597275daa04fe66ba75be70533c3ff881",
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def git_blob(ref: str, path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"{ref}:{path}"], cwd=ROOT, text=True
    ).strip()


def validate_data(ledger: dict, result: dict, stage_b: dict, stage_c: dict, impl: dict, verify_git: bool = True):
    schema = load(SCHEMA_PATH)
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(ledger), key=lambda e: list(e.absolute_path))
    if errors:
        raise ValueError("ledger schema validation failed: " + errors[0].message)

    require(ledger["schema"] == "urn:uu-aap:public-review-disposition-ledger:0.1", "ledger schema drift")
    require(ledger["origin_frontier"] == ORIGIN, "origin frontier drift")
    require(ledger["public_review_binding"] == {"path": "PUBLIC_REVIEW.md", "blob": EXPECTED["public_review_blob"]}, "PUBLIC_REVIEW binding drift")
    require(len(ledger["entries"]) == 1, "v0.1 must contain exactly one accepted machine disposition entry")

    entry = ledger["entries"][0]
    require(entry["ledger_id"] == "core-pilot-002-run-001-issue-422-comment-5471862585", "ledger id drift")

    source = entry["source"]
    require(source["issue_number"] == 422, "source issue drift")
    require(source["comment_id"] == 5471862585, "source comment drift")
    require(source["url"] == "https://github.com/Matawaka/uu-aap/issues/422#issuecomment-5471862585", "source URL drift")
    require(source["body_sha256"] == EXPECTED["source_body_sha256"], "source body digest drift")

    machine = entry["machine_result"]
    require(machine["accepted_frontier"] == RUN001, "Run 001 accepted frontier drift")
    require(machine["path"] == "pilots/core-pilot-002/run-001/result/v0.1/result.json", "Run 001 path drift")
    require(machine["blob"] == EXPECTED["result_blob"], "Run 001 result blob drift")
    require(machine["result_class"] == result["interpretation"]["result_class"], "result class index drift")
    require(result["interpretation"]["result_class"] == "REPRESENTATION_PROVENANCE_GAP_CONFIRMED_WITH_EXISTING_DISPLAY_MITIGATION", "accepted result class drift")
    require(result["source_binding"]["comment_id"] == source["comment_id"], "result/source comment mismatch")
    require(result["source_binding"]["body_sha256"] == source["body_sha256"], "result/source digest mismatch")

    disposition = entry["disposition"]
    require(disposition["source_disposition_state"] == result["disposition"]["state"], "source disposition was reclassified")
    require(disposition["source_disposition_state"] == "accept_for_followup", "accepted source disposition drift")
    require(disposition["editorial_bucket"] is None, "ledger invented editorial accepted/rejected/deferred bucket")
    require(disposition["objection_preserved"] is True and result["disposition"]["objection_preserved"] is True, "objection preservation lost")
    require(disposition["normative_change_authorized"] is False and result["disposition"]["normative_change_authorized"] is False, "disposition promoted to normative authority")
    require(result["interpretation"]["accepted_as_truth"] is False, "Run 001 was promoted to truth")

    resolution = entry["normative_resolution"]
    require(resolution["decision_gate_issue"] == 852, "decision gate issue drift")
    require(resolution["decision_comment_id"] == 5474573197, "decision comment drift")
    require(resolution["decision_comment_body_sha256"] == EXPECTED["decision_body_sha256"], "decision comment digest drift")
    require(resolution["selected_sequence"] == "PHASED_B_PLUS_C", "human-selected sequence drift")
    require(resolution["implementation_status"] == "FOLLOWUP_IMPLEMENTED_PHASED_B_PLUS_C", "implementation status drift")

    b = resolution["stage_b"]
    c = resolution["stage_c"]
    require(b == {
        "accepted_frontier": STAGE_B,
        "path": "protocols/responsibility-status-provenance/v0.1/implementation-receipt.json",
        "implementation_receipt_blob": EXPECTED["stage_b_blob"],
    }, "Stage B index drift")
    require(c == {
        "accepted_frontier": STAGE_C,
        "path": "protocols/responsibility-assurance/v0.1/implementation-receipt.json",
        "implementation_receipt_blob": EXPECTED["stage_c_blob"],
    }, "Stage C index drift")

    for receipt, stage in ((stage_b, "B_OPTIONAL_MACHINE_NATIVE_PROVENANCE_BINDING"), (stage_c, "C_STRONGER_RESPONSIBILITY_ASSURANCE_PROFILE")):
        gate = receipt["human_design_gate"]
        require(gate["issue"] == 852, "successor decision issue drift")
        require(gate["decision_comment_id"] == 5474573197, "successor decision comment drift")
        require(gate["decision_comment_body_sha256"] == EXPECTED["decision_body_sha256"], "successor decision digest drift")
        require(gate["decision"] == "PHASED_B_PLUS_C", "successor decision class drift")
        require(gate["stage"] == stage, "successor stage drift")
        require(gate["decision_actor_identity_status"] == "NOT_ESTABLISHED_BY_REPOSITORY_RECORD", "decision record promoted to identity proof")

    require(stage_b["historical_bindings"]["run_001_result_blob"] == EXPECTED["result_blob"], "Stage B lost Run 001 binding")
    require(stage_c["historical_bindings"]["run_001_result_blob"] == EXPECTED["result_blob"], "Stage C lost Run 001 binding")
    require(stage_c["accepted_stage_b"]["merge_frontier"] == STAGE_B, "Stage C Stage B frontier drift")
    require(stage_c["accepted_stage_b"]["implementation_receipt_blob"] == EXPECTED["stage_b_blob"], "Stage C Stage B receipt drift")

    require(ledger["summary"] == {
        "entry_count": 1,
        "machine_disposition_count": 1,
        "accept_for_followup_count": 1,
        "broader_public_review_complete": False,
    }, "ledger summary drift")
    require(not any(ledger["boundaries"].values()), "ledger escalated identity/authority/truth/certification/release boundary")
    require(not any(ledger["non_effects"].values()), "ledger claimed an external or normative effect")

    bindings = impl["source_bindings"]
    require(impl["schema"] == "urn:uu-aap:public-review-disposition-ledger-implementation:0.1", "implementation receipt schema drift")
    require(impl["origin_frontier"] == ORIGIN, "implementation receipt origin drift")
    require(bindings["public_review_blob"] == EXPECTED["public_review_blob"], "implementation PUBLIC_REVIEW binding drift")
    require(bindings["run_001_accepted_frontier"] == RUN001 and bindings["run_001_result_blob"] == EXPECTED["result_blob"], "implementation Run 001 binding drift")
    require(bindings["stage_b_accepted_frontier"] == STAGE_B and bindings["stage_b_implementation_receipt_blob"] == EXPECTED["stage_b_blob"], "implementation Stage B binding drift")
    require(bindings["stage_c_accepted_frontier"] == STAGE_C and bindings["stage_c_implementation_receipt_blob"] == EXPECTED["stage_c_blob"], "implementation Stage C binding drift")
    require(bindings["decision_gate_issue"] == 852 and bindings["decision_comment_id"] == 5474573197 and bindings["decision_comment_body_sha256"] == EXPECTED["decision_body_sha256"], "implementation human decision binding drift")
    require(not any(impl["non_effects"].values()), "implementation receipt claimed an effect")
    require(impl["index_contract"]["creates_editorial_bucket"] is False, "implementation receipt authorizes editorial reclassification")
    require(impl["index_contract"]["broader_public_review_completed"] is False, "implementation receipt closes broader review")

    if verify_git:
        expected_paths = [
            (ORIGIN, "PUBLIC_REVIEW.md", EXPECTED["public_review_blob"]),
            (RUN001, "pilots/core-pilot-002/run-001/result/v0.1/result.json", EXPECTED["result_blob"]),
            (STAGE_B, "protocols/responsibility-status-provenance/v0.1/implementation-receipt.json", EXPECTED["stage_b_blob"]),
            (STAGE_C, "protocols/responsibility-assurance/v0.1/implementation-receipt.json", EXPECTED["stage_c_blob"]),
        ]
        for ref, path, expected in expected_paths:
            require(git_blob(ref, path) == expected, f"accepted historical blob drift: {path}")
            require(git_blob("HEAD", path) == expected, f"accepted indexed input changed in ledger branch: {path}")
        public_review = (ROOT / "PUBLIC_REVIEW.md").read_text(encoding="utf-8")
        require("- an issue disposition table;" in public_review, "PUBLIC_REVIEW expected disposition output missing")
        require("A review disposition MUST NOT silently erase the original objection" in public_review, "PUBLIC_REVIEW disposition boundary missing")


def validate_files(ledger_path=LEDGER_PATH):
    validate_data(
        json.loads(Path(ledger_path).read_text(encoding="utf-8")),
        load(RESULT_PATH),
        load(STAGE_B_PATH),
        load(STAGE_C_PATH),
        load(IMPL_PATH),
        verify_git=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", type=Path, default=LEDGER_PATH)
    args = parser.parse_args()
    validate_files(args.ledger)
    print("PUBLIC_REVIEW_DISPOSITION_LEDGER_V0_1_VALID")


if __name__ == "__main__":
    main()
