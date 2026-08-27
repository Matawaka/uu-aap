# FCL → UU-AAP Core ActionPermit Binding v0.1

**Status:** experimental bounded Action Gate adapter  
**Issue:** #552  
**Predecessor:** reconciled PR #551  
**Core:** `protocols/core/v0.1`  
**Downstream reusable stack:** `protocols/integration/pre-action-evidence-bundle/v0.1`, `protocols/integration/pre-action-authorize-admission/v0.1`

## Purpose

This profile is the first FCL layer allowed to materialize the canonical Core permission primitive. It consumes the exact reconciled CoordinationReceipt evidence from #551 and emits one bounded Core `ActionPermit`.

```text
StateReceipt
+ IntentReceipt
+ AuthorityReceipt
+ CoordinationReceipt
-> Core ActionPermit
-> later PreActionEvidenceBundle
-> later AuthorizeAdmission
-> later ExecuteRevalidation
-> later invocation
```

The adapter stops at permit creation. It does not consume the permit and does not execute the requested control.

## Mandatory distinctions

```text
CoordinationReceipt != ActionPermit
ActionPermit != ActionReceipt
ActionPermit != Execution
Permit Created != Permit Consumed
Permit Exists != Execute Ready Forever
ActionPermit != Future/General Authority
```

For `REQUEST_INTERRUPT`, a permit does not mean the predecessor run has been interrupted. For `REQUEST_SUCCESSOR`, a permit does not mean a ContinuationReceipt or successor run exists.

## Exact predecessor binding

Input carries:

```text
exact #551 CoreCoordinationBindingInput
+ exact #551 Core CoordinationReceipt
+ permit_id
+ issued_at
+ expires_at
```

The merged #551 `validateBoundCoordinationReceipt` is executed directly. A semantically similar or independently reconstructed coordination object is insufficient.

The ActionPermit has the exact Core predecessor set:

```text
StateReceipt
IntentReceipt
AuthorityReceipt
CoordinationReceipt
```

Availability remains transitively mandatory through the CoordinationReceipt and is independently used to bound permit lifetime.

## Deterministic target binding

The permit target is derived from the validated FCL execution context:

```text
resource = FCL required_target
operation = FCL required_scope
expected_predecessor_frontier = StateReceipt frontier revision
authority_scope = FCL required_scope
```

`target_binding_hash` is SHA-256 over recursively key-sorted compact JSON of that exact four-field target object. The same hash appears in both ActionPermit assertions and payload.

No wildcard, different run/epoch, broader scope or different frontier may be substituted.

## Permit lifecycle

A positive permit fixes:

```text
gate = fail_closed
one_shot = true
consumed = false
execute_revalidation_required = true
```

Time is bounded by the already-proven availability horizon:

```text
CoordinationReceipt.issued_at <= ActionPermit.issued_at
ActionPermit.issued_at < ActionPermit.expires_at
ActionPermit.issued_at <= AvailabilityClaim.valid_until
ActionPermit.expires_at <= AvailabilityClaim.valid_until
```

This profile cannot extend the availability horizon.

## Core output

The sole positive output is an ordinary Core v0.1 `ActionPermit`:

```text
receipt_type = ActionPermit
assertions.action_permitted = true
assertions.action_scope = exact FCL required_scope
assertions.target_binding_hash = exact deterministic target hash
assertions.one_shot = true
assertions.execute_revalidation_required = true
```

The payload retains exact refs to State, Intent, Authority, Coordination and Availability, plus FCL run/epoch/chain/intent context and the unchanged availability horizon.

## Compatibility with the reusable authorize stack

The permit exposes the existing fields consumed by the provider-neutral pre-action line:

```text
payload.gate
payload.expires_at
payload.one_shot
payload.consumed
payload.target_binding_hash
```

The downstream stack remains separate:

```text
ActionPermit created
!= PreActionEvidenceBundle created
!= authorize admitted
!= execute ready
!= actuator invoked
```

This profile records all three downstream states as false.

## Fixed non-effects

Core-required:

```text
action_performed = false
outcome_observed = false
authority_expanded = false
liability_established = false
```

Additional fixed false boundaries:

```text
execution_admitted
permit_consumed
availability_extended
future_action_permission_created
general_authority_created
interrupt_completed
continuation_receipt_created
successor_run_created
runtime_state_transitioned
legal_authority_established
universal_authority_established
legal_effect_established
truth_certified
causality_proven
private_reasoning_included
```

## Fail-closed behavior

The profile rejects tampered coordination evidence, predecessor substitution, subject/frontier drift, target/scope drift, permit issuance before coordination, zero or negative lifetime, issue/expiry after availability expiry, target-binding substitution, reusable or already-consumed permits, non-fail-closed gate, missing execute-revalidation requirement, action/outcome/execution claims, future/general authority creation, legal/truth/causality overclaim, and receipt-type escalation.

## CLI

```text
core-action-permit-binding.js validate <input.json|->
core-action-permit-binding.js materialize <input.json|->
```

`materialize` outputs JSON only. It does not consume or execute the permit. There is no `execute`, `interrupt`, `resume`, `send`, `switch`, `activate`, `create-successor` or `consume` command.

## Conformance

The dedicated suite:

- uses the exact #551 test output for the interrupt path rather than duplicating predecessor semantics;
- validates an independent successor-control path;
- checks deterministic Core identity and target identity;
- verifies the exact Core predecessor graph;
- proves generic pre-action-compatible permit fields;
- exercises temporal, replay, substitution and escalation failures;
- re-runs Core, PreActionEvidenceBundle and AuthorizeAdmission validators unchanged in CI.

## Non-effects of this repository slice

No Core schema change, no PoAI Authority Root/Grant change, no availability/coordination/pre-action profile mutation, no permit consumption, no PreActionEvidenceBundle creation, no authorize/execute transition, no runtime interrupt, no successor creation, no provider/model/actuator invocation, no transport send, no KONTUR activation, no release or tag.
