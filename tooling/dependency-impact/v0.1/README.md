# UU-AAP Dependency / Impact Graph v0.1

**Status:** experimental reusable-tooling slice  
**Issue:** #633  
**Origin frontier:** `04d811a391bf133e5ffe91931b1fd2d52656ec19`  
**Predecessor:** Component Manifest v0.1 (#631/#632)

## Purpose

Compute engineering dependency reachability and affected conformance surfaces from validated Component Manifests without turning dependency metadata into authority, compatibility, execution, or substitution semantics.

```text
Component Manifest
  -> typed dependency edges
  -> deterministic graph
  -> reverse/transitive reachability
  -> affected component set
  -> declared conformance command set
  -> STOP
```

The graph never executes the commands it discovers.

## First acceptance graph

The first complete graph contains four existing components:

```text
UU-AAP-Core
    ↑ EVIDENCE(required)
AI-Gateway
    ↑ RUNTIME_IMPORT(required)
AI-Transport-Reference
    ↑ RUNTIME_IMPORT(required)
IAL-Compact
```

`AI-Transport-Reference` also has a direct optional `EVIDENCE` edge to `UU-AAP-Core` for bounded Core-receipt carriage.

This is engineering dependency evidence only. It does not say that any component is authorized, compatible, substitutable, active, published, or safe for a particular external effect.

## Commands

```text
graph
reverse-deps <component>
transitive-dependents <component>
impact-component <component>
impact-path <repository-path>
why-dependent <source> <target>
cycles
```

Every command consumes explicit Component Manifest paths. There is no repository scan, network lookup, automatic dependency inference, command execution, file write, or runtime activation.

Example:

```bash
node tooling/dependency-impact/v0.1/dependency-impact.js impact-path \
  protocols/ial/v0.1/compact/ial-compact.js \
  tooling/component-manifest/v0.1/examples/uu-aap-core.component.json \
  tooling/component-manifest/v0.1/examples/ial-compact.component.json \
  tooling/component-manifest/v0.1/examples/ai-gateway.component.json \
  tooling/component-manifest/v0.1/examples/ai-transport-reference.component.json
```

## Fail-closed boundaries

Impact analysis fails when:

- a component ID is duplicated;
- a required dependency is unresolved;
- a dependency cycle is present;
- the requested component is unknown;
- a changed path is not owned by any supplied component manifest.

Optional unresolved dependencies remain visible graph evidence but do not create a guessed target.

## Determinism

Input manifest ordering must not change graph or impact output. Components, edges, affected components, cycles and conformance commands are deterministically sorted.

## Non-effects

```text
Dependency Graph != Authority Graph
Impact != Required Merge
Affected != Incompatible
Conformance Command Discovery != Command Execution
Dependency Presence != Compatibility Proof
Dependency Presence != Substitutability
Reachability != Responsibility Transfer
```

## Successor

Generated Conformance Runner v0.1 should consume the deterministic impact result from this slice and execute only the constrained command set after a separate review/merge increment. It must not independently rediscover or broaden dependencies.
