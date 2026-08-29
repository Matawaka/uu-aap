# MarketCloser Real Review Local Run Revalidation v0.1

This layer is the last fail-closed gate before any future real-review local stress-test invocation.

It does **not** run the stress-test.

## Origin

- repository: `Matawaka/uu-aap`
- origin revision: `72f6ea7185b75ecf6ca459c8f88c8c613f3ae968`
- origin tree: `4610936795b5726eb074d4b0431e6d5b919e0d13`

## Sequence

```text
one-shot MarketCloser Run Permit
-> exact permit-materialization source revalidation
-> exact current repository frontier observation
-> permit currentness check
-> canonical PoAI Authority Verification Result validation
-> scope / target / subject / freshness checks
-> exact bridge + Marketer candidate binding
-> MarketCloserRealReviewLocalRunRevalidationReceipt
-> LOCAL_RUN_READY | STOP
```

A ready receipt only permits handoff to a later Real Stress-Test Adapter.

## Historical synthetic boundary

The original Marketer Pessimist Local MVP remains `synthetic_only`.

This layer deliberately does not import or invoke:

```text
products/marketer-pessimist/v0.1/local-mvp/stress-test.js
```

and never relabels a real source as synthetic.

```text
Real Candidate != Synthetic Local MVP Input
Revalidation Ready != Stress-Test Executed
```

## Authority revalidation assurance level

The layer reuses the canonical:

```text
PoAIAuthorityVerificationResult
```

through `AuthorityCore.validateVerificationResult()` and rechecks exact scope, target, subject, established status, root-policy acceptance, issuer entitlement, non-future time and a bounded freshness window.

It does **not** claim to replay the original root/grant chain from a verification result alone.

```text
Verification Result Revalidated != Original Grant Chain Re-executed
```

## Permit checks

A positive path requires one exact permit with:

```text
one_shot = true
max_invocations = 1
remaining_invocations = 1
consumed = false
operation = marketer-pessimist.real-review.stress-test.v0.1
```

The permit must reproduce exactly from its source materialization input.

A permit whose candidate, bridge, authority or run binding has been changed fails closed even when the mutated permit's own content hash is recomputed.

## Frontier checks

The observed frontier immediately before handoff must match the permit execution frontier exactly:

```text
repository
revision
tree
```

and the permit must still be inside its validity interval.

```text
Permit Possession != Current Preconditions
Main Changed != Permit Still Current
```

## Classifications

```text
PERMIT_REQUIRED
PERMIT_INVALID
PERMIT_EXPIRED
PERMIT_FRONTIER_STALE
PERMIT_ALREADY_CONSUMED
PERMIT_INVOCATION_COUNT_INVALID
AUTHORITY_REVALIDATION_FAILED
CANDIDATE_BINDING_MISMATCH
SYNTHETIC_LOCAL_RUN_READY
REAL_LOCAL_RUN_READY
```

Only the final two are ready states.

## Committed fixture

The repository commits only a non-ready fixture that references the merged non-issuable permit materialization input.

Expected result:

```text
PERMIT_REQUIRED
local_run_ready = false
stress_test_run = false
```

No ready permit is committed.

## Positive conformance

Tests construct a temporary synthetic authority chain and permit entirely in `/tmp`:

```text
synthetic contractual root
-> canonical AuthorityCore verification
-> synthetic positive authority gate
-> synthetic one-shot run permit
-> current frontier revalidation
-> SYNTHETIC_LOCAL_RUN_READY
```

The test then exercises consumed, multi-use, expiry, stale-frontier, candidate-substitution, stale-authority and invalid-permit cases.

## Invariants

```text
Permit Possession != Current Preconditions
Authority Previously Verified != Authority Still Current
Main Changed != Permit Still Current
Revalidation Ready != Stress-Test Executed
Real Candidate != Synthetic Local MVP Input
Run Permit != PilotPermit
Run Permit != ActionPermit
Local Run Ready != Publication Authority
Consumed Permit != Retry Permission
Successful Revalidation != Successor Authority
```

## Non-effects

This layer performs no:

- real stress-test run;
- Marketer Pessimist Local MVP invocation;
- provider call;
- network access;
- filesystem write in production runtime;
- platform mutation;
- response generation/publication;
- campaign action;
- PilotPermit or ActionPermit creation;
- external execution/effect;
- successor authority creation.

## CLI

Allowed:

```text
validate
receipt
help
```

There is no `run`, `stress-test`, `execute`, `publish`, `send` or `mutate` command.

## Next safe action

A ready receipt points only to:

```text
REAL_STRESS_TEST_ADAPTER_REQUIRED
```

The adapter must remain a separate successor so that the synthetic-only Local MVP contract is not silently widened.
