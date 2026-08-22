# PoAI successor research extensions

This directory contains successor research built **after** the frozen `poai-genesis-v0.0.1` checkpoint.

Extensions here do not silently redefine the tagged Genesis/Machine-Layer checkpoint. They are experiments that must survive machine validation, public review and field use before any future protocol revision is proposed.

## Current extensions

### Compositional Intelligence Horizon

[`COMPOSITIONAL_INTELLIGENCE.md`](COMPOSITIONAL_INTELLIGENCE.md)

Models one decision as a composition of independently represented human, AI, model, documentary, group or institutional intelligence resources while keeping availability, consideration and authority separate.

Core research invariant:

`resource provenance != availability != consideration != authority != responsibility`

and:

`epistemic advantage != authority`

Synthetic example:

[`../examples/augmented-observer.synthetic.poai.json`](../examples/augmented-observer.synthetic.poai.json)

Tracking / review:

- compositional implementation: Issue #27;
- terminology RFC (`human_judgment`, collective and augmented cognition): Issue #26;
- field usability round: Issue #28.

### Review Artifact / Sidecar

[`REVIEW_ARTIFACT.md`](REVIEW_ARTIFACT.md)

Explores later review provenance as a separate artifact that references an immutable PoAI decision record without rewriting its Decision Boundary or Knowledge Cutoff.

Core research invariants:

`review context != decision context`

`review evidence cutoff != decision knowledge cutoff`

`multiple reviews may coexist without rewriting the reviewed record`

`disagreement is a relation, not a canonical overwrite`

and:

`validity != completeness != truth`

The current Level 3.1d experiment generates a browser-local `PoAIReviewSidecar` v0.0.2 with a separate review evidence horizon and optional relations (`responds_to`, `supports`, `challenges`) to other review artifacts. It deliberately remains outside the Genesis PoAI record schema, leaves reviewer authority unknown, establishes no canonical verdict and carries no scalar completeness/trust/intelligence score.

Tracking / review:

- Review Context RFC: Issue #34;
- completed first sidecar implementation/live acceptance: Issues #35/#36/#39;
- conflicting review plurality: Issue #37;
- review-time horizon / hindsight protection: Issue #38;
- completed plurality + horizon implementation: Issue #42 / PR #44;
- plurality + horizon live acceptance: Issue #43.

### Appeal / Contest Request Sidecar

[`APPEAL_ARTIFACT.md`](APPEAL_ARTIFACT.md)

Explores the act of contesting a decision or a later review as a separate provenance-bearing request rather than a mutation of the object being challenged.

Core research invariants:

`appeal request != adjudication != reversal`

`appeal context != review context != decision context`

and:

`requested effect != established effect`

The first Level 3.1e experiment generates a browser-local `PoAIAppealRequestSidecar`. It can target the root decision record or a specific Review Sidecar while retaining an explicit root `decision_record_id`. Appellant standing/authority remain unknown, requested actions establish no effect, and appeal-time evidence remains in a separate appeal horizon.

Tracking / review:

- Appeal / Contest RFC: Issue #45;
- completed implementation: Issue #46 / PR #48;
- live acceptance: Issue #47.

### Adjudication / Resolution Sidecar

[`ADJUDICATION_ARTIFACT.md`](ADJUDICATION_ARTIFACT.md)

Explores a declared resolution of an Appeal Request as a separate provenance artifact rather than a mutation of the appeal, review, or original decision.

Core research invariants:

`appeal request != adjudication decision != executed effect != observed outcome`

and:

`adjudication context != appeal context != review context != decision context`

The first Level 3.1f experiment generates a browser-local `PoAIAdjudicationSidecar`. It references a root decision and required Appeal Request, keeps adjudicator authority/jurisdiction unknown, records a declared disposition and optional directives, and explicitly does not establish implementation, execution, legal effect, truth, causality, or observed outcome.

Tracking / review:

- Adjudication RFC: Issue #49;
- completed implementation: Issue #50 / PR #54;
- live acceptance: Issue #51.

### Execution / Compliance Sidecar

[`EXECUTION_ARTIFACT.md`](EXECUTION_ARTIFACT.md)

Explores a later execution/compliance report as a separate provenance artifact rather than treating an adjudication directive as proof that the directive was actually carried out.

Core research invariants:

`adjudication directive != execution report != verified execution != observed outcome`

and:

`execution context != adjudication context != appeal context != review context != decision context`

The first Level 3.1g experiment generates a browser-local `PoAIExecutionSidecar`. It references the root decision and required Adjudication, keeps executor authority unknown, records a declared execution status, and explicitly does not establish verified execution/compliance, observed outcome, legal effect, truth, causality, authority, responsibility, or a canonical verdict.

Tracking / review:

- Execution / Compliance RFC: Issue #55;
- implementation: Issue #56;
- live acceptance: Issue #57.

### Execution Verification Sidecar

[`EXECUTION_VERIFICATION_ARTIFACT.md`](EXECUTION_VERIFICATION_ARTIFACT.md)

Explores a later verification report about an Execution Sidecar as a separate provenance artifact, rather than treating either the executor's declaration or a verifier's declaration as an automatically certified fact.

Core research invariants:

`execution report != verification report != verified fact != observed outcome`

and:

`verification context != execution context != adjudication context != appeal context != review context != decision context`

The first Level 3.1h experiment generates a browser-local `PoAIExecutionVerificationSidecar`. It references the root decision and required Execution Sidecar, keeps verifier authority and independence unknown, records a declared verification result and verification method, and explicitly does not establish verified execution/compliance, observed outcome, legal effect, truth, causality, authority, independence, responsibility, or a canonical verdict.

Tracking / review:

- Execution Verification RFC: Issue #60;
- implementation: Issue #61;
- live acceptance: Issue #62.

### Observed Outcome Sidecar

[`OUTCOME_ARTIFACT.md`](OUTCOME_ARTIFACT.md)

Explores later observation of the real-world outcome as a separate provenance artifact rather than treating an Execution Verification report as the outcome itself.

Core research invariants:

`verification report != outcome observation != causal attribution != responsibility`

and:

`observed outcome report != truth certification`

The first Level 3.1i experiment generates a browser-local `PoAIObservedOutcomeSidecar`. It reuses the frozen Genesis outcome vocabulary exactly, keeps observer authority and independence unknown, records a separate observation evidence horizon and causal status, and explicitly does not establish certified truth, causal proof, responsibility, legal effect, authority, independence, canonical outcome or canonical verdict. `not_realized_after_intervention` requires intervention/execution provenance but does not prove causality.

Tracking / review:

- Observed Outcome RFC: Issue #64;
- implementation: Issue #65;
- live acceptance: Issue #66.

### Successor Proposal Sidecar

[`SUCCESSOR_PROPOSAL_ARTIFACT.md`](SUCCESSOR_PROPOSAL_ARTIFACT.md)

Explores the transition from later outcome observations to a candidate append-only successor without automatically materializing or canonicalizing a new PoAI decision record.

Core research invariants:

`outcome observation != successor proposal != successor record != canonical successor`

`later evidence != earlier knowledge`

and:

`proposal readiness cues != authority to publish successor`

The first Level 3.1j experiment generates a browser-local `PoAISuccessorProposalSidecar`. It references the source decision version and one or more Outcome Observation IDs, proposes the next record id/version and Genesis outcome status, preserves the original Decision Boundary, Knowledge Cutoff and decision-time Future Target epistemic status by explicit requirement, keeps proposer authority unknown, exposes non-scalar review cues, and establishes no successor, canonical outcome, truth, causal proof, responsibility or legal effect.

Tracking / review:

- Successor Proposal RFC: Issue #69;
- implementation: Issue #70;
- live acceptance: Issue #71.

### Level 4.0a Deterministic Binding

[`VERIFIABLE_BINDING.md`](VERIFIABLE_BINDING.md)

Begins the Level 3 → Level 4 transition by making JSON artifacts reproducibly bindable before introducing signatures, signer identity or materialization authority.

Core research invariants:

`canonical bytes != digest != signature != signer identity != signer authority != materialization authority != canonical successor`

and:

`cryptographic verification != truth certification`

The first Level 4.0a experiment generates a browser-local `PoAIBindingReceipt` using an RFC 8785-compatible JCS canonical form, UTF-8 bytes and SHA-256. It deliberately contains no signature or signer, establishes no authority/truth/responsibility/legal effect/canonical successor, is not PoAI/V, and remains outside the Genesis decision-record schema.

Tracking / review:

- Level 4 RFC: Issue #73;
- deterministic binding implementation: Issue #74;
- Level 3.1 checkpoint readiness: Issue #75;
- live acceptance: Issue #76.

### Level 4.0b Ed25519 Signature Binding

[`SIGNATURE_BINDING.md`](SIGNATURE_BINDING.md)

Adds an experimental Ed25519 signature envelope above the deterministic Level 4.0a digest while keeping key possession, identity, authority and materialization policy separate.

Core research invariants:

`matching digest != valid signature != signer identity != signer authority != materialization authority != canonical successor`

and:

`signature verification != truth certification`.

The first 4.0b experiment signs a domain-separated JCS statement that references the Level 4.0a binding, uses an ephemeral browser-local Ed25519 key, exports only the public OKP/Ed25519 JWK plus RFC 7638 thumbprint, and exposes signature validity separately from current-artifact binding match. It is aligned with the primitive choices of W3C `eddsa-jcs-2022` but explicitly does not claim Data Integrity or PoAI/V conformance.

Tracking / review:

- signature-layer RFC: Issue #80;
- implementation: Issue #81;
- live acceptance: Issue #82.
