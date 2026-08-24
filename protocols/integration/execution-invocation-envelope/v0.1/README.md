# UU-AAP Execution Invocation Envelope v0.1

**Status:** experimental stacked reusable execution profile  
**Issue:** #367  
**Dependency:** #365 / PR #366 (`execute-revalidation-gate-v0.1`)  

## Purpose

Bind one `ready` execute-revalidation decision to one exact prospective actuator invocation without invoking the actuator.

```text
ExecuteRevalidationDecision(ready)
  -> ExecutionInvocationEnvelope(one-shot, unconsumed)
  -> later adapter consumption
  != actuator invocation
  != ActionReceipt
  != outcome
```

The envelope describes the only invocation that may later be attempted. It is not proof that the attempt occurred.

## Exact binding

A conforming envelope binds the revalidation decision ID/hash, subject, capability, operation, authority scope, target binding hash, predecessor frontier, availability/approval/ActionPermit hashes, invocation ID, adapter identity and fail-closed target/frontier guards.

The envelope expiry cannot exceed the inherited execute-revalidation horizon.

## Adapter neutrality

`adapter_role = transport_only` is normative. Adapter selection does not create or transfer authority.

```text
adapter selected != authority
envelope created != invocation emitted
envelope created != permit consumed
```

## One-shot semantics

The envelope starts `one_shot = true` and `consumed = false`. Reuse, pre-consumption, target substitution, frontier substitution or expiry extension fails closed.

## Non-effects

Envelope creation does not invoke an actuator, create an `ActionReceipt`, consume the permit, perform an action, observe an outcome, create/expand authority, create future permission, prove causality, certify truth or establish liability.

## Conformance

`validate-invocation-envelope.js` validates the stacked positive fixture against the execute-revalidation fixture and rejects substitution, expiry extension, replay/reuse, guard weakening, adapter-role escalation and external-effect claims.

CI is read-only and never invokes an actuator.
