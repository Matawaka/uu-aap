#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

spec = importlib.util.spec_from_file_location("qualify", HERE / "qualify.py")
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


def expect_fail(fn, needle):
    try:
        fn()
    except ValueError as exc:
        assert needle in str(exc), (needle, str(exc))
    else:
        raise AssertionError(f"expected failure containing {needle!r}")


def main():
    p = json.loads((HERE / "profile.json").read_text())
    q.validate_profile(p)

    bad = json.loads(json.dumps(p))
    bad["candidate"]["commit"] = "0" * 40
    expect_fail(lambda: q.validate_profile(bad), "candidate exact target drift")

    bad = json.loads(json.dumps(p))
    bad["candidate"]["authenticated_policy_object"] = True
    expect_fail(lambda: q.validate_profile(bad), "policy capability promoted")

    payload = b"abc"
    assert q.git_blob(payload) == "f2ba8f84ab5c1bce84a7b441cb1959cfc7093b7f"

    required = {
        "global_non_equivocation_proven",
        "producer_non_equivocation_proven",
        "submission_completeness_proven",
        "trusted_universal_time_proven",
        "witness_independence_proven",
        "truth_certified",
        "authority_created",
    }
    assert required.issubset(set(p["always_false_claims"]))

    print("CRYPTOVALID_C2SP_QUALIFICATION_HOSTILE_TESTS: PASS")


if __name__ == "__main__":
    main()
