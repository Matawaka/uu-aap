#!/usr/bin/env python3
from pathlib import Path
import runner

HERE = Path(__file__).resolve().parent
REQUIRED_INVARIANTS = {
    "Reducer != Policy Oracle",
    "Computed State != Response Authority",
    "Persistent State != Persistent Authority",
    "Current Event Intent != Future Intent",
    "Pause Clears Pending Intent",
    "Resume Recall != Help Authority",
    "Hint Request != Solver Mode",
    "Solution Request != Persistent Solver Mode",
    "One Allowed Solution != Future Solution Authority",
    "State Digest != State Authority",
    "Synthetic Runner != Runtime Connectedness",
}


def main():
    readme = (HERE / "README.md").read_text()
    missing = sorted(x for x in REQUIRED_INVARIANTS if x not in readme)
    if missing:
        raise AssertionError(f"README missing invariants: {missing}")
    result, mutations = runner.self_validate()
    print(
        "session runner validation: PASS; "
        f"turns={len(result['transitions'])}; "
        f"fail_closed_mutations={mutations}; "
        f"final_state_digest={result['final_state_digest']}"
    )


if __name__ == "__main__":
    main()
