# UU-AAP Integration v0.1 — Decision, Commit and Observation Receipts

**Status:** experimental integration profile  
**Scope:** exact pre-commit decision, raw execution/state-transition evidence, and independent post-execution readback; no policy-relative canonicalization

## Purpose

This layer connects the responsibility boundary from IAL with PoAI authority, CCRP execution admission, collision/reconciliation state, fresh revision revalidation, raw commit execution evidence, and a separate observation of the resulting state.

It separates three questions that MUST NOT be collapsed:

1. **CommitDecision:** are the independently established preconditions still jointly valid for an attempted commit at this exact frontier?
2. **CommitReceipt:** did an exact Git state transition from that approved frontier actually occur in the declared execution mode?
3. **ObservationReceipt:** after execution, what exact successor state can be independently re-read from the declared observation source?

A positive `CommitDecision` is **not** a commit. A positive `CommitReceipt` is **not** an observation. A positive `ObservationReceipt` is **not** remote publication evidence and is **not** policy-relative canonicalization.

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
  -> ObservationReceipt     <-- independent post-execution readback
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

## ObservationReceipt

`ObservationReceipt` is an independent successor artifact. It consumes an exact `CommitReceipt`, waits until after that receipt timestamp, and performs a fresh readback from the declared source instead of trusting copied successor fields.

The v0.1 observation profile supports only:

```text
observation_mode   = git_object_database_readback
observation_source = local_git_object_database
outcome_scope      = local_git_successor_object
```

The recorder independently re-reads and verifies:

- predecessor commit existence at observation time;
- successor commit existence at observation time;
- exact successor tree SHA;
- exact single-parent relation;
- exact changed paths from predecessor to successor;
- unchanged action, target, operation, responsible party and executor implementation;
- unchanged refs and working-tree bytes during the observation itself.

A passing receipt may set `outcome_observed = true` only for the narrow declared scope above. It does **not** establish that the successor was pushed, published, selected by a branch or tag, accepted by a PoAI materialization policy, or canonical.

## CommitReceipt and ObservationReceipt are not PoAI MaterializationEvent

The existing PoAI `MaterializationEvent` applies a materialization policy to an exact candidate successor and carries a policy-relative `canonicality_claim`.

Therefore:

```text
CommitReceipt
  = raw execution / Git state-transition evidence

ObservationReceipt
  = post-execution readback of the declared target state

PoAI MaterializationEvent
  = later policy-recognition event
```

and:

```text
CommitDecision approved != Commit performed
Commit performed != Outcome observed
Outcome observed != Remote publication observed
Outcome observed != PoAI MaterializationEvent
Outcome observed != policy-relative canonicality
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

A positive v0.1 ObservationReceipt may additionally establish:

- the CommitReceipt was accepted as its exact predecessor artifact;
- post-execution readback was actually performed;
- the exact successor object/tree/parent/effect is still observable in the local Git object database;
- the observed state exactly matches the CommitReceipt;
- `outcome_observed = true` only for `local_git_successor_object`.

ObservationReceipt MUST keep false/unestablished:

- remote repository state observed;
- published branch or tag update observed;
- PoAI materialization event recorded;
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

Observation stage:

- `observation-receipt.schema.json`
- `record-observation-receipt.js`
- `test-observation-receipt.js`

## Continuation invariant

Every completed integration-layer PR SHOULD name the next unimplemented layer before closure. This makes the handoff between architecture stages durable instead of depending on chat/session continuity.

## Next stage

The next integration layer is `CanonicalizationReceipt` / PoAI MaterializationEvent policy-recognition binding. It must consume observation evidence together with the existing materialization policy and authority model, and may establish only policy-relative recognized state. It must not rewrite the execution or observation frontier and must not claim universal canonicality, factual truth, causality or legal effect.
