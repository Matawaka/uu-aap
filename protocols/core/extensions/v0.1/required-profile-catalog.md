# UU-AAP Core v0.1 — Required Extension Profile Supplement

**Status:** experimental conformance supplement  
**Depends on:** `protocols/core/v0.1` and `protocols/core/extensions/v0.1`  
**Tracking:** issue #303

## Purpose

This supplement closes the remaining extension-coverage acceptance gap for the minimal stable core without changing KONTUR or any live activation/runtime surface.

The common `ExtensionReceipt` envelope now also recognizes four profiles that were already declared outside Core but were not yet exercised by the machine-readable extension conformance fixture:

- Human Activation Review;
- Activation Preflight;
- Rescue / Survival;
- Durable Responsibility Ledger.

They remain extensions. None is promoted into a Core primitive.

## Shared invariant

```text
extension evidence != intent != authority != responsibility acceptance
!= coordination != ActionPermit != performed action != observed outcome
```

A positive extension result may contribute evidence to a later Core decision, but may not substitute for the typed Core receipt required at that boundary.

## Human Activation Review

`extension_type = human_activation_review`

Safe effects:

- `human_review_outcome_recorded`
- `activation_intent_preparation_requested`

Allowed contribution families:

- `IntentReceipt`
- `CoordinationReceipt`

Normative distinction:

```text
positive human review
!= activation intent
!= activation authorization
!= responsibility acceptance
!= activation performed
```

The review may request or prepare a later intent step. It does not create that later step.

## Activation Preflight

`extension_type = activation_preflight`

Safe effects:

- `preflight_assessed`
- `missing_precondition_recorded`

Allowed contribution families:

- `AvailabilityClaim`
- `CoordinationReceipt`

Normative distinction:

```text
preconditions observed
!= prerequisites satisfied
!= action permitted
!= activation performed
```

## Rescue / Survival

`extension_type = rescue_survival`

Safe effects:

- `survival_risk_recorded`
- `rescue_review_requested`

Allowed contribution families:

- `StateReceipt`
- `AvailabilityClaim`
- `CoordinationReceipt`

Normative distinction:

```text
survival risk observed
!= emergency authority granted
!= Action Gate bypassed
!= rescue action performed
```

Any emergency authority must still be explicit and independently evidenced by the relevant Core authority path.

## Durable Responsibility Ledger

`extension_type = durable_responsibility_ledger`

Safe effects:

- `responsibility_evidence_recorded`
- `responsibility_state_checkpointed`

Allowed contribution families:

- `ResponsibilityReceipt`
- `OutcomeReceipt`

Normative distinction:

```text
responsibility evidence recorded
!= responsibility accepted
!= authority granted
!= liability established
```

The ledger preserves evidence; it does not manufacture the responsibility that it records.

## Supplementary fixture

`required-profiles.fixture.json` places all four profiles on one predecessor frontier and requires:

```text
action_permit_created = false
core_action_gate_required = true
extension_receipts_substitute_for_core_receipts = false
```

The validator also rejects:

- Human Activation Review claiming activation authorization;
- Preflight creating an `ActionPermit`;
- Rescue / Survival bypassing the Action Gate;
- Durable Responsibility Ledger accepting responsibility;
- omission of a required profile from the supplementary fixture;
- any aggregate result that creates an action permit.

## Non-effects

This supplement does not activate any system, alter KONTUR, grant authority, accept responsibility, perform rescue/activation, establish liability, or create a hidden execution path.
