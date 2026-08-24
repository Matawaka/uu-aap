# UU-AAP AI Gateway ↔ Bounded Execution Lifecycle Binding v0.1

**Status:** experimental reusable binding profile  
**Issue:** #351  
**AI Gateway:** `protocols/integration/ai-gateway/v0.1`  
**Execution Lifecycle:** `protocols/integration/execution-lifecycle/v0.1`  
**Stable Core:** `protocols/core/v0.1`

## Purpose

This profile binds two already independent protocol surfaces without merging their authority semantics.

```text
AI Gateway != Bounded Execution Lifecycle
binding != authority transfer
mapping != implicit transition
```

The binding makes it possible for an agent-facing Gateway to participate in a bounded execution lifecycle while preserving the Core Action Gate and a separate actuator.

## Canonical mapping

```text
Gateway inspect / qualify
        ↓ evidence only
Lifecycle prepare

Gateway authorize
        ↓ admission assessment only
Lifecycle authorize + pre-existing Core ActionPermit

separate actuator
        ↓
Lifecycle execute

Gateway observe
        ↓ observation adapter evidence
Lifecycle observe + Core post-action receipts

no Gateway operation
        ↓
Lifecycle close
```

## 1. Prepare binding

Gateway `inspect` and `qualify` may contribute read-only evidence to lifecycle `prepare`.

They MUST NOT:

- create an `ActionPermit`;
- arm an action;
- perform an action;
- expand authority.

```text
inspection != preparation authority
qualification != authorization
read-only evidence != armed action
```

## 2. Authorize binding

Gateway `authorize` maps only to an **admission assessment** inside lifecycle `authorize`.

A conforming binding requires a matching Core `ActionPermit` to already exist on the exact predecessor frontier. If human approval is required, the approval remains action-specific and frontier-bound.

```text
GatewayDecisionReceipt(admissible) != ActionPermit
Gateway authorize != lifecycle authorization by itself
adapter admission != authority creation
```

The same permit reference must be visible in the Core evidence and the lifecycle authorization phase.

## 3. Execute boundary

There is intentionally **no Gateway operation mapped to lifecycle `execute`**.

Execution belongs to a separate actuator operating under the exact bounded permit.

```text
Gateway != actuator
admissible != executed
tool availability != authority
```

The binding therefore requires `gateway_operation = null` for the execute mapping.

## 4. Observe binding

Gateway `observe` may supply observation-adapter evidence to lifecycle `observe`.

It does not create Core post-action receipts. Frontier roles remain asymmetric:

```text
ActionReceipt frontier = predecessor / ActionPermit frontier
OutcomeReceipt frontier = observed successor frontier
SuccessorStateReceipt frontier = observed successor frontier
```

Gateway observation cannot claim that the Gateway performed the action or that the observed outcome proves causality, truth, legality, or liability.

## 5. Close boundary

Lifecycle `close` has no implicit Gateway operation.

Closure is a neutral exhaustion of the bounded scope after the one-shot permit is consumed and the successor state is observed.

```text
close != future authorization
closure != authority expansion
completed lifecycle != reusable permit
```

## Cross-protocol identity constraints

The binding keeps these values stable across both profiles:

- subject;
- exact predecessor frontier;
- target binding hash;
- Core ActionPermit;
- approval scope;
- ActionReceipt predecessor frontier;
- observed successor frontier.

Substitution of a resource, operation, frontier, permit, approval scope, or post-action frontier must fail closed.

## Non-effects

A conforming binding does not:

- make the Gateway an actuator;
- let the Gateway create a Core `ActionPermit`;
- let the Gateway create Core post-action receipts;
- let the Gateway close a lifecycle with future authority;
- prove causality;
- certify truth;
- establish liability.

## Conformance

`validate-binding.js` validates the positive fixture and rejects negative mutations including:

1. `authorize` introduced into the prepare mapping;
2. read-only preparation arming an action;
3. non-admissible Gateway decision used as lifecycle admission;
4. Gateway-created ActionPermit;
5. Core/lifecycle permit mismatch;
6. target-binding substitution;
7. Gateway operation mapped to execute;
8. Gateway used as actuator;
9. ActionReceipt moved to successor frontier;
10. OutcomeReceipt moved to predecessor frontier;
11. SuccessorStateReceipt moved to predecessor frontier;
12. Gateway observation claiming execution;
13. Gateway observation claiming causality;
14. Gateway operation used for lifecycle close;
15. closure granting future or generalized authority;
16. global claim that the Gateway is an actuator;
17. content-hash mismatch.

CI is read-only and never invokes an actuator.
