# UU-AAP Integration v0.1 — Decision, Execution, Observation, Canonicalization and Provenance Closure

**Status:** experimental integration profile  
**Scope:** exact pre-commit decision, raw execution/state-transition evidence, independent post-execution readback, narrow policy-relative canonicalization, and bounded provenance closure

## Purpose

This integration profile connects the responsibility boundary from IAL with PoAI authority, CCRP execution admission, fresh revalidation, Git execution evidence, independent observation, policy-relative recognition and an explicit provenance closure without collapsing their assurance levels.

It separates five questions that MUST NOT be collapsed:

1. **CommitDecision:** are the independently established preconditions still jointly valid for an attempted commit at this exact frontier?
2. **CommitReceipt:** did an exact Git state transition from that approved frontier actually occur in the declared execution mode?
3. **ObservationReceipt:** after execution, what exact successor state can be independently re-read from the declared observation source?
4. **CanonicalizationReceipt:** does an explicit policy recognize that exact observed state within one declared canonicality scope?
5. **ProvenanceClosureReceipt:** which parts of the evidence chain are cryptographically closed, which are only reference-bound, and where does the current origin frontier actually begin?

A positive decision is not a commit. A commit is not an observation. An observation is not canonicality. Canonicality is not provenance of semantic origin. Provenance closure does not upgrade any predecessor claim.

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
  -> ProvenanceClosureReceipt
```

The diagram is the target semantic architecture. The current machine-readable implementation has a deliberately narrower proven origin frontier, described below.

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

It independently verifies predecessor/successor existence, exact tree, parent relation, changed paths, semantic binding and that readback itself did not mutate refs or the working tree.

A passing receipt may set `outcome_observed = true` only for `local_git_successor_object`. It does not establish remote GitHub state, publication, branch selection or canonicality.

## CanonicalizationReceipt

`CanonicalizationReceipt` is a separate policy-recognition artifact. It consumes the exact ObservationReceipt and preserves the execution lineage through:

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

Only after exact lineage, exact semantic/successor binding, exact policy identity/digest/scope, active policy time, no stay and a single matching head may it establish:

`policy_relative_canonicality_established = true`

for that one declared scope.

## Critical PoAI adapter boundary

The repository already contains a `PoAIMaterializationEvent` machine layer that recognizes a **PoAI successor record**. This integration profile observes a **Git successor object**.

They MUST NOT be silently identified:

```text
observed Git successor object != PoAI successor record
CanonicalizationReceipt != PoAIMaterializationEvent
local integration canonicality != PoAI chain canonicality
```

A future typed adapter is required before a Git observation can participate as a PoAI successor record.

## ProvenanceClosureReceipt

`ProvenanceClosureReceipt` does not create a stronger fact. It inventories and cryptographically binds the assurance already established by predecessor stages.

The v0.1 closure has two binding classes.

### Digest-bound suffix

The closure computes RFC 8785 JCS + SHA-256 digests for the exact bytes of:

1. `RevalidationReceipt`;
2. `CommitDecisionInput`;
3. `CommitDecisionResult`;
4. `CommitReceipt`;
5. `ObservationReceipt`;
6. `CanonicalizationReceipt`;
7. the exact `UU-AAPCanonicalizationPolicy`.

It verifies all direct lineage links, the shared action/target/operation/responsible-party/executor tuple, the exact successor revision/commit/tree/effect, and the exact canonicalization policy ID/version/digest/scope.

### Reference-bound upstream frontier

`CommitDecisionInput` also binds exact refs to:

- responsibility handoff result;
- responsibility handoff offer;
- responsibility handoff acceptance;
- authority verification;
- CCRP execution admission;
- PoAI+CCRP pre-materialization result.

The current integration harness uses those artifacts to evaluate the decision, but it does not export their exact bytes as independent closure inputs. Therefore `ProvenanceClosureReceipt` records them as:

```text
binding_mode = exact_reference_only
artifact_bytes_bound = false
```

This distinction is mandatory. An exact ref is provenance evidence, but it is not the same assertion as a content digest over the referenced artifact bytes.

## Origin frontier

The semantic architecture starts at `ContextFrame -> Intent`, but standalone typed `ContextFrame` and `Intent` artifacts are not yet present in this integration path.

Therefore a positive v0.1 closure explicitly states:

```text
bounded_chain_closed = true
standalone_context_frame_provenance_established = false
standalone_intent_provenance_established = false
semantic_origin_provenance_complete = false
all_upstream_evidence_artifact_bytes_bound = false
```

This is intentional. The protocol prefers a bounded truthful closure over a false claim that the entire semantic origin has already been machine-proven.

`bounded machine closure != complete semantic-origin provenance`

## Assurance monotonicity

A closure may preserve predecessor truth values; it may not upgrade them.

A positive closure therefore keeps false/unestablished:

- standalone ContextFrame provenance;
- standalone Intent provenance;
- complete semantic-origin provenance;
- remote branch/ref canonicality;
- PoAI MaterializationEvent equivalence;
- PoAI successor-record identity;
- universal canonicality;
- factual truth;
- causal proof;
- legal responsibility or legal effect;
- moral correctness;
- PoAI/V conformance.

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
Reference binding != Content-digest binding
Bounded provenance closure != Complete semantic-origin provenance
Later evidence MUST NOT rewrite earlier assurance boundaries
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

Provenance closure stage:

- `provenance-closure-receipt.schema.json`
- `build-provenance-closure.js`
- `test-provenance-closure.js`

## Continuation invariant

Every completed integration-layer PR SHOULD name the next unimplemented layer before closure. The repository must expose missing provenance instead of relying on chat/session continuity or silently assuming an omitted predecessor.

## Next stage

The bounded closure reveals the next predecessor-side gap rather than a new post-canonicalization stage.

The next integration work is a typed **Origin Envelope** (working name) that introduces standalone machine-readable `ContextFrame` and `Intent` artifacts and exports exact bytes for the currently reference-only upstream handoff/authority/admission/pre-materialization evidence.

Only after those predecessor artifacts are explicitly bound may a future closure truthfully upgrade from `bounded_machine_suffix` to complete semantic-origin provenance.
