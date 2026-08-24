# UU-AAP Execution Capability Availability Binding v0.1

**Status:** experimental reusable availability profile  
**Issue:** #359  
**Capability Selection:** `protocols/integration/capability-selection/v0.1`  
**Execution Capability Descriptor:** `protocols/integration/execution-capability-descriptor/v0.1`  
**Stable Core:** `protocols/core/v0.1`

## Purpose

This profile bridges a selected execution capability to **fresh observed availability evidence** and the existing Core `AvailabilityClaim`.

It does not create a second availability primitive.

```text
descriptor discovery
  -> capability selection
  -> fresh availability probe
  -> bounded availability observation
  -> Core AvailabilityClaim
  -> later Intent / Authority / Coordination / ActionPermit
```

The profile ends before authorization.

## Canonical boundaries

```text
descriptor advertised != capability currently available
selected capability != capability currently available
probe attempted != capability available
availability observed != future availability guaranteed
availability observed != user intent
availability observed != authority
availability observed != action-specific approval
AvailabilityClaim != ActionPermit
availability != execution
endpoint reachable != requested operation admissible
capacity observed != successful outcome guaranteed
```

A stale, substituted, incomplete or ambiguous availability observation fails closed for positive-claim composition.

## Why this binds to Core

UU-AAP Core v0.1 already defines `AvailabilityClaim`.

Core requires a positive claim to:

- depend on a `StateReceipt`;
- preserve the same frontier revision;
- assert `availability_qualified = true`;
- explicitly preserve non-effects for intent, action, liability and truth.

Core `CoordinationReceipt` in turn requires an `AvailabilityClaim` predecessor alongside Intent and Authority/Responsibility evidence.

Therefore the integration layer records how availability was observed, while the canonical availability primitive remains Core.

## Selection binding

When capability selection was used, the availability observation binds exactly to:

- the selection record ID and content hash;
- the selected capability ID;
- the selected descriptor ID and content hash;
- the selected operation.

The v0.1 conformance fixture binds to the positive Capability Selection fixture.

```text
selection hash != availability proof
selected descriptor ref != availability proof
fresh probe evidence -> availability observation
positive fresh observation -> Core AvailabilityClaim
```

## Availability states

v0.1 has three deterministic states:

- `available`
- `unavailable`
- `unknown`

A positive Core `AvailabilityClaim` may be materialized only for `available` when every required probe check passes and the claim is issued inside the bounded freshness window.

For `unavailable` or `unknown`, the observation remains evidence but `core_availability_claim` must be `null`.

No negative or uncertain observation may be silently upgraded.

## Freshness

The observation records:

- probe start and completion;
- exact observed frontier;
- `valid_until`;
- required check IDs;
- typed per-check result and evidence reference.

Freshness is bounded:

```text
observed available at T != guaranteed available after valid_until
```

A later authorization path must reject stale availability rather than infer persistence.

## Exact binding

The positive Core `AvailabilityClaim` is bound to:

- the exact Core `StateReceipt`;
- the exact predecessor frontier;
- the exact selected capability and operation;
- the descriptor content hash;
- the selection record content hash;
- the availability observation content hash;
- the observation freshness boundary.

Substitution of any of these bindings fails closed.

## Non-effects

Neither the observation nor the binding record:

- establishes user intent;
- grants or expands authority;
- creates approval;
- creates an `ActionPermit`;
- authorizes or performs an action;
- guarantees future availability;
- guarantees successful outcome;
- proves causality;
- certifies truth;
- establishes liability;
- creates future action permission.

## Historical boundary

This profile is prospective.

Historical AI Gateway acceptance evidence is immutable. If an older pre-action bundle did not contain a standalone Core-valid `AvailabilityClaim`, this profile does not retroactively manufacture one or rewrite any historical hash.

Future full-Core-composable pre-action bundles should materialize an availability layer equivalent to this profile.

## Conformance

`validate-execution-capability-availability.js` validates:

- exact Capability Selection binding;
- observation and record hashes;
- Core StateReceipt and AvailabilityClaim hashes;
- State -> Availability predecessor/frontier semantics;
- probe completeness and deterministic status;
- positive-claim freshness;
- exact capability/descriptor/operation binding;
- non-effects and no authority escalation.

Negative mutations cover stale evidence, unavailable/unknown upgrade, missing/failed checks, selection/descriptor/operation substitution, Core predecessor/frontier substitution, hash substitution, and authority/action/future-guarantee escalation.

CI is read-only and never invokes an actuator.
