# UU-AAP Ecosystem Roadmap

**Status:** reusable-runtime/tooling convergence after multi-product infrastructure proof  
**Current evidence baseline:** `04d811a391bf133e5ffe91931b1fd2d52656ec19` (Component Manifest v0.1, PR #632)  
**Current reusable-tooling increment:** Issue #633  
**Stable semantic substrate:** [`protocols/core/v0.1/`](protocols/core/v0.1/)  
**Component/tooling first slice:** [`tooling/component-manifest/v0.1/`](tooling/component-manifest/v0.1/)  
**Current dependency/impact slice:** [`tooling/dependency-impact/v0.1/`](tooling/dependency-impact/v0.1/)

This roadmap reflects the implemented repository after the Phase C/D productization and interoperability work. The project is no longer primarily blocked on adding semantic protocol layers. The current bottleneck is repeated engineering work around component metadata, dependency traversal, conformance orchestration, receipt utilities and implementation substitution evidence.

## 1. Strategic objective

Preserve the seven-primitive Core and the already-separated protocol/product semantics while turning repeated implementation patterns into reusable, independently testable engineering substrate.

```text
Stable semantic Core
        ↓
Registry / Negotiation / Attestation / Evolution
        ↓
IAL / FCL / bounded integration profiles
        ↓
AI Gateway / Transport / adapters
        ↓
independent products and applications

        + cross-cutting reusable tooling

Component Manifest
  -> Dependency / Impact Graph
  -> Generated Conformance Runner
  -> Receipt Runtime SDK
  -> Implementation Substitution Assessment
```

The tooling plane describes, validates and composes existing components. It must not silently become a new authority plane or a hidden replacement for Core semantics.

## 2. Governing invariants

```text
Core != Product
Product Success != Stable-Core Requirement
Reusable Tooling != Stable-Core Primitive
Component Manifest != Release Registry
Dependency Edge != Authority Transfer
Declared Interface != Compatibility Proof
Conformance Evidence != Authority
Substitutable != Selected
Substitutable != Authorized
Transport != Authority
IAL Expression != Execution Admission
Human Approval != ActionPermit
Observation != Causality Proof
Stored Receipt != Truth
```

No reusable extraction may reinterpret historical receipts or strengthen an existing component's authority/effect semantics.

## 3. Evidence that justifies the tooling shift

The repository now contains independent repetitions of the same engineering structures across Core, IAL, FCL, execution lifecycle, product pilots and MarketCloser:

- exact source/frontier binding;
- schema + runtime parity checks;
- deterministic receipt/content identities;
- predecessor/source binding tests;
- explicit assertions and non-effects;
- import-safety checks;
- human disposition/approval boundaries;
- post-effect observation boundaries;
- dedicated CI that re-runs predecessor chains.

The repetition is now broad enough to extract reusable tooling from demonstrated common behavior rather than inventing a generic abstraction in advance.

## 4. Implemented foundation

### 4.1 Semantic substrate

Implemented and retained as separate responsibilities:

- **UU-AAP Core v0.1** — seven typed primitives from State/Evidence through Successor State;
- **Stack Evolution / Compatibility v0.1** — explicit successor manifests and compatibility receipts;
- **Protocol Registry v0.1** — exact immutable protocol release resolution;
- **Capability Negotiation v0.1** — exact declared-capability comparison;
- **Capability Attestation v0.1** — reproducible conformance evidence for exact implementations;
- **Interface Registry v0.1** — machine-readable reusable interface/dependency index;
- **IAL v0.1** — E0–E3 responsibility boundary and explicit handoff;
- **FCL v0.1** — observable liveness, terminal closure and successor continuation;
- bounded execution lifecycle and observation/successor integration profiles.

### 4.2 Productized shared infrastructure

Completed after the earlier roadmap snapshot:

- IAL Compact Envelope / CLI;
- provider-neutral AI Transport Reference CLI/SDK;
- KONTUR family readiness read-only interoperability projection;
- two-product local interoperability scenario using the same IAL + transport infrastructure.

This proves bounded reuse of shared infrastructure without merging product identity, state, evidence, authority or responsibility.

### 4.3 Independent local product evidence

Completed local no-effect/measurable lines include:

- Маркетолог Пессимиста local stress-test MVP;
- FREESHIELD local protective assessment MVP;
- Честный найм local comparison MVP with exact FREESHIELD binding;
- KONTUR consolidated measurable demo.

These provide the independent consumers required to evaluate which abstractions are genuinely reusable.

### 4.4 Bounded pilot/application progression

Phase-E style work has progressed through reusable pilot admission/human-disposition surfaces and into a richer MarketCloser application chain. MarketCloser intentionally remains distinct from the reusable Marketer Pessimist analytical core.

The application line now exercises repeated boundaries for:

```text
observation
-> privacy/minimization
-> bounded analysis
-> human disposition
-> response candidate
-> human approval
-> copy/export
-> publication observation
-> successor evidence
```

This line remains a consumer/evidence source. Product/application-specific semantics must not become reverse dependencies of reusable Core or tooling.

## 5. Current phase — Reusable Runtime & Tooling Convergence

### T1 — Component Manifest v0.1 — COMPLETED (#631/#632)

Purpose: describe an existing component through one read-only engineering metadata surface without modifying the component.

Required fields include:

- component identity/version/kind/status;
- repository path and exact source frontier;
- exported interfaces, receipts, schemas and runtime entrypoints;
- typed dependency edges;
- conformance commands;
- effect/authority ceiling;
- canonicalization declaration;
- evolution reference;
- explicit non-effects;
- deterministic manifest identity.

Initial consumers:

```text
UU-AAP-Core
AI-Transport-Reference
```

Completion evidence:

- schema + validator + examples + CI merged in #632;
- two independent existing components represented without semantic changes;
- validation is read-only and import-safe;
- manifest presence creates no compatibility/publication/activation claim.

### T2 — Dependency / Impact Graph v0.1 — CURRENT (#633)

Build a read-only graph from Component Manifests and existing interface metadata.

Minimum edge vocabulary:

```text
RUNTIME_IMPORT
SCHEMA
EVIDENCE
CONFORMANCE
TRANSPORT
OPTIONAL_ADAPTER
TEST_ONLY
```

Minimum CLI/API questions:

```text
reverse-deps(component)
transitive-dependents(component)
affected-components(changed-paths)
affected-conformance(changed-paths)
why-dependent(A, B)
cycles()
```

First acceptance graph expands Component Manifest coverage with `IAL-Compact` and `AI-Gateway` and reconstructs:

```text
IAL-Compact -> AI-Transport-Reference
UU-AAP-Core -> AI-Gateway -> AI-Transport-Reference
```

while preserving the direct optional Core-evidence carriage edge declared by AI Transport.

Exit condition:

- one current manually understood predecessor chain can be reproduced from graph evidence;
- path and component impact deterministically derive affected component/conformance sets;
- required unresolved dependencies and cycles fail closed;
- no CI trigger is narrowed merely because no direct import was observed;
- graph reachability does not imply authority, responsibility, compatibility or substitutability.

### T3 — Generated Conformance Runner v0.1

Use manifest/impact evidence to generate or execute the same deterministic conformance chain that is currently hand-maintained in large workflows.

First proof target: choose one long existing successor workflow such as the MarketCloser publication-observation line and demonstrate:

```text
manual predecessor test set
==
graph-derived predecessor test set
```

before changing any production CI trigger.

Requirements:

- constrained executable/args representation;
- no arbitrary shell expansion;
- exact component/frontier binding;
- stable ordering;
- fail closed on unresolved mandatory dependency;
- differential proof against the predecessor workflow.

### T4 — Receipt Runtime SDK v0.1

Extract repeated receipt engineering operations only after two independent components prove byte-identical behavior through the shared runtime.

Candidate APIs:

```text
validateEnvelope()
canonicalize(profile, value)
identityProjection(profile, receipt)
computeHash(profile, receipt)
verifyHash()
verifyFrontier()
verifyPredecessors()
verifyNonEffects()
buildReceipt()
rehashReceipt()
```

Critical rule:

```text
Shared Runtime != Universal Canonicalization Algorithm
```

Existing component-local identity rules remain historical truth. Shared runtime dispatches through explicit canonicalization profiles rather than rewriting old receipts.

Migration exit condition:

- at least two independent components produce byte-identical historical outputs before/after refactor;
- import safety preserved;
- no runtime activation/external effect introduced;
- rollback to component-local implementation remains possible during the candidate phase.

### T5 — Implementation Substitution Assessment v0.1

Compose already-existing evidence planes:

```text
Registry
+ Negotiation
+ Attestation
+ Evolution Compatibility
+ Interface / Component metadata
        ↓
consumer-specific SubstitutionAssessmentReceipt
```

Required decisions:

```text
SUBSTITUTABLE
ADAPTER_REQUIRED
NOT_SUBSTITUTABLE
INSUFFICIENT_EVIDENCE
```

Assessment ladder should distinguish:

1. wire/schema compatibility;
2. semantic compatibility;
3. conformance compatibility;
4. dependency compatibility;
5. effect-ceiling compatibility;
6. authority/responsibility compatibility;
7. frontier/freshness compatibility;
8. consumer-specific operational substitutability.

Mandatory boundary:

```text
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed
```

This phase is the point at which UU-AAP can begin to make evidence-backed implementation-interchangeability claims rather than only protocol/interface compatibility claims.

## 6. Secondary reusable candidates — extraction only after T1–T3 evidence

These are not immediate Core additions. They are candidate profiles/runtime services derived from repetition already visible in independent products.

### Human Decision Gate

Candidate common artifacts:

```text
HumanDecisionRequest
HumanDecisionReceipt
```

with bounded states such as `APPROVE | REJECT | DEFER | REQUEST_CHANGES | ABSTAIN`.

It must preserve:

```text
Human Approval != Authority
Human Approval != ActionPermit
Human Approval != Execution
```

### Observation / Provenance Profile

Candidate common envelope for Core outcome observation, KONTUR external observation, deployment observation, publication observation and future physical/world-state sensors.

```text
what
source
observed_at
method
digest
independence class
frontier
```

Observation remains distinct from execution and causal proof.

### Generic Provenance Store

Content-addressed append-only storage/retrieval for receipts and lineage:

```text
put
get
predecessors
successors
lineage
heads
by-frontier
verify-graph
```

The store must carry no truth/authority semantics by itself.

### Bounded Interaction Lifecycle

A reusable FSM/profile may be justified if MarketCloser, Honest Hiring, KONTUR and future products continue to repeat a common candidate → review → effect-candidate → observation → closure structure.

It remains above Core unless separate promotion evidence proves otherwise.

## 7. Parallel product/pilot policy during tooling extraction

Tooling convergence must not freeze useful bounded product evidence, but it changes WIP priorities.

- Keep at most **one major reusable-tooling line** and **one bounded product/application evidence line** active at the same time.
- New product semantics do not enter Core merely to simplify tooling.
- Every new shared abstraction must have at least two independent existing consumers before extraction.
- A tooling change that modifies component output requires differential compatibility evidence.
- A product pilot may reveal a missing shared abstraction; it may not itself declare that abstraction Core-required.
- MarketCloser remains an application consumer of Marketer Pessimist and other reusable infrastructure, not a replacement for those layers.
- KONTUR remains a major independent evidence line and must not become a reverse dependency of generic tooling.

## 8. CI and dependency-cost objective

The immediate engineering acceleration target is to replace repeated manual predecessor orchestration with evidence-driven reuse while preserving fail-closed behavior.

Current pattern:

```text
new boundary
+ schema
+ runtime
+ hash/source binding
+ parity test
+ import-safety test
+ negative tests
+ dedicated workflow
+ manually duplicated predecessor reruns
```

Target pattern:

```text
new domain semantics
+ Component Manifest
+ domain-specific conformance

shared:
  dependency resolution
  impact analysis
  constrained conformance orchestration
  receipt utilities
```

The objective is reduced duplicate engineering, not fewer safety checks.

```text
CI Cost Reduction != Validation Weakening
Generated Dependency Set != Inferred Safety
```

## 9. Compatibility and migration policy

- Core v0.1 remains the historical semantic compatibility surface.
- Existing protocol/component canonicalization rules are not silently normalized.
- Existing receipts are never rewritten in place.
- Cross-version protocol consumption continues through Evolution/Compatibility receipts.
- Component substitution requires its own consumer-specific assessment.
- Schema/catalog cleanup may add logical resolution before any physical file relocation.
- Deprecation remains append-only with preserved historical meaning.

## 10. Near-term merge sequence

1. **Completed:** Component Manifest v0.1 — schema, read-only validator, initial component examples and dedicated CI (#631/#632).
2. **Current:** Dependency / Impact Graph v0.1 over Component Manifest + existing interface evidence (#633).
3. Graph-vs-manual dependency parity case using one long current CI predecessor chain.
4. Generated Conformance Runner v0.1 with constrained commands and deterministic ordering.
5. Receipt Runtime SDK v0.1 first extraction with two byte-identical differential consumers.
6. Implementation Substitution Assessment v0.1.
7. Expand manifests only to components needed by those proofs; do not mass-migrate the repository prematurely.
8. Evaluate Human Decision Gate and Observation/Provenance extraction from at least two independent real consumers.
9. Add generic provenance-store candidate only after storage/replay requirements are common across multiple products.
10. Re-evaluate ecosystem release-candidate readiness after reusable tooling and bounded substitution evidence exist.

Each item remains a separate review/merge gate. No item automatically authorizes its successor.

## 11. Release-candidate criteria

An ecosystem release candidate should now require both vertical evidence and horizontal reuse evidence.

### Vertical evidence

At least three independent lines, including:

- KONTUR;
- Маркетолог Пессимиста / MarketCloser application evidence kept semantically distinct;
- Честный найм or an independently exercised FREESHIELD line.

### Horizontal evidence

At minimum:

- reusable Component Manifests for multiple independent layers;
- machine-derived dependency/impact graph;
- generated conformance parity with at least one historical manual workflow;
- provider-neutral transport interoperability;
- explicit version/migration policy;
- at least one implementation-substitution assessment with a non-trivial result;
- security, privacy, accessibility and contestability review;
- Russian and English navigation.

A release candidate is not automatically a release, standard, certification, legal registration, universal interoperability proof or authority grant.

## 12. Current architectural direction

The project should optimize for:

```text
fewer duplicated mechanisms
+ more explicit interfaces
+ stronger dependency evidence
+ reusable conformance
+ replaceable implementations
+ preserved semantic boundaries
```

rather than:

```text
more universal semantic layers
+ more product-specific reverse dependencies
+ larger manually maintained CI chains
```

The next proof of architectural universality is therefore not another abstract primitive. It is evidence that independent implementations and products can reuse the same tooling, be impact-analyzed mechanically, preserve historical receipt identity and be substituted only when consumer-specific evidence says that substitution is safe.
