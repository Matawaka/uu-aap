# UU-AAP Bounded Action Lifecycle Closure Binding v0.1

**Status:** experimental stacked reusable closure profile  
**Issue:** #373  
**Dependency:** #371 / PR #372

## Purpose

Close exactly one bounded action lifecycle after one-shot execution and observed successor state. Closure records scope exhaustion; it does not authorize a successor action.

```text
consumed ActionPermit + consumed InvocationEnvelope
+ ActionReceipt + OutcomeReceipt + SuccessorStateReceipt
  -> bounded closure
  -> exact scope exhausted
  != next action authorized
```

## Exact chain

Closure binds the exact observation binding, target, predecessor and successor frontiers, ActionPermit, invocation envelope, ActionReceipt, OutcomeReceipt and SuccessorStateReceipt. Both permit and envelope must be one-shot and consumed, and the successor must have been observed before closure.

## No carry-forward

Approval, ActionPermit, adapter admission and authority do not carry forward merely because a successor state exists. Any next action requires a fresh bounded chain.

## Non-effects

Closure does not permit a next action, create/expand authority, create future/general permission, prove causality, certify truth or establish liability.

## Conformance

The validator rejects chain substitution, unconsumed/reusable permit or envelope, missing scope exhaustion, successor-action authorization, approval/permit carry-forward, authority/future-permission escalation and content-hash laundering.

CI is read-only and performs no external action.
