# UU-AAP Pre-Action Bundle ↔ Lifecycle Authorize Admission v0.1

**Status:** experimental reusable authorize-admission profile  
**Issue:** #363  
**Pre-Action Evidence Bundle:** `protocols/integration/pre-action-evidence-bundle/v0.1`  
**Bounded Execution Lifecycle:** `protocols/integration/execution-lifecycle/v0.1`  
**Stable Core:** `protocols/core/v0.1`

## Purpose

This profile re-checks an already-materialized `PreActionEvidenceBundle` at the moment it is handed to the `authorize` phase of the Bounded Execution Lifecycle.

It produces bounded **admission evidence**, not a new permission primitive.

```text
PreActionEvidenceBundle
  -> re-check at authorization decision time
  -> AuthorizeAdmissionAssessment(admissible | denied)
  -> optional admission_assessment_ref
  -> lifecycle authorize
  != execute
```

## Why the re-check exists

The pre-action bundle proves that its evidence was internally consistent and fresh enough when it was assembled. Time continues after assembly.

```text
bundle fresh at assembly != fresh at authorize
admissible at T != admissible after expiry
```

The authorize boundary independently compares its decision time with availability `valid_until`, action-specific approval `valid_until`, Core `ActionPermit.expires_at`, and the bundle's `authorization_must_occur_by`. The horizon is never extended by this profile.

## Exact binding

An `admissible` assessment binds exactly the bundle ID/hash, subject, selected capability and operation, authority scope, target binding, predecessor frontier, availability binding, approval, pre-existing ActionPermit, one-shot/unconsumed state, and lifecycle phase `authorize`. Any substitution fails closed.

## Admission is not authorization creation

The lifecycle already defines adapter admission as optional evidence. This profile instantiates that provider-neutral role.

```text
authorize admission != Core ActionPermit
authorize admission != authority creation
authorize admission != approval creation
authorize admission != permit consumption
authorize admission != execute
```

The Core `ActionPermit` must pre-exist the admission assessment.

## Provider neutrality

`adapter_id` identifies the evaluator, but no provider is mandatory. `admission_assessment_role = optional_evidence` is normative: removing the adapter must not change where Core authority originates.

## Decision semantics

v0.1 supports `admissible` and `denied`. `denied` never permits weakening requirements, silent evidence refresh, target substitution, or entering `execute`.

## Non-effects

A conforming assessment does not create intent, authority, approval or ActionPermit; consume a permit; perform an action; enter execute; extend availability lifetime; create future/general authority; prove causality; certify truth; or establish liability.

## Conformance

`validate-authorize-admission.js` binds the positive fixture to the merged Pre-Action Evidence Bundle fixture and rejects stale decision time, horizon extension, bundle/target/frontier/permit/approval substitutions, one-shot or consumption changes, provider-role escalation, direct execute handoff, authority/action escalation, and content-hash mismatch.

CI is read-only and never invokes an actuator.
