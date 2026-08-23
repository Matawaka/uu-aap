"""Read-only local assessor for an isolated parallel branch.

The script uses Git read commands only. It never fetches, writes files, updates
refs, pushes, opens pull requests, merges, tags, releases, or invokes external
execution. Output is JSON on stdout so a human or later review step can inspect
branch relation and path isolation before any integration decision.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[4]


def git(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def classify(base: str, main_ref: str, head_ref: str) -> dict:
    main_sha = git("rev-parse", main_ref)
    head_sha = git("rev-parse", head_ref)
    merge_base = git("merge-base", main_ref, head_ref)

    if main_sha == head_sha:
        relation = "same-state"
    elif merge_base == head_sha:
        relation = "parallel-behind-main"
    elif merge_base == main_sha:
        relation = "parallel-ahead-of-main"
    else:
        relation = "diverged"

    diff_lines = [
        line for line in git("diff", "--name-status", f"{base}..{head_ref}").splitlines()
        if line
    ]
    changes = []
    for line in diff_lines:
        status, path = line.split("\t", 1)
        changes.append({"status": status, "path": path})

    return {
        "document_type": "uu-aap.parallel-evolution-observation",
        "version": "0.1",
        "status": "non-normative-read-only-observation",
        "declared_base_sha": base,
        "main_ref": main_ref,
        "main_sha": main_sha,
        "parallel_ref": head_ref,
        "parallel_sha": head_sha,
        "merge_base_sha": merge_base,
        "relation": relation,
        "baseline_is_merge_base": merge_base == base,
        "all_parallel_changes_additive": all(change["status"] == "A" for change in changes),
        "changes": changes,
        "authority_effect": "none",
        "integration_authorization_derived": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Exact declared side-track base SHA")
    parser.add_argument("--main-ref", default="main")
    parser.add_argument("--head-ref", default="HEAD")
    args = parser.parse_args()

    print(json.dumps(classify(args.base, args.main_ref, args.head_ref), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
