# KONTUR Family Readiness Interoperability v0.1

**Status:** experimental read-only product-family interoperability profile  
**Issue:** #589  
**Origin frontier:** `52e09bb8731d2228f90a0f94648c7cd18db52995`  
**Origin tree:** `c718cc59613500c48df6a813ba07d1b97ba4310e`

## Purpose

Expose the already-implemented KONTUR Readiness Aggregator through the KONTUR Product Family as a deterministic **read-only inspection boundary**.

The profile does not add a second readiness primitive and does not enter the activation path.

```text
KONTUR Product Family Manifest
+ KONTURReadinessAggregationReceipt
+ KONTURReadinessSignal
+ KONTURReadinessAcceptanceReceipt
+ KONTURResponsibilityPolicy
-> family/readiness binding validation
-> KONTURFamilyReadinessInteropReceipt
-> read-only family inspection
-> STOP
```

No `KONTURActivationFrontierReceipt`, activation intent, activation preflight, executor call or Responsibility Kernel transition is created or consumed.

## Why this layer exists

The family manifest already records the Readiness Aggregator as one distinct family member and the edge:

```text
readiness-aggregator -> activation-boundary
```

as an `established_evidence_dependency` with:

```text
authority_transfer = false
responsibility_transfer = false
shared_data_access = false
activation_authorized = false
```

The server readiness layer already proves its own separate boundary:

```text
subsystem evidence
!= global readiness
!= readiness acceptance
!= kernel activation
!= execution authority
```

This interoperability profile binds those two existing contracts without changing either one.

## Input

`KONTURFamilyReadinessInteropInput` contains:

- exact evaluation repository frontier;
- canonical KONTUR Product Family manifest;
- existing `KONTURReadinessAggregationReceipt`;
- existing `KONTURReadinessSignal`;
- existing `KONTURResponsibilityPolicy`;
- existing `KONTURReadinessAcceptanceReceipt`;
- closed read-only controls.

The historical frontier embedded in the family manifest is preserved. It is not rewritten to the later evaluation frontier.

```text
Historical Manifest Frontier != Current Evaluation Frontier
Current Evaluation Frontier != Manifest Rewrite
```

## Canonical readiness reuse

The implementation imports the existing:

```text
server/kontur/v0.1/readiness-aggregator.js
```

and invokes its public readiness acceptance validation API.

It then re-runs the canonical dry-run acceptance at the exact recorded acceptance time and requires the reproduced receipt to equal the supplied predecessor receipt.

This proves that the interoperability layer did not reinterpret the dry-run readiness boundary.

The dedicated CI additionally runs the complete existing Readiness Aggregator harness first. That harness recreates the six readiness axes from the actual source validators and writes the positive readiness artifacts to a temporary directory. The interoperability conformance test consumes those generated artifacts rather than replacing them with six hand-written booleans.

## Source readiness versus interoperability authority

A positive source may contain:

```text
readiness_signal.ready = true
acceptance.decision = accepted_for_activation_precondition
acceptance.claims.human_activation_step_still_required = true
```

The interoperability receipt may preserve those source facts, but it cannot upgrade them into activation authority.

```text
Readiness Acceptance != Activation Authority
Readiness Boundary Permission != Activation Execution
```

The only positive interoperability status is:

```text
READINESS_EVIDENCE_AVAILABLE_FOR_FAMILY_INSPECTION
```

and the only successor named by this profile is:

```text
READ_ONLY_FAMILY_READINESS_INSPECTION_ONLY
```

## Family binding

A positive receipt requires exactly one family member:

```text
id = readiness-aggregator
evidence_status = implemented_experimental
runtime_activation_state = not_activated
core_member = false
authority_source = false
responsibility_holder = false
shared_data_access = false
external_effect_authorized = false
```

Its canonical path set must remain exactly the path set already published by the family manifest.

The readiness-to-activation edge must remain an evidence dependency with every transfer/authorization field false.

The family consolidation policy must continue to forbid automatic:

- activation;
- host designation;
- ledger mutation;
- runtime start;
- external effect;
- Stable-Core promotion.

Cross-member data access remains denied by default.

## Receipt

`KONTURFamilyReadinessInteropReceipt` binds:

- exact evaluation frontier;
- historical family-manifest frontier;
- content digest of the family manifest;
- aggregation receipt;
- readiness signal;
- dry-run acceptance receipt;
- responsibility policy;
- readiness epoch;
- readiness member and edge status.

The receipt is deterministic and content-addressed.

Its positive assertions are limited to evidence/binding facts:

```text
exact_evaluation_frontier_bound
historical_family_manifest_frontier_preserved
readiness_member_bound
readiness_acceptance_reproduced
family_edge_non_transfer_preserved
cross_member_data_access_default_denied
read_only_family_inspection_available
```

## Mandatory false claims

Every positive receipt fixes all of these to false:

```text
activation_frontier_created
activation_authorized
activation_started
activation_intent_created
preflight_run
kernel_activated
responsibility_state_created
responsibility_accepted
host_designated
ledger_mutated
runtime_started
cross_member_data_access_admitted
authority_created
action_permit_created
execution_admitted
external_effect_performed
successor_authority_created
```

## Invariants

```text
Family Readiness Interop != Activation Frontier
Readiness Aggregation != Kernel Activation
Ready Signal != ActionPermit
Readiness Acceptance != Activation Authority
Readiness Boundary Permission != Activation Execution
Family Membership != Shared Data Access
Family Interoperability != Responsibility Transfer
Family Inspection != Host Designation
Family Inspection != Ledger Mutation
Family Inspection != Runtime Start
Family Inspection != Successor Authority
```

## CLI / SDK

CLI commands:

```text
validate
inspect
help
```

Examples:

```bash
node products/kontur/v0.1/readiness-interop/readiness-family-interop.js validate input.json
node products/kontur/v0.1/readiness-interop/readiness-family-interop.js inspect input.json
```

The CLI intentionally has no command equivalent to:

```text
activate
execute
start
designate
write-ledger
send
```

The SDK is import-safe: importing it performs no JSON data read, subprocess invocation, network access or filesystem write.

## Conformance

The dedicated workflow performs, in order:

1. unchanged KONTUR Product Family contract validation;
2. unchanged complete KONTUR Readiness Aggregator harness;
3. interoperability positive and fail-closed vectors;
4. schema/runtime parity;
5. import safety;
6. CLI command-boundary checks.

The negative suite rejects family/member/edge/policy drift, malformed evaluation frontier, non-ready source evidence, acceptance binding substitution, activation/responsibility overclaims, every interoperability false-claim escalation, and actuating CLI command names.

## Non-effects

This profile does not:

- create an activation frontier;
- create or consume Formal HAR;
- create activation intent;
- run activation preflight;
- call Activation Executor;
- transition Responsibility Kernel;
- write Responsibility Ledger;
- designate a live host;
- start a runtime;
- enable Game Companion action;
- share data across family members;
- create authority or ActionPermit;
- admit execution;
- invoke a provider or network transport;
- perform an external effect;
- create successor authority;
- release, tag or merge repository state.
