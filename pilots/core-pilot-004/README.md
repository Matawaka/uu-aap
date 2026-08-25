# Core Pilot 004 — Single-Use External Effect Permit

**Status:** specification / synthetic pre-execution  
**Related:** Issue #433  
**Origin frontier:** `5c39351a9c10d82befd30018c9c5915c70e88ae4`

## Purpose

Test whether an autonomous agent can perform exactly one bounded external GitHub effect under an explicit human-authorized permit without gaining reusable authority.

```text
Human authority
  -> exact single-use permit
  -> precondition revalidation
  -> one external effect
  -> observed result
  -> provenance receipt
  -> permit consumed
```

## Primary invariants

```text
authorized effect == executed effect
single-use permit != reusable authority
successful effect != successor permit
capability != permission
permit possession != permission to change target/body/scope
stale precondition != executable permit
```

## Permit dimensions

A permit MUST bind at least:

- permit id and run id;
- exact repository;
- exact effect type;
- exact target resource;
- exact effect payload and payload digest;
- expected pre-state;
- exact canonical frontier observed before execution;
- explicit human authorization;
- expiry;
- single-use semantics;
- allowed effects and forbidden effects;
- postcondition expectations;
- consumed/not-consumed state;
- explicit prohibition on successor permit creation.

Changing any of these dimensions creates a different action and requires a different permit.

## First real-run shape

The intended low-risk Run 001 is one predetermined comment on one dedicated pilot issue.

The run permit will bind:

- `Matawaka/uu-aap`;
- one exact issue number;
- `issue_comment_create` as the only allowed external mutation;
- one exact UTF-8 comment body and its SHA-256 digest;
- expected issue state `open`;
- exact canonical `main` frontier at materialization;
- short expiry;
- `single_use=true`;
- `max_effect_count=1`.

The agent must re-observe the target immediately before execution. If target state, frontier, payload digest, expiry or permit-consumption state does not match, execution MUST fail closed.

## Synthetic specification fixture

The fixture in this directory is NOT an executable permit. It uses `execution_authorized=false` and exists only to test validation logic.

## Fail-closed requirements

Validation rejects at least:

- repository substitution;
- target issue substitution;
- effect type substitution;
- body or digest mismatch;
- multi-use or reusable permit;
- expired permit;
- mismatched canonical frontier;
- missing human authorization;
- issue-state precondition mismatch;
- additional allowed external side effect;
- removed forbidden effect;
- execution receipt reporting more than one effect;
- execution receipt not matching the exact authorized effect;
- outcome creating a successor permit;
- permit marked consumed before execution or left reusable after success.

## Execution boundary

Merging this specification does not authorize a GitHub write.

A real external effect requires a separately materialized Run 001 permit with `execution_authorized=true` and an explicit human approval for that exact permit. No KONTUR effect, release/tag, push/merge, permission/secret/protection change, authority transfer or unrelated GitHub mutation is authorized by this pilot specification.
