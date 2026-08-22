# PoAI Execution Verification Sidecar — successor research

Status: experimental successor research after `poai-genesis-v0.0.1`.

This document does not modify the frozen Genesis decision-record schema.

## Research boundary

A report that an executor completed an action is not the same thing as a later verification report, and a verification report is not automatically a certified fact or an observed outcome.

Core separation:

`execution report != verification report != verified fact != observed outcome`

and:

`verification context != execution context != adjudication context != appeal context != review context != decision context`

## Experimental artifact

The Level 3.1h experiment generates a browser-local `PoAIExecutionVerificationSidecar` (`0.0.1-experimental`).

It references:

- the immutable root `decision_record_id`;
- a required `execution_id`;
- optional adjudication and appeal provenance references.

It records:

- `verified_at`;
- verifier self-declaration;
- `verification_horizon.evidence_cutoff`;
- a language-neutral verification method;
- a language-neutral declared verification result;
- optional evidence refs and notes.

## Non-certifying semantics

A result such as `supported` means only that this verification artifact declares support for the referenced execution report.

It does **not** establish:

- verified execution;
- verified compliance;
- observed outcome;
- factual truth;
- causal proof;
- legal effect;
- verifier authority or independence;
- responsibility;
- a canonical verdict.

Likewise, `contradicted` does not erase or mutate the original Execution Sidecar. Multiple verification artifacts may coexist.

## Time boundary

Verification evidence belongs to the verification-time horizon only:

`verification_horizon.evidence_cutoff <= verified_at`

Later verification knowledge must never be injected backward into the Execution, Adjudication, Appeal, Review, or Decision horizons.

## Relation to future PoAI/V

This artifact is not PoAI/V and does not provide cryptographic evidence binding or institutional accreditation. A future verifiable layer may define stronger evidence-binding and verifier-authority rules. Those rules must not be inferred from this experiment.

Tracking:

- RFC: Issue #60;
- implementation: Issue #61;
- live acceptance: Issue #62.
