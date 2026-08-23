# UU-AAP Integration v0.1 — Decision, Execution, Observation and Canonicalization

**Status:** experimental integration profile  
**Scope:** exact pre-commit decision, raw execution/state-transition evidence, independent post-execution readback, and narrow policy-relative canonicalization

## Purpose

This integration profile connects the responsibility boundary from IAL with PoAI authority, CCRP execution admission, fresh revalidation, Git execution evidence, independent observation and a final policy-recognition step without collapsing their assurance levels.

It separates four questions that MUST NOT be collapsed:

1. **CommitDecision:** are the independently established preconditions still jointly valid for an attempted commit at this exact frontier?
2. **CommitReceipt:** did an exact Git state transition from that approved frontier actually occur in the declared execution mode?
3. **ObservationReceipt:** after execution, what exact successor state can be independently re-read from the declared observation source?
4. **CanonicalizationReceipt:** does an explicit policy recognize that exact observed state within one declared canonicality scope?

A positive decision is not a commit. A commit is not an observation. An observation is not canonicality. Policy-relative canonicality is not universal truth.

## Architectural position

```text
ContextFrame
  -> Intent
  -> Action
  -> Revalidation
  -> Collision / Reconciliation
  -> ResponsibilityHandoff
  -> CommitDecision
  -> CommitReceipt
  -> ObservationReceipt
  -> CanonicalizationReceipt
  -> ProvenanceClosure
```

## Required evidence axes for CommitDecision

A positive decision requires agreement across independent evidence:

1. **responsibility** — an accepted IAL E2/E3 responsibility handoff;
2. **capability** — reproducible capability attestation bound through the handoff;
3. **freshness** — a `RevalidationReceipt` proving the intended revision remains current;
4. **collision/admission** — CCRP execution admission is current and collision-clear;
5. **authority** — PoAI authority is established for the exact subject/scope/target;
6. **pre-materialization permission** — the PoAI+CCRP gate is permitted for the same operation frontier.

No axis may silently substitute for another.

## CommitReceipt

`CommitReceipt` binds an approved `CommitDecisionResult` to an exact Git predecessor/successor relation.

The v0.1 execution profile is deliberately narrow:

`execution_mode = ephemeral_local_git_object`

The conformance harness creates a real Git commit object with `git commit-tree`, verifies parent/tree/changed-path identity, and proves that no branch/tag ref, remote repository or working-tree bytes were changed.

Therefore:

```text
CommitDecision approved != Commit performed
Commit performed != Published repository mutation
Commit performed != Outcome observed
```

## ObservationReceipt

`ObservationReceipt` independently re-reads the successor after execution rather than trusting copied CommitReceipt fields.

The v0.1 observation profile is:

```text
observation_mode   = git_object_database_readback
observation_source = local_git_object_database
outcome_scope      = local_git_successor_object
```

It independently verifies:

- predecessor and successor commit existence at observation time;
- exact successor tree;
- exact single-parent relation;
- exact changed paths;
- exact semantic binding to action/target/operation/responsible party/executor;
- unchanged refs and working-tree bytes during readback.

A passing receipt may set `outcome_observed = true` only for `local_git_successor_object`.

It does not establish remote GitHub state, publication, branch selection or canonicality.

## CanonicalizationReceipt

`CanonicalizationReceipt` is a separate policy-recognition artifact. It consumes the exact ObservationReceipt and preserves the complete execution lineage back through:

```text
ObservationReceipt
  -> CommitReceipt
  -> CommitDecisionResult
  -> CommitDecisionInput
  -> authority verification ref
  -> pre-materialization ref
```

The initial policy is:

`urn:uu-aap:canonicalization-policy:integration-local-git-object-database:0.1`

with scope:

`urn:uu-aap:canonicality-scope:integration-local-git-object-database`

It applies only to:

```text
target             = github:Matawaka/uu-aap
observation_mode   = git_object_database_readback
observation_source = local_git_object_database
outcome_scope      = local_git_successor_object
```

A positive result requires:

- exact ObservationReceipt/CommitReceipt/Decision/Input lineage;
- exact action, target, operation, responsible party and executor across the lineage;
- exact successor revision/commit/tree/effect binding;
- exact upstream authority-verification and pre-materialization refs from the approved decision frontier;
- exact policy ID, version, RFC 8785 JCS SHA-256 digest and scope;
- canonicalization time strictly after observation time;
- policy active at canonicalization time;
- no active stay;
- exactly one conflict candidate matching the observed successor.

Only then may it establish:

`policy_relative_canonicality_established = true`

for the single declared scope.

## Critical PoAI adapter boundary

The repository already contains a `PoAIMaterializationEvent` machine layer. That layer recognizes a **PoAI successor record** under a PoAI Materialization Policy.

This integration profile observes a **Git successor object**.

They MUST NOT be silently identified:

```text
observed Git successor object != PoAI successor record
CanonicalizationReceipt != PoAIMaterializationEvent
local integration canonicality != PoAI chain canonicality
```

The v0.1 canonicalization policy therefore requires an explicit future typed adapter before a Git observation can participate as a PoAI successor record.

Until such an adapter exists, a positive CanonicalizationReceipt keeps:

```text
poai_materialization_event_recorded = false
poai_successor_record_identity_inferred = false
```

This prevents a generic Git execution fact from accidentally acquiring stronger PoAI semantics.

## Policy-relative canonicality is not universal canonicality

A positive CanonicalizationReceipt says only:

> Under this exact policy, at this exact evaluation time, the exact observed local Git successor is recognized within this exact declared scope.

It does **not** say that:

- a GitHub remote branch or tag points to that successor;
- the successor is a published release;
- a PoAI MaterializationEvent occurred;
- another policy or authority must recognize it;
- the state is universally canonical;
- the content is factually true;
- causality has been proven;
- legal responsibility or legal effect has been established;
- moral correctness has been established;
- PoAI/V conformance has been established.

## Core invariants

```text
Responsibility accepted != Authority
Authority != Execution admission
Execution admission != CommitDecision
CommitDecision approved != Commit performed
Commit performed != Outcome observed
Outcome observed != Policy-relative canonicality
Policy-relative canonicality != PoAI MaterializationEvent
Policy-relative canonicality != Universal canonicality
Canonicality != Truth
```

## Files

Decision stage:

- `revalidation-receipt.schema.json`
- `commit-decision-input.schema.json`
- `commit-decision-result.schema.json`
- `evaluate-commit-decision.js`
- `test-commit-decision.js`

Execution stage:

- `commit-receipt.schema.json`
- `record-commit-receipt.js`
- `test-commit-receipt.js`

Observation stage:

- `observation-receipt.schema.json`
- `record-observation-receipt.js`
- `test-observation-receipt.js`

Canonicalization stage:

- `canonicalization-policy.schema.json`
- `policies/integration-local-git-object-database.canonicalization-policy.json`
- `canonicalization-receipt.schema.json`
- `evaluate-canonicalization.js`
- `test-canonicalization-receipt.js`

## Continuation invariant

Every completed integration-layer PR SHOULD name the next unimplemented layer before closure. The next stage is therefore part of the durable repository state rather than depending on a chat/session continuation.

## Next stage

The next integration layer is `ProvenanceClosureReceipt`.

It must bind the immutable evidence chain from Context/Intent through policy-relative recognized state, preserve every predecessor assurance boundary exactly, detect lineage substitution or omission, and produce one end-to-end provenance closure without upgrading any predecessor claim.
