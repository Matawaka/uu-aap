# PoAI Level 3.1 checkpoint

Status: **research checkpoint candidate**

This document freezes a human-readable description of the accepted Level 3.1 successor line before Level 4 cryptographic binding/signature experiments. It does **not** redefine the frozen Genesis/Machine Layer and does **not** claim PoAI/V conformance.

## Checkpoint commit

The Level 3.1 checkpoint candidate is the `main` commit immediately after PR #72:

`12d23071d0684c363aa42403be1bfa1cd1a3d652`

Proposed immutable tag (manual creation only):

`poai-level3.1-checkpoint-v0.1`

The tag, if created, should point exactly to the checkpoint commit above. It must not be moved later.

## Accepted Level 3.1 chain

The Level 3.1 successor research line established the following append-only provenance separation:

`Decision -> Review -> Appeal Request -> Adjudication -> Execution Report -> Execution Verification -> Observed Outcome -> Successor Proposal`

Each later artifact references earlier provenance without rewriting the earlier artifact's decision-time or review-time horizon.

### Decision

Genesis PoAI decision record with Decision Boundary, Knowledge Cutoff, intelligence resources, availability, consideration, authority, evidence, Future Target/outcome and append-only versioning.

### Review

Separate `PoAIReviewSidecar`; review purpose/horizon belongs to the act of review rather than the original decision.

Core boundary:

`review context != decision context`

### Appeal Request

Separate `PoAIAppealRequestSidecar`; a request to reconsider/suspend/correct does not establish the requested effect.

Core boundary:

`appeal request != adjudication != reversal`

### Adjudication

Separate `PoAIAdjudicationSidecar`; a declared disposition/directive does not prove implementation or execution.

Core boundary:

`appeal request != adjudication decision != executed effect != observed outcome`

### Execution Report

Separate `PoAIExecutionSidecar`; `completed` is a declared execution status, not independently verified execution/compliance.

Core boundary:

`adjudication directive != execution report != verified execution != observed outcome`

### Execution Verification

Separate `PoAIExecutionVerificationSidecar`; multiple verification reports may coexist, including `supported` and `contradicted`, without overwriting the execution report.

Core boundary:

`execution report != verification report != verified fact != observed outcome`

### Observed Outcome

Separate `PoAIObservedOutcomeSidecar`; reuses the Genesis outcome vocabulary and keeps causal attribution separate from outcome observation.

Core boundary:

`verification report != outcome observation != causal attribution != responsibility`

### Successor Proposal

Separate `PoAISuccessorProposalSidecar`; proposes an append-only next record version but does not create, publish or canonicalize the successor.

Core boundary:

`outcome observation != successor proposal != successor record != canonical successor`

The proposal explicitly requires preservation of the original Decision Boundary, original Knowledge Cutoff and decision-time Future Target epistemic status.

## Machine/schema separation

All Level 3.1 sidecars remain intentionally outside the Genesis decision-record JSON Schema. CI contains negative gates confirming that Review, Appeal, Adjudication, Execution, Execution Verification, Observed Outcome and Successor Proposal artifacts are rejected when presented as Genesis PoAI decision records.

This protects artifact-family boundaries instead of allowing later provenance to masquerade as a rewritten original decision.

## Live acceptance status

Core live paths were exercised successfully through the browser interface, including:

- Decision record PASS / sidecar FAIL / original Decision PASS round trips;
- multiple intelligence resources with one independent authority relation;
- Review Sidecars with purpose-relative review;
- Appeal -> Adjudication -> Execution chain;
- `completed` execution without automatic verified-execution claims;
- independent Execution Verification reports with both `supported` and `contradicted` results for the same execution;
- `not_realized_after_intervention` outcome with `associated_not_proven` causal status;
- Outcome Observation -> Successor Proposal transition without automatic successor establishment.

Issue #71 is fully completed. Earlier live-checklist issues #43, #47, #51, #57, #62 and #66 remain open only for additional boundary coverage such as explicit non-null evidence cutoffs, conflicting parallel artifacts and negative temporal vectors. Their remaining open status does not mean the main Level 3.1 path is unimplemented.

## Security and assurance boundary

Level 3.1 is still primarily self-declared/non-cryptographic provenance infrastructure.

It does not by itself establish:

- cryptographic integrity of a downloaded artifact;
- signer identity;
- signer authority;
- legal effect;
- factual truth;
- causal proof;
- responsibility;
- canonical successor status;
- PoAI/V conformance.

Core invariant retained across the checkpoint:

`proof != truth`

and:

`availability != use != authority != responsibility`

## Transition to Level 4

Level 4 begins only after this checkpoint with independently testable cryptographic layers:

`canonical bytes -> digest binding -> signature -> signer identity evidence -> signer/materialization authority -> successor materialization policy`

A digest or valid signature alone must never be interpreted as truth, authority, responsibility or canonical successor status.

Tracking:

- Level 4 architecture RFC: #73
- deterministic JCS + SHA-256 experiment: #74
- deterministic binding live acceptance: #76

## Tagging note

If the proposed checkpoint tag is created, use:

`poai-level3.1-checkpoint-v0.1`

Target exactly:

`12d23071d0684c363aa42403be1bfa1cd1a3d652`

Do not target the later Level 4.0a merge commit, because that would blur the Level 3.1 / Level 4 boundary.