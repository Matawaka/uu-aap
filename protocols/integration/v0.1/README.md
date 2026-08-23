# UU-AAP Integration v0.1 — Decision and Commit Receipt

**Status:** experimental integration profile  
**Scope:** exact pre-commit decision plus raw execution/state-transition evidence; no outcome observation or canonicalization

## Purpose

This layer connects the responsibility boundary from IAL with PoAI authority, CCRP execution admission, collision/reconciliation state, fresh revision revalidation, and the first post-decision execution receipt.

It separates two questions that MUST NOT be collapsed:

1. **CommitDecision:** are the independently established preconditions still jointly valid for an attempted commit at this exact frontier?
2. **CommitReceipt:** did an exact Git state transition from that approved frontier actually occur in the declared execution mode?

A positive `CommitDecision` is **not** a commit. A positive `CommitReceipt` is **not** an observation of the target system after execution and is **not** policy-relative canonicalization.

## Architectural position

```text
ContextFrame
  -> Intent
  -> Action
  -> Revalidation
  -> Collision / Reconciliation
  -> ResponsibilityHandoff
  -> CommitDecision
  -> CommitReceipt          <-- raw execution/state transition
  -> Observation
  -> Canonicalization
  -> Provenance
```

## Required evidence axes for CommitDecision

A positive decision requires agreement across independent evidence:

1. **responsibility** — an accepted IAL E2/E3 responsibility handoff;
2. **capability** — already verified by the accepted IAL handoff through reproducible attestation;
3. **freshness** — a `RevalidationReceipt` binding the intended base revision to the still-observed current revision;
4. **collision/admission** — CCRP execution admission is current and collision-clear for the same operation/revision;
5. **authority** — PoAI authority is established for the exact subject/scope/target;
6. **policy/materialization precondition** — the PoAI+CCRP pre-materialization gate is permitted for the exact operation.

No axis may silently substitute for another.

## CommitReceipt

`CommitReceipt` is a separate append-only execution artifact. It binds an approved `CommitDecisionResult` to an exact Git predecessor/successor relation and verifies:

- the predecessor commit is exactly the decision revision;
- the successor Git commit object exists;
- the successor has exactly the expected predecessor parent in v0.1;
- the successor tree exists and differs from the predecessor tree;
- the declared successor tree equals the Git object tree;
- the declared changed paths equal the actual Git diff paths;
- action, target, operation, responsible party and executor implementation are unchanged from the approved decision.

The v0.1 conformance harness supports only:

`execution_mode = ephemeral_local_git_object`

It creates a real Git commit object with `git commit-tree` but deliberately moves no branch/tag refs, performs no push, and changes no working-tree bytes. This proves the state-transition/receipt machinery without pretending that a remote GitHub repository was mutated.

A future live profile may define `published_repository_commit`, but v0.1 MUST fail closed if that stronger mode is claimed without separate publication evidence.

## CommitReceipt is not PoAI MaterializationEvent

The existing PoAI `MaterializationEvent` applies a materialization policy to an exact candidate successor and carries a policy-relative `canonicality_claim`.

Therefore:

```text
CommitReceipt
  = raw execution / Git state-transition evidence

PoAI MaterializationEvent
  = later policy-recognition event
```

and:

```text
CommitDecision approved != Commit performed
Commit performed != Outcome observed
Commit performed != PoAI MaterializationEvent
Commit performed != policy-relative canonicality
PoAI MaterializationEvent != universal truth
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

## Assurance boundaries

A positive CommitDecision may establish only that an attempted commit is approved under the supplied evidence.

A positive v0.1 CommitReceipt may additionally establish:

- the decision was approved;
- a real successor Git commit object exists;
- exact predecessor/parent/tree/changed-path bindings were verified;
- the raw state transition was performed in the declared local-ephemeral mode.

It MUST keep false/unestablished:

- remote repository mutation performed;
- published branch or tag update established;
- PoAI materialization event recorded;
- outcome observed;
- policy-relative canonicality established;
- universal canonicality;
- factual truth;
- causal proof;
- legal effect;
- PoAI/V conformance.

## Files

Decision stage:

- `revalidation-receipt.schema.json`
- `commit-decision-input.schema.json`
- `commit-decision-result.schema.json`
- `evaluate-commit-decision.js`
- `test-commit-decision.js`

Commit stage:

- `commit-receipt.schema.json`
- `record-commit-receipt.js`
- `test-commit-receipt.js`

## Next stage

The next integration layer is an independent `ObservationReceipt`. It must re-read the target system after the commit and establish what state is actually observable. Only a later `CanonicalizationReceipt` / PoAI MaterializationEvent may determine policy-relative recognized state.