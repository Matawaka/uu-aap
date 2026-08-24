# UU-AAP Invocation Evidence ↔ Core ActionReceipt Binding v0.1

**Status:** experimental stacked reusable execution profile  
**Issue:** #369  
**Dependency:** #367 / PR #368

## Purpose

Bind evidence of one emitted actuator invocation to a Core `ActionReceipt` without inferring outcome, successor state or causality.

```text
ExecutionInvocationEnvelope
  -> invocation evidence
  -> Core ActionReceipt on predecessor frontier
  != OutcomeReceipt
  != SuccessorStateReceipt
  != causality proof
```

The profile is prospective and provider-neutral. Its positive fixture is synthetic conformance evidence only.

## Core alignment

Core v0.1 requires:

```text
ActionPermit -> ActionReceipt
ActionReceipt frontier = predecessor frontier
ActionReceipt != observed outcome
```

The binding therefore requires the exact inherited `ActionPermit` hash as the sole ActionReceipt predecessor and preserves the exact predecessor frontier. The `ActionReceipt` uses the Core identity rule: hash over the recursively key-sorted identity projection excluding `content_hash` and `signature_profile`.

## Invocation evidence

Invocation evidence must bind the exact envelope ID/hash, invocation ID, adapter, target binding and predecessor frontier, record successful fail-closed guards, and record one-shot envelope/permit consumption by execution.

Emission evidence may support `ActionReceipt.action_performed` only for the exact bounded invocation scope. It does not establish expected outcome, truth, liability or causality.

## Non-effects

A conforming binding does not establish outcome, successor state, causality, truth or liability; does not create/expand authority; and does not create future action permission.

## Conformance

`validate-invocation-action-receipt-binding.js` validates the stacked envelope, invocation evidence identity, Core ActionReceipt identity/frontier/predecessor/non-effects and rejects substitution, frontier relabeling, permit mismatch, guard weakening, unconsumed execution, outcome escalation and hash laundering.

CI is read-only and invokes no actuator.
