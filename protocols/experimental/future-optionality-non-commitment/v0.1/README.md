# Future Optionality / Non-Commitment v0.1

Status: experimental, provider-neutral, non-actuating.

This profile represents a bounded future-facing model without turning that model into intent, obligation, authorization, inevitability, or a required successor state.

## Invariants

- `Forecast != Intent != Obligation`
- `Future Target != Required Successor`
- `Plan != Authorization`
- `Successor Proposal != Future State`
- `High Probability != Inevitability`
- `Abandoning a Future Representation != Erasing its Provenance`
- `Replanning != Admission of Fault or Liability`

## Lifecycle

A future representation has one of five states:

- `active`: still usable as a bounded planning/attention input;
- `superseded`: replaced by a separately identified successor representation;
- `abandoned`: intentionally no longer used as the active future model;
- `realized`: the represented target/state was later observed as realized;
- `expired`: its bounded horizon elapsed without carrying the representation forward.

`superseded` requires a successor representation reference. `abandoned`, `superseded`, `realized`, and `expired` preserve the predecessor representation and its provenance rather than deleting or rewriting it.

## Evidence and horizon

The receipt binds one future representation, its source/provenance, evidence references, a bounded horizon, and an optional probability. Probability is descriptive evidence only. Even `1.0` does not establish inevitability, intent, obligation, authorization, or execution.

A stale or expired representation cannot be silently reused as fresh intent, approval, authority, or ActionPermit.

## Non-effects

A conforming receipt does not create intent, commitment, contractual/legal obligation, authority, ActionPermit, required successor state, inevitability, fault, responsibility, liability, sanction, or external action.

Abandonment and replanning are lifecycle events over a representation. They are not proof that the earlier representation was wrongful, deceptive, negligent, or legally binding.
