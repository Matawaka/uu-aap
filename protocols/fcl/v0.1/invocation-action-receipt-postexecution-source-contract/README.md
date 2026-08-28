# FCL Invocation→ActionReceipt Post-Execution Source Contract v0.1

**Status:** experimental source-contract layer  
**Issue:** #579  
**Origin frontier:** `88a0cb4583b0840308387a9c528087f24ebd9574`

## Purpose

This layer implements the development successor emitted by merged #578:

```text
PARAMETERIZE_INVOCATION_ACTION_RECEIPT_FCL_SOURCE
```

It does **not** claim that execution has occurred. It prepares an exact typed contract for the evidence that a future runtime execution source must supply before the reusable `Invocation Evidence ↔ Core ActionReceipt Binding v0.1` may accept an FCL action.

```text
exact #578 ExecutionInvocationEnvelope
+ exact FCL invocation-envelope receipt
-> FCLInvocationActionReceiptPostExecutionSourceContract
!= ActuatorInvocationEvidence
!= Core ActionReceipt
!= action performed
```

## Compatibility gap made explicit

The historical post-execution validator is bound to a demo invocation envelope and hard-codes:

```text
performed_scope = <operation>:urn:uu-aap:resource:demo-target
```

Merged #578 carries an exact `target_binding_hash`, operation and predecessor frontier, but it does not carry a canonical `performed_resource_ref`.

This layer therefore fixes the distinction:

```text
Target Binding Hash != Performed Resource Identity
Resource Identity Required != Resource Identity Inferred
```

The contract records:

```text
performed_resource_ref.status = required_from_execution_evidence
performed_resource_ref.value = null
performed_resource_ref.inference_from_target_binding_hash = false
```

A future execution adapter must supply the resource identity explicitly together with genuine execution evidence.

## Reusable parameterized validator seam

The historical validator/schema/fixture remain byte-identical. An adjacent import-safe helper accepts:

```text
validateBinding(candidate, sourceEnvelope, performedResourceRef)
```

Only two hard-coded inputs are parameterized:

1. demo `ExecutionInvocationEnvelope` -> explicit `sourceEnvelope`;
2. `urn:uu-aap:resource:demo-target` -> explicit non-empty `performedResourceRef`.

The helper preserves all historical post-execution semantics and rejects the same 29 historical mutation classes.

```text
Source Parameterization != Semantic Relaxation
Resource Parameterization != Target Inference
```

## Required future execution evidence

A future post-execution candidate must prove the exact envelope/invocation/adapter/target/frontier and:

```text
emission_status = emitted
expected_target_guard_passed = true
expected_predecessor_guard_passed = true
one_shot_envelope_consumed = true
action_permit_consumed = true
performed_resource_ref = explicit non-empty value
```

The Core `ActionReceipt` must then remain on the predecessor frontier, inherit the exact ActionPermit as its sole predecessor, prove `action_performed=true`, bind performed scope as `<operation>:<performed_resource_ref>`, and use the exact invocation-evidence hash as `payload.effect_ref`.

None of those post-execution facts is synthesized by this layer.

## Non-effects

The contract fixes all of the following false:

```text
actuator_invocation_emitted
envelope_consumed
permit_consumed
invocation_evidence_created
invocation_action_receipt_binding_created
core_action_receipt_created
action_performed
outcome_observed
successor_state_established
runtime_state_transitioned
causality_proven
truth_certified
liability_established
authority_expanded
future_action_permission_created
```

Canonical distinctions remain:

```text
ActionReceipt != OutcomeReceipt
ActionReceipt != SuccessorStateReceipt
Emission Evidence != Outcome Proof
Action Performed != Expected Outcome Achieved
```

## Successor

The next safe layer is:

```text
BIND_FCL_RUNTIME_EXECUTION_EVIDENCE_SOURCE
```

That layer must obtain an explicit performed resource identity and genuine runtime execution evidence. This contract grants no authority to create such evidence and performs no action itself.

## CLI

The implementation exposes artifact-only commands:

```text
validate
prepare
validate-contract
```

There is deliberately no `invoke`, `execute`, `emit`, `consume`, `send` or `actuate` command.
