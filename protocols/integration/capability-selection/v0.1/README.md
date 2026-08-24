# UU-AAP Capability Discovery / Selection Profile v0.1

**Status:** experimental reusable selection profile  
**Issue:** #355  
**Execution Capability Descriptor:** `protocols/integration/execution-capability-descriptor/v0.1`  
**Bounded Execution Lifecycle:** `protocols/integration/execution-lifecycle/v0.1`  
**Stable Core:** `protocols/core/v0.1`

## Purpose

This profile lets an agent or orchestrator compare multiple `ExecutionCapabilityDescriptor` candidates before authorization.

The selector produces either one deterministic eligible candidate or `no_match`.

```text
discover descriptors
  -> normalize operation projections
  -> apply hard constraints
  -> rank eligible candidates
  -> select | no_match
```

The pipeline ends before authorization.

## Canonical boundaries

```text
candidate discovered != candidate available
candidate eligible != candidate authorized
candidate ranked first != user intent
candidate selected != action-specific approval
candidate selected != ActionPermit
selection result != actuator invocation
descriptor preference != authority transfer
no eligible candidate != permission to relax constraints
```

A selected external-effect capability still requires:

1. fresh availability evidence;
2. exact-target preparation;
3. Intent / Authority / Coordination evidence;
4. Core `ActionPermit`;
5. bounded execution;
6. post-action observation;
7. closure.

## Hard constraints before preferences

Hard constraints are mandatory. Preferences may only order candidates that satisfy every hard constraint.

For the external-effect fixture, hard constraints cover:

- requested operation and effect class;
- exact authority scope;
- lifecycle profile, version and mode;
- action-specific approval;
- scope-bound approval;
- fresh availability probe before authorization;
- exact-target binding;
- predecessor freshness;
- fail-closed target guard;
- one-shot support;
- expiry;
- separate observer;
- required lifecycle phases;
- required pre-action Core receipts;
- required post-action Core receipts.

If none match, the correct output is `no_match`.

The selector MUST NOT silently:

- broaden authority scope;
- weaken approval mode;
- omit lifecycle phases;
- remove freshness or fail-closed guards;
- substitute required receipts;
- convert `no_match` into a lower-assurance candidate.

## Preference policy

v0.1 keeps preferences deliberately narrow and static:

- `prefer_reversible`;
- `prefer_compensation`.

Eligible candidates are compared lexicographically using the ordered preference vector. Remaining ties use:

```text
stable_capability_id_asc
```

This provides deterministic behavior without claiming that a preferred capability is currently available, cheaper, faster, safer in every context, or authorized.

Dynamic availability, latency, price, quota, service health, or operational readiness are not inferred from the descriptor in v0.1.

## Descriptor-bound projection

Each candidate contains:

- a descriptor reference bound by content hash;
- a normalized operation projection;
- a `projection_hash`;
- a machine-checkable eligibility assessment;
- a preference vector and eligible rank.

The projection is a selection view, not a new capability grant.

```text
projection != descriptor authority
projection hash != current availability proof
descriptor reference != invocation permission
```

## Selection result

A `selected` result MUST point to deterministic eligible rank 1.

A `no_match` result MUST contain no selected capability or descriptor reference.

In both cases the result explicitly preserves:

- `fresh_availability_still_required = true`;
- `authorization_still_required = true`;
- `no_constraints_relaxed = true`.

## Non-effects

A conforming selection record does not itself:

- establish intent;
- assert current availability;
- grant or expand authority;
- create approval;
- create an `ActionPermit`;
- authorize or perform an action;
- prove causality;
- certify truth;
- establish liability;
- create future action permission.

## Conformance

`validate-capability-selection.js` validates the positive multi-candidate fixture and rejects negative mutations including:

- selection granting authority or creating intent/approval/permit;
- selection treating a candidate as currently available;
- hard-constraint relaxation;
- authority-scope or operation substitution;
- approval downgrade;
- removal of availability/freshness/target/one-shot/expiry/observer safeguards;
- lifecycle phase omission;
- pre/post-action receipt substitution;
- incorrect eligibility;
- incorrect preference vectors/ranks;
- selecting a lower-ranked candidate;
- returning `no_match` while an eligible candidate exists;
- projection or record hash mismatch.

CI is read-only and never invokes an actuator.
