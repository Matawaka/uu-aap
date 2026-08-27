# Intent/Action Language (IAL) v0.1 — Responsibility Boundary & Handoff

**Status:** experimental responsibility-boundary profile  
**Repository:** `Matawaka/uu-aap`  
**Upstream evidence layers:** Protocol Registry v0.1, Capability Negotiation v0.1, Capability Attestation v0.1

## Purpose

IAL v0.1 is intentionally **not** a protocol for recording every internal action. It activates when an intent/action crosses a boundary where responsibility, externally observable effect, or canonical/materialized commitment changes.

The central distinction is:

```text
internal action != responsibility boundary
```

and, at a handoff:

```text
technical capability != responsibility acceptance
reproducible attestation != authority
responsibility acceptance != execution admission
execution admission != materialization permission
```

IAL records the minimum externally relevant semantic elevation. It does not require disclosure of private reasoning or chain-of-thought.

## E0–E3 elevation levels

### E0 — no responsibility boundary

Internal computation, drafting, analysis, local transformation, or other activity with no externally observable effect and no responsibility transfer.

State: `IAL_NOT_REQUIRED`.

No handoff artifact should be created merely because an internal action occurred.

### E1 — observable external-effect boundary

An action becomes externally observable, but responsibility remains with the same responsible party.

State: `ELEVATED`.

IAL records the boundary and semantic basis, but no transfer is inferred.

### E2 — responsibility handoff boundary

Responsibility for an externally relevant action/effect is offered to another party or execution line.

State: `ELEVATED`.

An explicit `ResponsibilityHandoffOffer` and `ResponsibilityHandoffAcceptance` are required. Technical compatibility or capability evidence cannot substitute for acceptance.

### E3 — materialization/canonical commitment boundary

The action may change a materialized resource, canonical state, or another durable commitment boundary.

State: `ELEVATED`.

IAL may establish who explicitly accepted responsibility for the attempted commitment, but it does **not** establish authority, execution admission, materialization permission, successful materialization, canonicality, truth, or observed outcome. Those remain downstream gates.

## Core artifacts

### `BoundaryAssessment`

Classifies whether IAL is required and at which E0–E3 level. It records only externally relevant semantic facts: intent/action identity, target, effect class, elevation level and reason codes.

### `ElevationReceipt`

Records that a boundary assessment was elevated into the IAL responsibility layer. `private_reasoning_disclosed` is fixed to `false` in v0.1.

### `ResponsibilityAssignment`

Records the currently responsible party and exact responsibility scope before a handoff. It is an explicit responsibility statement, not a legal-authority claim.

### `ResponsibilityHandoffOffer`

Offers an exact responsibility scope to another party and binds the execution implementation to an exact protocol/version/conformance requirement.

### `ResponsibilityHandoffAcceptance`

The receiving party explicitly accepts or rejects the exact offer. An accepted handoff also names the executor implementation and a reproducible capability attestation.

### `ResponsibilityHandoffResult`

Deterministically reports `not_required`, `accepted`, `rejected`, or `blocked` and preserves stronger boundaries as false/unestablished.

## Handoff chain

```text
Intent / Action
  -> BoundaryAssessment
  -> ElevationReceipt
  -> current ResponsibilityAssignment
  -> ResponsibilityHandoffOffer
  -> explicit ResponsibilityHandoffAcceptance
  -> exact capability-attestation verification
  -> ResponsibilityHandoffResult
```

For E2/E3, successful handoff requires all of the following:

1. an elevated boundary assessment;
2. an exact offer from the current responsible party;
3. exact acceptance by the named receiving party;
4. exact responsibility-scope equality (no silent partial acceptance);
5. executor implementation identity bound to a reproducible attestation;
6. exact registered protocol/version/release binding;
7. explicit conformance-level set inclusion.

## Why attestation is not acceptance

The capability layer can establish repository-scoped reproducible evidence that a particular implementation passed a particular immutable conformance suite. It cannot decide who accepts responsibility for using that implementation in a particular intent/action.

Therefore:

```text
attested_compatible -> may support a handoff
attested_compatible -/-> responsibility accepted
```

The acceptance must be a separate artifact.

## Product-facing Compact Envelope

[`compact/`](compact/) adds an optional provider-neutral preflight wrapper and read-only CLI:

```text
parse -> validate -> inspect -> STOP
```

It binds one exact Product Contract, repository frontier, declared intent, target, E0–E3 boundary flags, evidence references and fixed non-effects. It is designed for product and transport tooling that needs a compact input before the full handoff or downstream execution cycle.

The first exact consumer vectors are:

- Маркетолог Пессимиста — E0 local claim inspection;
- Честный найм — E1 display candidate for a fictional human-review packet.

The Compact Envelope is not a handoff acceptance or authority artifact:

```text
IAL Envelope != Responsibility Acceptance
IAL Expression != Authority
IAL Expression != Execution Admission
Validation Success != ActionPermit
Inspection Receipt != External Effect
Consumer Binding != Authority Transfer
```

The CLI exposes only `parse`, `validate`, `inspect` and `help`. It has no execute command, network access, provider call or filesystem-write surface.

For E2 and E3, inspection reports which full IAL/downstream gates remain required but keeps responsibility acceptance, authority, ActionPermit, execution admission, materialization permission, observed outcome and canonical state false.

## Relationship to the wider integration cycle

This profile is the responsibility-boundary segment inside the larger architecture:

```text
ContextFrame
  -> Intent
  -> Action
  -> Revalidation
  -> Collision / Reconciliation
  -> CommitDecision
  -> Commit
  -> Observation
  -> Canonicalization
  -> Provenance
```

IAL v0.1 stops before execution/commit. It makes the responsibility handoff explicit so later CCRP/authority/materialization gates can consume a clear boundary without conflating it with permission.

The Compact Envelope is an earlier product/transport input surface and does not shorten or bypass that downstream cycle.

## Files

- `boundary-assessment.schema.json`
- `elevation-receipt.schema.json`
- `responsibility-assignment.schema.json`
- `responsibility-handoff-offer.schema.json`
- `responsibility-handoff-acceptance.schema.json`
- `responsibility-handoff-result.schema.json`
- `evaluate-handoff.js`
- `test-ial.js`
- `examples/`
- `compact/compact-envelope.schema.json`
- `compact/inspection-receipt.schema.json`
- `compact/ial-compact.js`
- `compact/test-compact.js`
- `compact/examples/`

## Non-claims

IAL v0.1 does not establish legal identity, legal authority, universal responsibility, execution admission, materialization permission, successful external effect, canonicality, factual truth, causal proof, moral correctness, or PoAI/V conformance.

The Compact Envelope and CLI additionally do not establish responsibility acceptance, ActionPermit validity, provider admission, transport success, external outcome or successor authority.
