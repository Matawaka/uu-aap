# MarketCloser Real Review Run Authority Gate v0.1

**Status:** experimental Phase E application authority boundary  
**Issue:** #613  
**Origin frontier:** `c22967d4ebf82336bf772fa7526b6d4e7b54765e`  
**Origin tree:** `7bdb698e0679da6c34033c41e1a0c9fa843b5175`

## Purpose

This gate is the first MarketCloser layer that asks whether one exact minimized review candidate is backed by pre-existing application-scoped authority evidence.

It does **not** create authority, a run permit or a stress-test run.

```text
exact Minimized Real Review Bridge input
-> re-derive exact bridge receipt
-> compute exact run target
-> validate pre-existing PoAIAuthorityVerificationResult
-> match scope / target / subject / freshness
-> authority-gate receipt
-> STOP
```

## Authority reuse

The gate reuses:

```text
proposals/poai/authority/tools/authority-core.js
```

and specifically its canonical `PoAIAuthorityVerificationResult` assurance boundary.

It does not introduce a MarketCloser-specific authority proof format.

### Why FCL Authority Evaluation is not reused directly

The merged FCL authority evaluator is intentionally scoped to:

```text
fcl.run.interrupt
fcl.run.successor.create
```

MarketCloser does not widen those FCL scopes.

### Why the live GitHub root is not widened

The current live repository root accepts only repository materialization/policy actions. This gate never adds:

```text
marketcloser.real-review.run
```

to that live root.

Application run authority therefore remains a separate governance question.

## Required scope

```text
marketcloser.real-review.run
```

## Exact target

The required target is deterministically derived from the exact bridge receipt hash:

```text
urn:uu-aap:marketcloser:real-review-run:bridge-sha256:<bridge-receipt-sha256>
```

Authority evidence for another candidate cannot authorize this candidate.

## Classification

```text
SYNTHETIC_AUTHORITY_CONFORMANCE_READY
AUTHORITY_EVIDENCE_REQUIRED
AUTHORITY_SCOPE_MISMATCH
AUTHORITY_TARGET_MISMATCH
AUTHORITY_SUBJECT_MISMATCH
AUTHORITY_EVIDENCE_STALE
AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED
```

A positive real classification still means only that matching pre-existing authority evidence was observed.

```text
Authority Verified != Run Permit Created
```

## Committed conformance fixture

The repository fixture intentionally contains:

```text
authority_verification_result = null
```

and therefore evaluates to:

```text
AUTHORITY_EVIDENCE_REQUIRED
```

No committed fixture pretends that real MarketCloser authority exists.

The test suite creates an in-memory synthetic `contractual_root`, synthetic grant and synthetic `PoAIAuthorityVerificationResult` using the canonical Authority Core. That positive vector is used only to prove scope/target/subject matching logic.

No live root, live grant, private key, real deployment URL, private audit or real pilot authority evidence is committed.

## Freshness

Authority evidence must satisfy:

```text
bridge_observed_at <= authority_verified_at <= gate_evaluated_at
```

Otherwise classification is:

```text
AUTHORITY_EVIDENCE_STALE
```

## Required invariants

```text
Human Approval != Authority Verification
Repository Authority != Application Run Authority
FCL Authority Scope != MarketCloser Run Scope
Authority Verification Result != Authority Grant Creation
Authority Verified != Run Permit Created
Run Permit Candidate != Stress-Test Run
Stress-Test Run != Response Publication
Bridge Candidate != PilotPermit
PilotPermit != ActionPermit
ActionPermit != Execution
```

## External effects

Unavailable in v0.1:

```text
authority grant creation
live Authority Root mutation
stress-test execution
response candidate creation
publication
provider invocation
platform mutation
PilotPermit
ActionPermit
execution
external effect
```

## CLI

```text
validate
evaluate
help
```

There is no `grant`, `permit`, `run`, `stress-test`, `publish`, `send` or `execute` command.

## Next boundary

Only a positive **real** authority verification may proceed to:

```text
REAL_REVIEW_RUN_PERMIT_REQUIRED
```

The synthetic positive path stops at:

```text
STOP_AFTER_SYNTHETIC_AUTHORITY_CONFORMANCE
```

The permit layer must be a separate successor and must still not imply publication authority.
