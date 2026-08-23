# UU-AAP Integration v0.1 — Pre-Commit Decision Gate

**Status:** experimental integration profile  
**Scope:** decision only; no commit or materialization side effect

## Purpose

This layer connects the responsibility boundary from IAL with PoAI authority, CCRP execution admission, collision/reconciliation state and fresh revision revalidation.

It answers one narrow question:

> Are the independently established preconditions still jointly valid for an attempted commit/materialization at this exact frontier?

A positive answer is a `CommitDecision` of `approved`. It is **not** a commit.

## Architectural position

```text
ContextFrame
  -> Intent
  -> Action
  -> Revalidation
  -> Collision / Reconciliation
  -> ResponsibilityHandoff
  -> CommitDecision        <-- this layer
  -> Commit
  -> Observation
  -> Canonicalization
  -> Provenance
```

## Required evidence axes

A positive decision requires agreement across independent evidence:

1. **responsibility** — an accepted IAL E2/E3 responsibility handoff;
2. **capability** — already verified by the accepted IAL handoff through reproducible attestation;
3. **freshness** — a `RevalidationReceipt` binding the intended base revision to the still-observed current revision;
4. **collision/admission** — CCRP execution admission is current and collision-clear for the same operation/revision;
5. **authority** — PoAI authority is established for the exact subject/scope/target;
6. **policy/materialization precondition** — the PoAI+CCRP pre-materialization gate is permitted for the exact operation.

No axis may silently substitute for another.

## Core invariants

```text
responsibility accepted != authority
reproducible capability != authority
authority != execution admission
execution admission != commit decision
pre-materialization permission != commit performed
commit decision approved != commit performed
commit performed != outcome observed
outcome observed != canonical state
```

## Fresh revalidation

`RevalidationReceipt` is deliberately separate from the original intent/operation. It records the frontier immediately before the decision:

- intended base revision;
- newly observed current revision;
- observation timestamp;
- decision timestamp;
- maximum accepted age;
- exact action/target/operation binding.

The decision fails closed if the revision moved or the receipt is stale.

## No mutation

The evaluator performs no Git write, no GitHub mutation and no materialization. A positive result asserts only that the decision gate approved an attempted commit under the supplied evidence.

## Files

- `revalidation-receipt.schema.json`
- `commit-decision-input.schema.json`
- `commit-decision-result.schema.json`
- `evaluate-commit-decision.js`
- `test-commit-decision.js`

## Non-claims

A positive CommitDecision does not establish that a commit was attempted, performed, persisted, observed, accepted as canonical, factually true, causally proven, legally effective, or PoAI/V conformant.