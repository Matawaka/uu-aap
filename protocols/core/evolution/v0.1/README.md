# UU-AAP Stack Evolution / Compatibility v0.1

**Status:** experimental normative successor-policy profile  
**Stable predecessor:** `protocols/core/v0.1`  
**Canonical predecessor commit:** `36efd19e443d63a26668c1d48d9acd551d95df6e`  
**Issue:** #324

## Purpose

This profile defines how the UU-AAP reusable protocol stack may evolve after completion of the Minimal Stable Core v0.1 without silently mutating historical semantics.

The governing invariant is:

```text
Core evolution = explicit successor + preserved provenance + explicit compatibility decision
Core evolution != silent mutation
```

The profile is deliberately located outside `protocols/core/v0.1`. The frozen Core remains the compatibility surface; this directory governs successor proposals, adapters and migrations around it.

## Default evolution path

```text
new requirement
  -> extension/profile/adapter
  -> conformance evidence
  -> compatibility analysis
  -> successor version only if Core change is justified
```

`useful != core-required`  
`widely used != core-required`  
`important policy != core primitive`

## Compatibility classes

Every successor MUST declare exactly one class:

- `fully_compatible`
- `adapter_compatible`
- `semantically_compatible_syntax_breaking`
- `breaking`
- `historical_only`

The class is a semantic claim, not a convenience label. Validators and adapters must fail closed when the declared class does not match the migration mode or change scope.

## `SuccessorManifest`

A successor manifest binds:

- predecessor protocol/version/canonical commit and compatibility surface;
- target successor protocol/version;
- compatibility class;
- explicit change scope;
- preserved invariants;
- migration mode;
- deprecations;
- major-version decision;
- rationale and deterministic content hash.

A manifest MUST preserve historical receipt meaning. A migration MUST NOT reinterpret old receipts in place.

The conformance fixture uses `0.2-conformance-fixture` with `synthetic = true`. This is not a release or proposal to create Core v0.2; it exists only to exercise the compatibility rules.

## `CompatibilityReceipt`

Cross-version consumption is explicit. A target-version primitive MUST NOT silently consume a predecessor receipt.

An explicit compatibility receipt binds:

- exact successor manifest hash;
- source protocol/version/type/content hash/frontier;
- target protocol/version/type;
- compatibility class;
- translation mode;
- source/effective frontier and re-observation state;
- semantic-preservation assertions;
- explicit non-effects;
- issuer/time/content hash.

For `adapter_compatible` migration:

```text
source receipt -> CompatibilityReceipt -> target consumer
```

The adapter receipt is evidence of translation semantics only. It is not a Core receipt and does not create a target receipt by itself.

## Freshness invariant

```text
translation != re-observation
schema upgrade != frontier refresh
version compatibility != continued validity
```

A translation-only adapter MUST preserve the effective frontier exactly. A new frontier requires an independently evidenced re-observation/re-binding path.

## Monotonic boundary safety

Successors MUST preserve or strengthen these distinctions:

```text
observation != availability
availability != intent
intent != authority
intent != action
coordination != authority
readiness != permission
review != execution
extension evidence != Core receipt
action permit != performed action
observed outcome != causality
provenance support != truth
truth/evidence != liability
```

Versioning cannot be used as semantic laundering.

## CompatibilityReceipt non-effects

A translation receipt MUST keep false at least:

- `intent_created`
- `intent_inferred`
- `authority_created`
- `authority_expanded`
- `responsibility_accepted`
- `coordination_completed`
- `action_permit_created`
- `action_performed`
- `frontier_refreshed`
- `causality_proven`
- `truth_certified`
- `liability_established`
- `universal_canonicality_established`

## Extension -> Core promotion gate

A capability may be considered for promotion into Core only when all are demonstrated:

1. broad architectural necessity rather than one runtime's convenience;
2. stable semantics across independent use cases;
3. minimal typed interface;
4. no hidden vendor/runtime/external-contour dependency;
5. safe composition with all seven Core primitives;
6. no implicit authority/responsibility expansion;
7. deterministic or explicitly bounded receipt semantics;
8. positive and negative conformance tests;
9. migration path for existing conforming implementations;
10. explicit reason why remaining an extension is insufficient.

Promotion requires a separate architectural decision artifact. Extension popularity alone is insufficient.

## Major-version threshold

A major version is required when any of the following occurs:

- normative meaning of a Core primitive changes;
- a required semantic layer is added, removed or merged;
- a historical valid receipt could acquire a stronger interpretation;
- Action Gate failure semantics materially change;
- authority/responsibility semantics change;
- historical receipts become invalid for reasons other than freshness/frontier mismatch;
- compatibility cannot be safely expressed through an explicit adapter/profile.

The validator rejects a manifest that marks these change scopes while also claiming `major_version_required = false`.

## Deprecation

Deprecation is append-only. Every deprecated identifier must preserve its historical meaning and state a successor or retirement reason.

```text
deprecated != erased
deprecated != redefined
```

## Fail-closed conformance vectors

`validate-evolution.js` rejects at least:

1. unknown compatibility class;
2. adapter-compatible successor without explicit adapter migration;
3. direct compatibility receipt under an adapter-only manifest;
4. translation that refreshes a frontier without re-observation;
5. translation that creates intent;
6. translation that creates authority;
7. translation that creates an `ActionPermit`;
8. translation that strengthens target semantics;
9. translation that rewrites historical meaning;
10. removal of the Action Gate requirement;
11. breaking change without major-version classification;
12. unsafe deprecation that does not preserve historical meaning;
13. compatibility receipt bound to a different manifest;
14. target version mismatch.

## Conformance regression

The workflow re-runs:

```text
Core v0.1
-> Extension Composition v0.1
-> Extension Composition Receipt v0.1
-> Stack Evolution / Compatibility v0.1
```

This makes successor-policy changes prove that the stable Core and extension firewalls remain intact.

## Non-effects

This profile does not create a new Core version, activate KONTUR or another runtime, grant authority, accept responsibility, create intent, create an ActionPermit, perform an action, refresh stale evidence, establish causality/truth/liability, or establish universal canonicality.
