# MarketCloser Real Review Run Permit Materialization v0.1

**Status:** experimental Phase E local-analysis permit boundary  
**Issue:** #615  
**Origin frontier:** `87714d88146ff88bc0bddddde84b99b26a639e2c`  
**Origin tree:** `d305e58633c87832895791232f34ecb399de487f`

## Purpose

This layer materializes a **single-use local analysis permit** only after the merged MarketCloser Real Review Run Authority Gate has already established matching application-scoped authority.

It does not run the analysis.

```text
positive Real Review Run Authority Gate
-> observe exact execution frontier
-> materialize exact one-shot local Run Permit
-> pre-run frontier + authority revalidation
-> STOP
```

## Run Permit is not an action permit

The permit authorizes only one local, read-only analytical invocation for one exact minimized Marketer Pessimist candidate.

```text
Run Permit != PilotPermit
Run Permit != ActionPermit
Local Analysis Permission != External Effect Permission
```

The permitted operation is fixed:

```text
marketer-pessimist.real-review.stress-test.v0.1
```

Unavailable by construction:

- network access;
- filesystem writes by the permitted analysis;
- provider invocation;
- platform mutation;
- response publication;
- campaign activity;
- PilotPermit creation;
- ActionPermit creation;
- external execution;
- external effect.

## Historical origin versus execution frontier

The permit specification has an immutable historical origin:

```text
87714d88146ff88bc0bddddde84b99b26a639e2c
```

A concrete permit separately binds an execution frontier observed immediately before local materialization.

```text
permit origin != execution frontier
```

A real permit must not be committed into canonical Git history merely to preserve it. Doing so would advance `main` and could make the permit stale against its own execution target.

Therefore:

```text
committed real permit -> moves main -> may self-stale target
```

Real permits are materialized locally/outside canonical history after observing the current frontier.

## One-shot boundary

Every permit fixes:

```text
one_shot = true
max_invocations = 1
remaining_invocations = 1
consumed = false
```

The requested validity window is bounded to at most 3600 seconds.

Permit consumption is not represented by mutating the permit in place. A later run layer must create a separate successor receipt.

```text
One-Shot Permit != Reusable Authority
Consumed Permit != Retry Permission
```

## Authority binding

`permit.js` re-runs the exact merged authority gate input through the merged authority-gate runtime.

It does not accept:

```text
authority_verified=true
permit_ready=true
human_approved=true
```

as standalone booleans.

A permit can be created only if the derived gate receipt is one of:

```text
SYNTHETIC_AUTHORITY_CONFORMANCE_READY
AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED
```

and the gate says:

```text
authority_verified = true
run_permit_created = false
```

The permit then binds:

- exact gate input hash;
- exact authority-gate receipt hash;
- exact application scope and target;
- authority verification identifier;
- exact minimized bridge receipt hash;
- exact Marketer candidate id/hash;
- exact execution frontier;
- exact run id and operation.

## Committed fixture

The repository fixture:

```text
examples/synthetic-permit-wait.input.json
```

points to the committed authority-wait fixture from #614.

Its expected decision is:

```text
AUTHORITY_NOT_READY_PERMIT_NOT_CREATED
permit_created = false
```

No committed file claims a real or synthetic positive authority result for permit issuance.

## Positive conformance

`test-permit.js` creates a synthetic contractual authority root and grant **in memory**, using the canonical PoAI Authority Core.

The synthetic authority input is written only to `/tmp` for the duration of CI. From it the test materializes a synthetic one-shot permit and checks:

- one invocation only;
- unconsumed state;
- bounded validity;
- no external capabilities;
- frontier revalidation required;
- authority revalidation required;
- stale frontier rejection;
- expiration rejection;
- operation expansion rejection;
- multi-use rejection.

`test-receipt-binding.js` additionally proves that a self-consistent permit with a substituted Marketer candidate hash does not remain bound to the exact materialization input.

## Currentness

A permit does not prove that its execution frontier is still current at run time.

`evaluateCurrentness()` distinguishes:

```text
PERMIT_EXPIRED
PERMIT_FRONTIER_STALE
PERMIT_FRONTIER_TIME_INVALID
PERMIT_FRONTIER_CURRENT_AUTHORITY_REVALIDATION_REQUIRED
```

Even the last state still requires authority revalidation before analysis.

```text
Permit Possession != Current Preconditions
Main Changed != Permit Still Current
```

## CLI

Available commands:

```text
validate
 decision
materialize
help
```

`materialize` emits only a permit artifact to stdout. It does not execute the stress-test.

The committed authority-wait fixture must fail closed for `materialize` because its authority gate is not positive.

## Non-effects

```text
Permit Materialized != Stress-Test Run
Successful Analysis != Publication Authority
```

This layer performs no provider/network/platform call, publishes nothing, mutates no authority root, creates no live authority grant, does not run Marketer Pessimist and creates no PilotPermit or ActionPermit.

## Next safe action

A positive permit stops at:

```text
REAL_REVIEW_LOCAL_RUN_REVALIDATION_REQUIRED
```

The next successor must re-observe the current frontier, revalidate authority and the exact one-shot permit, and only then decide whether the local stress-test may execute.
