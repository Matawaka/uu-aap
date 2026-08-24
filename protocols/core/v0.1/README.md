# UU-AAP Core v0.1 — Reusable Protocol Stack

**Status:** experimental stable-core candidate  
**Scope:** repository-independent protocol primitives  
**Tracking:** issue #303

## Purpose

UU-AAP Core extracts the smallest reusable protocol stack needed to transform an observed predecessor state into a bounded action and then back into an observed successor state without allowing implicit transitions between epistemic, intentional, authority, coordination, execution, and outcome layers.

The canonical flow is:

```text
State / Evidence Anchor
  -> Possibility / Availability
  -> Intent
  -> Authority / Responsibility
  -> Coordination / CCRP
  -> Action Gate / Execution Boundary
  -> Outcome / Provenance / Successor State
```

No arrow is an implication. Every transition is carried by one or more typed receipts.

## Core invariant

```text
Proof of Possibility != Proof of Intent != Proof of Action != Proof of Liability
```

And, more generally:

```text
observation != availability != intent != authority != coordination
!= permission to act != performed action != observed outcome
!= causality != truth != liability
```

## Common receipt envelope

Every Core v0.1 receipt MUST carry:

- `protocol` and `version`;
- `receipt_type`;
- `subject`;
- `frontier` with exact revision/state identifier and observation time;
- `predecessor_receipt_hashes`;
- `assertions`;
- `non_effects`;
- `issuer`;
- `issued_at`;
- `payload`;
- `content_hash`;
- `signature_profile`.

`assertions` state what the receipt establishes inside its declared scope.

`non_effects` state stronger conclusions that the receipt explicitly does **not** establish. Boundary-sensitive receipts MUST include the non-effects required by `validate-core.js`.

The content hash is:

```text
sha256(UTF8(canonical-json(identity-projection(receipt))))
```

where the identity projection excludes `content_hash` and `signature_profile`. Core v0.1 uses a deterministic recursively key-sorted JSON representation for its conformance fixture. This is a local Core v0.1 identity rule and is not a claim of universal canonical JSON interoperability.

A signature profile MAY authenticate the already-bound receipt. A signature MUST NOT upgrade factual truth, authority scope, responsibility, legal effect, or canonicality unless a separate profile expressly and validly establishes that stronger conclusion.

## Seven primitives

### 1. State / Evidence Anchor

Input: observable facts, revision/state identifier, observation frontier.

Output: `StateReceipt` or `SuccessorStateReceipt`.

Required distinction:

```text
state anchored != complete world state != truth certified
```

### 2. Possibility / Availability

Input: `StateReceipt` plus a resource/capability claim.

Output: `AvailabilityClaim`.

Required distinction:

```text
available != intended != authorized != executed
```

### 3. Intent

Input: `StateReceipt`, subject, purpose, scope.

Output: `IntentReceipt`.

Intent declaration MUST have no external side effect by itself.

Required distinction:

```text
intent declared != action performed != responsibility accepted
```

### 4. Authority / Responsibility

Input: `IntentReceipt` plus pre-existing permission/entitlement/responsibility evidence.

Output: `AuthorityReceipt` and/or `ResponsibilityReceipt`.

Core v0.1 prohibits implicit permission expansion:

```text
authority evidence != new permission grant
```

A profile that grants or delegates authority must model that as a separate explicit effect and may not disguise it as ordinary authority observation.

### 5. Coordination / CCRP

Input: compatible predecessor receipts from independent contexts.

Output: `CoordinationReceipt`.

CCRP is an adapter/coordination primitive, not global authority.

Required distinction:

```text
contexts reconciled != execution authorized
```

### 6. Action Gate / Execution Boundary

Input: required predecessor state, intent, authority/responsibility, and coordination receipts.

Pre-action output: `ActionPermit`.

Post-action output: `ActionReceipt`.

The gate MUST fail closed on missing, unknown, stale, mismatched, or frontier-incompatible prerequisites. `ActionPermit` records bounded admissibility only; it does not assert that the action occurred.

### 7. Outcome / Provenance / Successor State

Input: `ActionReceipt` plus observable post-action evidence.

Output: `OutcomeReceipt`, then `SuccessorStateReceipt`.

Required distinction:

```text
action receipt != observed outcome != causal proof != universal canonicality
```

The successor receipt establishes the next protocol frontier and preserves predecessor linkage.

## Typed interface graph

```text
StateReceipt -> AvailabilityClaim
StateReceipt -> IntentReceipt
IntentReceipt -> AuthorityReceipt / ResponsibilityReceipt
AvailabilityClaim + IntentReceipt + Authority/Responsibility -> CoordinationReceipt
StateReceipt + IntentReceipt + Authority/Responsibility + CoordinationReceipt -> ActionPermit
ActionPermit -> ActionReceipt
ActionReceipt -> OutcomeReceipt
OutcomeReceipt -> SuccessorStateReceipt
```

A receipt MUST NOT be accepted as a substitute merely because it contains semantically similar prose.

## Frontier rules

All pre-action receipts consumed by an `ActionPermit` MUST resolve to the same predecessor frontier.

`OutcomeReceipt` MAY move to a successor frontier only after an `ActionReceipt`.

`SuccessorStateReceipt` MUST use the exact successor frontier declared by its predecessor `OutcomeReceipt`.

Frontier mismatch is a hard failure at action boundaries.

## Fail-closed semantics

Core validation rejects at least:

- missing required predecessor receipt types;
- unknown predecessor hashes;
- content-hash mismatch;
- missing required `non_effects`;
- a required non-effect set to a value other than `false`;
- authority receipts that imply permission expansion;
- coordination receipts that imply execution authorization;
- action permits whose prerequisite receipts do not share one predecessor frontier;
- outcome/successor frontier mismatch.

Validation success means only that the fixture satisfies this Core v0.1 contract. It does not certify the truth of payload claims or the legitimacy of a real-world actor.

## Extensions, not hidden core dependencies

The following remain profiles/extensions composed above Core:

- Readiness Aggregator;
- Human Activation Review;
- Activation Preflight;
- Durable Responsibility Ledger;
- Appeal / Contestability;
- Rescue / Survival;
- Preventive Intent Challenge (PIC);
- Sustainability / Convergence;
- Circumstantial Provenance;
- KONTUR-specific activation and live-host machinery.

Core v0.1 does not import, activate, or mutate any KONTUR component.

## Conformance fixture

`end-to-end.fixture.json` demonstrates one complete chain:

```text
State -> Availability -> Intent -> Authority -> Coordination
-> ActionPermit -> ActionReceipt -> Outcome -> SuccessorState
```

Run:

```bash
node protocols/core/v0.1/validate-core.js
```

The validator also runs negative in-memory regression vectors for missing non-effects, implicit permission expansion, missing coordination, and frontier mismatch.

## Non-effects of this protocol layer

Core v0.1 does not by itself:

- activate KONTUR or any other system;
- create real execution authority;
- expand repository permissions;
- accept legal or moral responsibility;
- certify identity, truth, causality, legality, or liability;
- establish universal canonicality;
- require continuous telemetry or prompt-history logging.

It defines typed boundaries for evidence-preserving composition.
