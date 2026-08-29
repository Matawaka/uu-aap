# MarketCloser Real Stress-Test Adapter v0.1

## Purpose

This layer is the first adapter that can execute the Marketer Pessimist deterministic stress-test semantics for an already validated `real_non_personal` MarketCloser candidate.

It is intentionally separate from the historical Local MVP.

Origin frontier:

`2e06c019d2d94a2e72e13d461906ad508b987293`

Origin tree:

`f02e2960f64585ee02dcec9f93a069d1f8658991`

## Historical boundary

The existing:

`products/marketer-pessimist/v0.1/local-mvp/stress-test.js`

remains `synthetic_only=true`.

Its `analyze()` calls its own synthetic-only `validateInput()`. This successor therefore does not call that function for real material and never sets `synthetic_only=true` on a real source.

```text
Real Source != Synthetic Fixture
Real Candidate != Synthetic Local MVP Input
Successor Adapter != Rewrite of Synthetic Predecessor
```

## Analytical parity

`engine.js` implements the same bounded deterministic analysis projection as the Local MVP:

- state / uncertainty states;
- classification summary;
- evidence lineage;
- counterargument candidates;
- causal alternative candidates;
- falsifiers;
- missing-evidence map;
- bounded recommendation candidate;
- success criteria.

`test-engine-parity.js` runs the canonical Local MVP synthetic fixture through both engines and requires exact equality of that analytical projection.

Thus:

```text
Different Input Boundary != Different Analytical Semantics
```

## Exact predecessor chain

The production adapter accepts an exact `MarketCloserRealReviewLocalRunRevalidationInput` source and re-runs the merged chain:

```text
Local Run Revalidation input
-> Local Run Revalidation receipt
-> Run Permit materialization input
-> Authority Gate input
-> Deployment / Bridge input
-> Marketer Real Review Intake
-> MarketerPessimistRealReviewCandidate
```

The candidate id/hash and bridge receipt hash must match the ready revalidation receipt exactly.

No `candidate_ready=true`, `permit_ok=true` or precomputed analysis flag is accepted.

## Ready requirement

`stress-test` is admitted only when revalidation is one of:

```text
SYNTHETIC_LOCAL_RUN_READY
REAL_LOCAL_RUN_READY
```

The committed fixture is deliberately not ready:

```text
REVALIDATION_NOT_READY
```

and `stress-test` fails closed on it.

No real permit, ready revalidation, real review text or private audit material is committed.

## One-shot logical consumption

The permit forbids filesystem writes, so this pure/stateless adapter does not maintain a hidden mutable consumption database.

Instead one-shot identity is logical and deterministic:

```text
logical invocation id = H(exact permit hash | exact candidate hash | exact operation)
```

The receipt records:

```text
logical_invocation_count = 1
logically_consumed = true
compute_replay_idempotent = true
```

The same permit + same candidate + same operation always produces the same logical invocation id.

```text
Compute Replay != New Logical Invocation
Compute Replay != New Authority
Logical Permit Consumption != ActionPermit Consumption
```

A replay may repeat local CPU work, but cannot create a second logical authorized analysis, new permit, new authority, publication permission or external effect.

## Output

A completed adapter run emits `MarketCloserRealStressTestReceipt` with classification:

```text
SYNTHETIC_STRESS_TEST_COMPLETED
REAL_STRESS_TEST_COMPLETED
```

The receipt embeds the deterministic analysis projection and exact bindings to:

- adapter input;
- revalidation input/receipt;
- one-shot permit;
- logical invocation id;
- Marketer candidate;
- bridge receipt.

## Claims that may become true

Only bounded local analytical claims:

```text
exact_revalidation_rederived
exact_candidate_rederived
deterministic_analysis_completed
logical_permit_consumption_recorded
same_permit_same_candidate_same_logical_invocation
human_disposition_still_required
```

## Mandatory false claims

Every stress-test receipt keeps false:

```text
truth_certified
claim_rejected
automatic_negative_judgment
response_candidate_created
human_disposition_recorded
publication_authorized
provider_invoked
network_accessed
filesystem_written
platform_mutated
pilot_permit_created
action_permit_created
external_execution_admitted
external_effect_performed
successor_authority_created
```

## Invariants

```text
Real Source != Synthetic Fixture
Deterministic Analysis != Truth
Counterargument != Rejection
Risk Hypothesis != Proof of Harm
Stress-Test Completed != Response Candidate
Stress-Test Completed != Human Disposition
Stress-Test Completed != Publication Authority
Logical Permit Consumption != ActionPermit Consumption
Compute Replay != New Logical Invocation
Successful Analysis != Successor Authority
```

## CLI

Allowed:

```text
validate
inspect
stress-test
help
```

`inspect` never performs analysis. `stress-test` performs only deterministic local computation and fails if the exact revalidation is not ready.

There is no publish/send/campaign/provider/platform/action-permit/external-execute command.

## Runtime effects

Production modules:

- may read exact local/repository evidence files;
- may perform deterministic CPU computation;
- write no files;
- perform no network access;
- invoke no provider;
- mutate no platform/account;
- publish nothing;
- create no PilotPermit or ActionPermit;
- perform no external effect.

The synthetic conformance helper writes only temporary `/tmp` files and is not imported by the production runtime.

## Next safe action

After a completed stress-test:

`HUMAN_ANALYSIS_DISPOSITION_GATE_REQUIRED`

The adapter does not turn its recommendation candidate into a MarketCloser response and does not record human disposition.
