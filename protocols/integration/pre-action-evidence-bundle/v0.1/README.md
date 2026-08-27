# UU-AAP Core-composable Pre-Action Evidence Bundle v0.1

**Status:** experimental reusable pre-action profile  
**Issue:** #361  
**Stable Core:** `protocols/core/v0.1`  
**Capability Selection:** `protocols/integration/capability-selection/v0.1`  
**Availability Binding:** `protocols/integration/execution-capability-availability/v0.1`  
**Bounded Execution Lifecycle:** `protocols/integration/execution-lifecycle/v0.1`

## Purpose

This profile assembles already-materialized pre-action evidence into one machine-checkable handoff for the `authorize` phase of the Bounded Execution Lifecycle.

The bundle is a manifest, not an issuer.

```text
StateReceipt
  -> AvailabilityClaim
StateReceipt
  -> IntentReceipt
IntentReceipt
  -> AuthorityReceipt | ResponsibilityReceipt
AvailabilityClaim + IntentReceipt + Authority/Responsibility
  -> CoordinationReceipt
StateReceipt + IntentReceipt + Authority/Responsibility + CoordinationReceipt
  -> ActionPermit
existing receipts + exact approval + exact target
  -> PreActionEvidenceBundle
  -> lifecycle authorize
```

## Canonical boundaries

```text
bundle assembly != receipt creation
bundle complete != action performed
AvailabilityClaim != intent
AvailabilityClaim != authority
availability fresh now != availability fresh forever
CoordinationReceipt != execution authority
approval evidence != AuthorityReceipt
ActionPermit != action performed
bundle contains ActionPermit != bundle created ActionPermit
authorize handoff != execute
pre-action completeness != generalized future authority
```

The bundle may prove only that the declared evidence set is internally consistent and fresh enough for a bounded authorization handoff at the recorded instant.

## Core composability

The positive fixture uses the actual Core dependency graph.

In particular, the `CoordinationReceipt` has exactly these prerequisite classes:

- `AvailabilityClaim`;
- `IntentReceipt`;
- `AuthorityReceipt` or `ResponsibilityReceipt`.

The `ActionPermit` then binds:

- `StateReceipt`;
- `IntentReceipt`;
- Authority/Responsibility;
- `CoordinationReceipt`.

This makes availability transitively mandatory at the Core action gate without changing Core semantics.

## Availability binding

The bundle binds the merged Execution Capability Availability profile by:

- availability binding ID and content hash;
- exact selected capability and operation;
- observation content hash;
- Core `AvailabilityClaim` hash;
- exact predecessor frontier;
- `valid_until`.

Availability must still be fresh at bundle assembly and at the later lifecycle authorization decision. A bundle cannot extend availability lifetime.

## Target and approval

The target is content-addressed from resource, operation, expected predecessor frontier and authority scope.

Action-specific approval is separate evidence. Its hash, operation, scope, target binding, one-shot flag and validity window must match exactly.

```text
approval evidence != authority
approval evidence != ActionPermit
```

## ActionPermit

The bundle may contain a Core `ActionPermit` only after that permit already exists. The positive fixture requires action-specific target binding, one-shot semantics, `consumed = false`, explicit expiry and the exact Core predecessor graph.

The bundle does not mint or refresh the permit.

## Authorization horizon

`authorization_must_occur_by` is the earliest of availability `valid_until`, approval `valid_until` and ActionPermit `expires_at`.

The bundle fails closed if assembled after that horizon. A later authorize decision must re-check that horizon; bundle creation does not freeze time.

## Lifecycle handoff

The only next phase named by this profile is `authorize`.

The handoff binds the exact frontier, target hash, permit hash and approval hash. It MUST NOT claim lifecycle execution, observation, outcome or closure.

## Historical boundary

This profile is prospective.

Historical AI Gateway live acceptance receipts and hashes remain immutable. An older bundle that omitted a standalone Core-valid `AvailabilityClaim` is not retroactively rewritten. Future fully Core-composable pre-action bundles should satisfy this profile or an equivalent stronger one.

## Parameterized programmatic interface

The validator now exposes a side-effect-free programmatic API:

```text
validateBundle(bundle, evidenceContext = buildDefaultFixtureEvidenceContext())
buildDefaultFixtureEvidenceContext()
validateEvidenceContext(evidenceContext)
```

The default evidence context is deterministically projected from the same Capability Selection and Execution Capability Availability conformance fixtures used by the historical v0.1 validator. Therefore omitting the context preserves the existing positive fixture and negative-mutation semantics.

The normalized context carries only the exact facts the bundle validator needs from those upstream profiles:

```text
selection:
  selection_id
  content_hash
  selected_capability_id
  descriptor_id
  descriptor_content_hash
  operation

availability:
  binding_id
  content_hash
  observation_content_hash
  core_state_receipt_hash
  core_availability_claim_hash
  status
  valid_until
  frontier
```

This interface extraction does **not** make an arbitrary context authoritative. A caller supplying a non-default context remains responsible for independently validating the source selection/availability artifacts under their own protocol profiles before constructing the normalized handoff.

```text
Parameterization != Semantic Relaxation
Evidence Context != Source Verification
Evidence Context != Authority
Evidence Context != ActionPermit
Evidence Context != Execution
```

The bundle validator still re-checks Core content hashes, predecessor graph, subject/frontier equality, target binding, approval binding, freshness horizon, one-shot permit state, lifecycle handoff and all explicit non-effects.

## Non-effects

A conforming bundle does not itself create intent, create or expand authority, create approval, create an ActionPermit, perform an action, observe an outcome, prove causality, certify truth, establish liability, or create generalized/future action authority.

## Conformance

`validate-pre-action-evidence-bundle.js` validates exact Capability Selection and Availability bindings, Core receipt identity hashes and predecessor graph, subject/frontier consistency, availability freshness, exact target and approval binding, one-shot unconsumed ActionPermit, expiry horizon, lifecycle authorize handoff and explicit non-effects.

Negative mutations cover missing AvailabilityClaim in Coordination, stale availability, expired approval/permit, selection/capability/operation/target/frontier substitution, receipt substitution, permit consumption, wrong lifecycle phase and authority/action/future-permission escalation.

`test-evidence-context.js` additionally proves deterministic default-context projection, explicit-vs-implicit default equivalence, fail-closed context substitutions, unavailable/malformed context rejection and side-effect-free module import.

CI is read-only and never invokes an actuator.
