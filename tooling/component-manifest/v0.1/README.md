# UU-AAP Component Manifest v0.1

**Status:** experimental reusable-tooling metadata profile  
**Issue:** #631  
**Scope:** read-only component discovery and dependency metadata

## Purpose

`Component Manifest v0.1` describes an already-existing UU-AAP component through one provider-neutral, machine-readable engineering surface. It does not replace the protocol registry, interface registry, Product Contract, Core receipt chain, release metadata or implementation-specific documentation.

The goal is to make repeated runtime/tooling work discoverable before later slices build a transitive Impact Graph, generated conformance runner, shared receipt runtime and implementation-substitution assessment.

```text
Component Manifest != Release Registry
Component Manifest != Interface Compatibility Proof
Dependency Edge != Authority Transfer
Declared Export != Runtime Activation
Manifest Validation != Conformance Attestation
Reusable Tooling != Stable-Core Promotion
```

## Manifest boundary

A manifest binds:

- exact component identity, version, kind and maturity;
- repository path and exact source frontier;
- declared exports: interfaces, receipt types, schemas and runtime entrypoints;
- typed dependencies;
- conformance commands already owned by the component;
- external-effect and authority ceilings;
- canonicalization profile reference or an explicit `component_local` declaration;
- optional evolution/migration reference;
- explicit non-effects.

The first slice intentionally describes components without changing those components.

## Dependency edge kinds

v0.1 accepts a finite engineering vocabulary:

```text
RUNTIME_IMPORT
SCHEMA
EVIDENCE
CONFORMANCE
TRANSPORT
OPTIONAL_ADAPTER
TEST_ONLY
```

The list is deliberately narrower than every possible semantic relation in UU-AAP. A later dependency-graph successor may add new edge kinds only with explicit semantics and migration handling.

An edge records dependency direction only. It does not create authority, responsibility, execution admission, state sharing or product membership.

## Effect and authority ceilings

Every manifest declares:

```text
external_effect_emission
runtime_activation
execution_admission
creates_authority
accepts_responsibility
```

These are ceilings for what the described reusable surface claims to do. Setting them to `false` does not prove that arbitrary code outside the described paths has no effect. Setting any of them to `true` would still not establish that a particular action is authorized.

The two first conformance examples are intentionally read-only/no-effect components.

## Source frontier

A manifest binds one exact repository revision. The validator checks syntax and local repository path existence; it does not refresh the frontier or infer continued validity.

```text
Manifest Frontier != Current Frontier
Metadata Update != Re-observation
```

## Canonicalization

Existing UU-AAP components do not all claim one universal canonical JSON algorithm. The manifest therefore carries a canonicalization declaration rather than silently imposing one.

A component may declare:

- a named profile reference; or
- `component_local`, meaning identity semantics remain owned by the described component.

```text
Shared Manifest != Shared Canonicalization Semantics
```

## Conformance commands

`conformance.commands` lists existing deterministic test/validation entrypoints as metadata for a future generated runner. Component Manifest v0.1 does not execute them automatically during manifest validation.

The validator rejects shell-composed commands. Each command is represented as an executable plus an argument array so a later runner can enforce a constrained execution policy.

## First consumers

The committed examples describe two already-existing independent reusable components without modifying them:

1. `UU-AAP-Core` v0.1;
2. `AI-Transport-Reference` v0.1.

They prove only that the metadata model can describe both a semantic substrate and a higher integration/tooling component while preserving dependency direction.

## Files

- `component-manifest.schema.json` — structural contract;
- `validate-component-manifest.js` — deterministic read-only semantic validator;
- `component-manifest.template.json` — neutral starter template;
- `examples/uu-aap-core.component.json` — Core metadata example;
- `examples/ai-transport-reference.component.json` — transport metadata example.

## Validation

```bash
node tooling/component-manifest/v0.1/validate-component-manifest.js \
  tooling/component-manifest/v0.1/examples/uu-aap-core.component.json

node tooling/component-manifest/v0.1/validate-component-manifest.js \
  tooling/component-manifest/v0.1/examples/ai-transport-reference.component.json
```

The validator:

- requires exact manifest version `0.1`;
- rejects unknown dependency edge kinds;
- rejects duplicate dependencies and duplicate exported identifiers;
- rejects repository paths that do not exist;
- requires explicit non-effects;
- rejects effect/authority overclaims in this first no-effect tooling profile;
- rejects shell-composed conformance commands;
- checks deterministic manifest content hash.

It performs no network access, writes no files, invokes no component runtime and executes no conformance command.

## Successor tooling path

The intended successor sequence is:

```text
Component Manifest
  -> Dependency / Impact Graph
  -> Generated Conformance Runner
  -> Receipt Runtime SDK
  -> Implementation Substitution Assessment
```

No edge above is automatic and no successor is required to change Core semantics.

## Non-effects

Component Manifest v0.1 does not:

- publish or release a component;
- prove protocol/version compatibility;
- prove implementation substitutability;
- attest runtime behavior;
- select an implementation;
- create authority or accept responsibility;
- create an ActionPermit;
- admit or perform execution;
- refresh stale evidence;
- activate KONTUR or any product;
- mutate any described component;
- establish universal canonicality.
