# FCL Execute Revalidation Source Parameterization v0.1

**Issue:** #575  
**Origin frontier:** `f4802d5b30536569cc9aa43df5ba78b5f13f1d11`

## Purpose

Parameterize the provider-neutral Execute Revalidation Gate with the exact FCL authorize source established by #574.

```text
exact #574 authorize phase
+ exact admissible #572 assessment
-> ExecuteRevalidationDecision(status = ready)
!= invocation envelope
!= actuator invocation
!= permit consumption
!= action performed
```

## Reusable generic seam

The historical `validate-execute-revalidation.js`, schema and fixture remain unchanged. An adjacent import-safe helper extracts the same rules while making the admission source explicit:

```text
validate-parameterized-decision.js
validateDecision(candidate, sourceAdmission)
```

`test-parameterized-decision.js` re-runs the historical validator and proves the helper rejects the same 41 historical mutation classes.

```text
Source Parameterization != Semantic Relaxation
Explicit Source != New Authority
```

## Decision semantics

This layer preserves the currently implemented historical behavior: only a conforming `ready` decision is materialized. Although the schema permits `denied`, #575 does not introduce denied-decision semantics. Stale, consumed, non-one-shot, substituted or otherwise invalid input fails closed.

The FCL evaluator additionally requires:

```text
authorize_phase.status = authorized
authorize_phase.one_shot = true
authorize_phase.consumed = false
authorize_phase.authorized_at <= evaluated_at
```

and exact binding across admission, bundle, Approval, ActionPermit, target and predecessor frontier.

## Hard boundary

```text
Ready Revalidation != Invocation Envelope
Ready Revalidation != Execute
Ready Revalidation != Permit Consumption
Lifecycle target_phase = execute != Execute Phase Entered
Pre-Execute Evidence != Actuator Command
```

The generic decision retains all historical non-effects. The FCL receipt additionally fixes false:

```text
permit_consumed
invocation_envelope_created
actuator_invocation_emitted
action_receipt_created
action_performed
outcome_observed
execute_phase_entered_as_effect
runtime_state_transitioned
future_action_permission_created
authority_expanded
```

## Successor

The current Execution Invocation Envelope validator is also fixture-bound. Therefore the only successor is:

```text
PARAMETERIZE_EXECUTION_INVOCATION_ENVELOPE_FCL_SOURCE
```

No invocation envelope is created here.

## CLI

Artifact-only commands:

```text
validate
revalidate
validate-receipt
help
```

No `invoke`, `execute`, `probe`, `consume`, `interrupt`, `send` or `actuate` command exists.
