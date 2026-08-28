# FCL Execution Lifecycle Authorize Phase Binding v0.1

**Issue:** #573  
**Origin frontier:** `ee4970e207954bc0ef7f2273b1a3ec975d76eed8`

## Purpose

Bind the exact admissible FCL PreAction Authorize Admission Assessment from #572 into the reusable Bounded Execution Lifecycle **authorize phase only**.

```text
exact #572 admissible assessment
+ exact ActionPermit
+ exact action-specific Approval
-> authorize phase binding
!= execute revalidation
!= execute
```

The output is a partial lifecycle evidence artifact. It deliberately does not synthesize `execute`, `observe`, or `close`.

## Reusable lifecycle seam

The historical five-phase validator remains byte-identical. An adjacent import-safe helper extracts only its existing authorize-phase rules:

```text
protocols/integration/execution-lifecycle/v0.1/validate-authorize-phase.js
validateAuthorizePhase(phase, context)
```

The helper is checked against the historical positive fixture and authorize-specific negative mutations. FCL consumes this helper rather than defining parallel lifecycle semantics.

## Inputs

The binding input contains:

- exact #571 assessment input;
- exact generic `PreActionAuthorizeAdmissionAssessment`;
- exact `FCLPreActionAuthorizeAdmissionAssessmentReceipt`;
- binding identity;
- `authorized_at`.

The #571 artifacts are canonically reconstructed from the supplied input. Only:

```text
decision.status = admissible
next_safe_action = BIND_EXECUTION_LIFECYCLE_AUTHORIZE_PHASE
```

may enter this layer.

## Authorize phase

The emitted `authorize_phase` uses the reusable lifecycle fields:

```text
status = authorized
frontier = exact predecessor frontier
ActionPermit ref = exact pre-existing permit
Approval ref = exact action-specific approval binding
AdmissionAssessment ref = exact admissible generic assessment
target_binding_hash = exact target
one_shot = true
consumed = false
```

Time ordering is bounded:

```text
ActionPermit.issued_at
<= assessment.evaluated_at
<= authorized_at
<= authorization_must_occur_by
```

and `authorized_at` must also remain within the exact Availability, Approval and ActionPermit horizons.

## Meaning of `authorized`

`status = authorized` is the lifecycle authorize-phase evidence state. It is not an actuator event and does not imply external execution.

```text
Authorize Phase Binding != Permit Consumption
Authorize Phase Binding != Execute Revalidation
Authorize Phase Binding != Actuator Invocation
Authorized Phase Evidence != Action Performed
Partial Lifecycle Artifact != Completed Lifecycle Record
```

## Fixed non-effects

The FCL receipt fixes false:

```text
permit_consumed
execute_revalidation_ready
execute_phase_entered
execution_admitted
actuator_invocation_emitted
action_performed
outcome_observed
runtime_state_transitioned
future_action_permission_created
authority_expanded
successor_state_created
completed_lifecycle_created
```

The nested reusable authorize phase also preserves:

```text
action_performed = false
authority_expanded = false
future_action_authorized = false
action_permit_created_by_adapter = false
```

## Successor boundary

The merged generic Execute Revalidation Gate is still fixture-bound and not a parameterized library consumer. Therefore the only successor is:

```text
PARAMETERIZE_EXECUTE_REVALIDATION_FCL_SOURCE
```

No `ready` execute decision is created by this layer.

## CLI

Artifact-only commands:

```text
validate
bind
validate-receipt
help
```

No `execute`, `probe`, `consume`, `interrupt`, `send`, or `actuate` command exists.
