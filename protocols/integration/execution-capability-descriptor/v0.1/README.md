# UU-AAP Execution Capability Descriptor v0.1

**Status:** experimental reusable discovery profile  
**Issue:** #353  
**Bounded Execution Lifecycle:** `protocols/integration/execution-lifecycle/v0.1`  
**Stable Core:** `protocols/core/v0.1`

## Purpose

This profile lets an agent or orchestrator discover the execution boundary of a concrete capability before asking for authorization or attempting an external effect.

It is descriptive, not authorizing:

```text
descriptor != authority
advertised capability != current availability
availability != ActionPermit
descriptor != user intent
descriptor != action-specific approval
supported operation != authorized operation
receipt capability advertised != receipt actually produced
```

The descriptor is intentionally provider-neutral. A concrete descriptor may identify an adapter, tool, API, local executor, MCP-like service, or other actuator, but the schema itself does not depend on any one provider.

## Discovery surface

For each operation, the descriptor exposes:

- effect class: `read_only` or `external_effect`;
- reversibility and compensation support;
- required authority scope;
- approval requirements and approval mode;
- current-availability semantics;
- required Bounded Execution Lifecycle mode/phases;
- exact-target, predecessor-freshness and fail-closed guard requirements;
- one-shot and expiry support;
- observer separation requirements;
- required pre-action Core receipts;
- receipts an actuator may emit as actuator evidence;
- required Core post-action receipts;
- expected effect categories and explicit non-effects.

## External-effect contract

An externally consequential operation MUST use:

```text
prepare -> authorize -> execute -> observe -> close
```

and MUST declare all of the following:

- action-specific approval;
- scope-bound approval;
- fresh availability check before authorization;
- exact target binding;
- predecessor freshness;
- fail-closed target guard;
- one-shot permit support;
- explicit expiry;
- a separate observation boundary.

The descriptor does not create any of these conditions. It only declares that the capability supports or requires them.

## Authority boundary

A capability descriptor MUST NOT grant authority to itself or to a caller.

For external effects:

- a Core `ActionPermit` must already be materialized before execution;
- advertised tool availability is not authority;
- availability evidence is not authority;
- protocol-mode consent is not action-specific approval;
- the actuator cannot advertise itself as the creator of Core `ActionPermit`;
- the actuator cannot advertise itself as the creator of Core `ActionReceipt`, `OutcomeReceipt`, or `SuccessorStateReceipt`.

```text
capability discovery -> evidence about what can be attempted
Core ActionPermit -> authority for one bounded action
actuator invocation -> execution
observation -> evidence about what happened
```

These are separate roles.

## Receipt contract

The positive external-effect profile requires pre-action Core evidence including:

- `StateReceipt`;
- `IntentReceipt`;
- `AuthorityReceipt` or `ResponsibilityReceipt`;
- `CoordinationReceipt`;
- `ActionPermit`.

A concrete actuator may emit actuator-specific evidence such as `ActuatorObservation`.

Core post-action evidence remains:

- `ActionReceipt`;
- `OutcomeReceipt`;
- `SuccessorStateReceipt`.

Advertising support for a receipt is not equivalent to materializing that receipt.

## Read-only operations

The schema also permits `read_only` operations.

Read-only operations use `read_only_lightweight` lifecycle mode and MUST NOT require the `execute` phase or action approval. This preserves the anti-overhead invariant:

```text
reasoning / read-only analysis -> lightweight
externally consequential action -> accountable action boundary
```

## Effect semantics

`expected_effect_categories` and `explicit_non_effects` must be disjoint.

An observed effect is not automatically causal proof:

```text
effect observed != causality proven
```

The descriptor also does not certify factual truth, legality, liability, current availability, or future permission.

## Relationship to other profiles

### AI Gateway Capability Manifest

The AI Gateway manifest describes Gateway operations (`inspect`, `qualify`, `authorize`, `observe`).

This descriptor answers a different question: what execution lifecycle and evidence obligations belong to the concrete capability that may eventually perform an effect.

### Bounded Execution Lifecycle

The lifecycle defines the action phases and receipt boundaries.

The descriptor advertises which lifecycle obligations a capability supports or requires; it does not execute the lifecycle by itself.

### AI Gateway ↔ Lifecycle binding

The binding explains how Gateway evidence maps into lifecycle phases.

The descriptor can be consumed by that Gateway or by another client without changing authority semantics.

## Conformance

`validate-execution-capability-descriptor.js` validates the positive fixture and rejects negative mutations including:

1. descriptor authority expansion;
2. descriptor asserting current availability;
3. external effect without action-specific approval;
4. protocol-mode consent treated as sufficient;
5. advertised capability treated as current availability;
6. availability treated as authority;
7. missing fresh availability probe;
8. incomplete external-effect lifecycle;
9. missing exact-target binding;
10. missing predecessor freshness;
11. missing fail-closed target guard;
12. missing one-shot semantics;
13. missing expiry;
14. missing observer separation;
15. missing `ActionPermit`;
16. actuator claiming it may emit `ActionPermit`;
17. actuator claiming it creates Core authorization;
18. actuator claiming it creates Core post-action receipts;
19. advertised receipt support treated as an actual receipt;
20. substituted Core post-action receipt contract;
21. overlapping expected effects / explicit non-effects;
22. observation treated as causal proof;
23. content-hash mismatch.

CI is read-only and never invokes an actuator.

## Non-effects

A conforming descriptor does not itself:

- establish intent;
- grant or expand authority;
- create an `ActionPermit`;
- authorize or perform an action;
- establish current availability;
- prove causality;
- certify truth;
- establish liability;
- create future action permission.
