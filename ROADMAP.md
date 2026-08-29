# UU-AAP Ecosystem Roadmap

**Status:** reusable-runtime/tooling convergence after first bounded CI migration proof  
**Current evidence baseline:** `cdab3d75c3fdc21ec3dc61000b7dc732d3ee11ae` (Execution Evidence Parity v0.1, PR #640)  
**Current reusable-tooling increment:** Issue #641 / PR #642  
**Stable semantic substrate:** [`protocols/core/v0.1/`](protocols/core/v0.1/)  
**Component metadata:** [`tooling/component-manifest/v0.1/`](tooling/component-manifest/v0.1/)  
**Dependency/impact:** [`tooling/dependency-impact/v0.1/`](tooling/dependency-impact/v0.1/)  
**Command-set parity:** [`tooling/conformance-parity/v0.1/`](tooling/conformance-parity/v0.1/)  
**Generated execution:** [`tooling/generated-conformance-runner/v0.1/`](tooling/generated-conformance-runner/v0.1/)  
**Execution-evidence parity:** [`tooling/execution-evidence-parity/v0.1/`](tooling/execution-evidence-parity/v0.1/)  
**Current bounded migration gate:** [`tooling/bounded-ci-migration/v0.1/`](tooling/bounded-ci-migration/v0.1/)

The repository has crossed the point where the main architectural bottleneck is adding semantic protocol layers. The seven-primitive semantic Core remains stable while repeated implementation patterns are being extracted into reusable, independently testable engineering substrate.

## 1. Strategic objective

Preserve the existing semantic boundaries while replacing duplicated engineering mechanisms with explicit reusable tooling supported by differential evidence.

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
  -> Graph-vs-Manual Conformance Parity
  -> Generated Conformance Runner
  -> Execution Evidence Parity
  -> Bounded CI Migration Gate
  -> Receipt Runtime SDK
  -> Implementation Substitution Assessment
```

The tooling plane may describe, validate, compare and orchestrate existing components. It must not silently become a new semantic Core, authority plane or product runtime.

## 2. Governing invariants

```text
Core != Product
Product Success != Stable-Core Requirement
Reusable Tooling != Stable-Core Primitive
Component Manifest != Release Registry
Dependency Edge != Authority Transfer
Declared Interface != Compatibility Proof
Conformance Evidence != Authority
Parity Discovery != Command Execution
Parity Success != Permission To Narrow CI
Execution Plan != Authority
Command Success != Semantic Truth
Execution Evidence Parity != Compatibility Proof
Execution Evidence Parity != Substitutability
Execution Evidence Parity != CI Migration Authorization
One Migrated Block != Global CI Migration
Migration Admission != Runtime Authority
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed
Transport != Authority
IAL Expression != Execution Admission
Human Approval != ActionPermit
Observation != Causality Proof
Stored Receipt != Truth
```

No reusable extraction may reinterpret historical receipts, rewrite historical evidence or strengthen an existing component's authority/effect semantics.

## 3. Implemented foundation

### 3.1 Semantic substrate

Retained as separate responsibilities:

- **UU-AAP Core v0.1** — seven typed primitives from State/Evidence through Successor State;
- **Stack Evolution / Compatibility v0.1** — explicit successor manifests and compatibility receipts;
- **Protocol Registry v0.1** — exact immutable protocol release resolution;
- **Capability Negotiation v0.1** — declared-capability comparison;
- **Capability Attestation v0.1** — reproducible conformance evidence for exact implementations;
- **Interface Registry v0.1** — machine-readable reusable interface/dependency index;
- **IAL v0.1** — E0–E3 responsibility boundary and explicit handoff;
- **FCL v0.1** — observable liveness, terminal closure and successor continuation;
- bounded execution lifecycle and observation/successor integration profiles.

### 3.2 Productized shared infrastructure

Implemented reusable infrastructure includes:

- IAL Compact Envelope / CLI;
- provider-neutral AI Transport Reference CLI/SDK;
- KONTUR family readiness read-only interoperability projection;
- cross-product local interoperability through shared IAL + transport infrastructure.

### 3.3 Independent product/application evidence

Independent bounded lines include:

- Маркетолог Пессимиста local stress-test / real-review intake;
- FREESHIELD local protective assessment;
- Честный найм local comparison with explicit FREESHIELD binding;
- KONTUR consolidated measurable demo;
- MarketCloser application chain through observation, bounded analysis, human disposition, response approval, copy/export and publication observation.

Products remain consumers/evidence sources. Product-specific semantics must not become reverse dependencies of Core or generic tooling.

## 4. Reusable Runtime & Tooling Convergence

### T1 — Component Manifest v0.1 — COMPLETED (#631/#632)

Purpose: describe an existing component through a read-only engineering metadata surface.

Manifest binds:

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

Initial independent consumers were `UU-AAP-Core` and `AI-Transport-Reference`; later parity work expanded manifests only where evidence required them.

```text
Component Manifest != Release Registry
Manifest Validation != Conformance Attestation
Manifest Presence != Runtime Activation
```

### T2 — Dependency / Impact Graph v0.1 — COMPLETED (#633/#634)

Purpose: derive read-only engineering dependency and impact information from Component Manifests.

Edge vocabulary:

```text
RUNTIME_IMPORT
SCHEMA
EVIDENCE
CONFORMANCE
TRANSPORT
OPTIONAL_ADAPTER
TEST_ONLY
```

Implemented questions include:

```text
reverse-deps(component)
transitive-dependents(component)
affected-components(changed-paths)
affected-conformance(changed-paths)
why-dependent(A, B)
cycles()
```

The first acceptance graph reconstructed:

```text
IAL-Compact -> AI-Transport-Reference
UU-AAP-Core -> AI-Gateway -> AI-Transport-Reference
```

Required unresolved dependencies and cycles fail closed. Graph reachability does not imply authority, responsibility, compatibility or substitutability.

### T3a — Graph-vs-Manual Conformance Parity v0.1 — COMPLETED (#635/#636)

Historical proof target:

```text
.github/workflows/marketcloser-publication-observation-v0.1-validation.yml
historical blob: b8306d2accf12c0ac4d1324b5992fd4f6ae7ee72
```

The frozen predecessor blocks contained exactly 27 commands. Component Manifest + Dependency Graph reproduced that set exactly:

```text
manual predecessor commands = 27
graph-derived commands       = 27
missing_from_graph            = []
extra_in_graph                = []
commands_executed             = false
```

The baseline is bound to the exact historical workflow blob before graph comparison.

```text
Manual Workflow != Universal Dependency Truth
Equal Command Sets != Compatibility Proof
Parity Success != Permission To Narrow CI
```

### T3b — Generated Conformance Runner v0.1 — COMPLETED (#637/#638)

Purpose: execute only a parity-proven predecessor plan through a constrained reusable boundary.

Properties:

- `node | python | python3` executable allowlist;
- argument arrays with `shell=false`;
- exact component/frontier/workflow binding;
- deterministic dependency-first ordering;
- stop-on-first-failure;
- bounded child environment without common credential-bearing variables;
- stdout/stderr digests and byte counts instead of raw output in receipts;
- repository content snapshot before/after execution;
- explicit execution plan and execution receipt.

First proof:

```text
14 predecessor components
27 planned
27 attempted
27 succeeded
0 failed
repository_changed_after_run = false
```

```text
Generated Runner != Product Runtime
Runner Success != CI Migration Decision
Conformance Execution != External Effect Authorization
```

### T3c — Historical vs Generated Execution Evidence Parity v0.1 — COMPLETED (#639/#640)

Purpose: test whether changing only execution order changes per-command process/output evidence.

Compared the same 27 commands in:

```text
HISTORICAL_MANUAL_ORDER
GENERATED_DEPENDENCY_FIRST_ORDER
```

Evidence compared by command identity:

```text
exit_code
signal
success
error_code
stdout_sha256
stdout_bytes
stderr_sha256
stderr_bytes
```

Merged evidence:

```text
historical attempted/succeeded = 27 / 27
generated attempted/succeeded  = 27 / 27
status_difference_count         = 0
output_difference_count         = 0
classification                  = EXACT_EXECUTION_EVIDENCE_PARITY
repository changed after runs   = false
```

This is evidence for the exact bound frontier only.

```text
Output Digest Equality != Semantic Truth
Order Insensitivity Here != Universal Order Independence
Execution Parity != Compatibility Proof
Execution Parity != Substitutability
Execution Parity != CI Migration Authorization
```

### T3d — Bounded CI Migration Gate v0.1 — CURRENT (#641 / PR #642)

Purpose: convert exact T3a–T3c evidence into one narrowly scoped CI deduplication without turning successful parity into blanket migration authority.

The first migration changes only:

```text
Re-run Marketer Pessimist predecessors
```

inside MarketCloser Publication Observation CI.

Historical slice:

```text
Marketer-Pessimist-Product-Contract       1 command
Marketer-Pessimist-Local-MVP              2 commands
Marketer-Pessimist-Real-Review-Intake     2 commands
                                         ----------
                                         5 commands
```

The remaining 22 MarketCloser predecessor commands stay unchanged.

Frozen rollback evidence:

```text
pre-migration frontier:
cdab3d75c3fdc21ec3dc61000b7dc732d3ee11ae

historical workflow blob:
b8306d2accf12c0ac4d1324b5992fd4f6ae7ee72

pinned historical 27-command parent-plan digest:
sha256:a643108a09da50da90912de327bdef273afe380840ad22502b9fb3c6424ec3bb
```

T3d first reconstructs and validates the entire frozen 27-command plan, then selects the exact three-component/five-command slice. A five-command subset cannot become independently authoritative merely by matching command strings.

First migration evidence on PR #642:

```text
parent plan commands         = 27
migrated slice commands      = 5
historical baseline range    = 23..27
rollback execution           = 5 / 5 success
generated slice execution    = 5 / 5 success
status differences           = 0
output differences           = 0
migration classification     = MIGRATION_ADMISSIBLE
live migrated slice          = MIGRATED_SLICE_SUCCESS
repository mutation          = false
workflow triggers changed    = false
non-target workflow steps    = unchanged
```

The live production workflow now calls the bounded generated slice for those five predecessor commands. Historical T3a/T3b/T3c workflows materialize the frozen pre-migration workflow from Git history, preserving their original evidence semantics after the live migration.

```text
One Migrated Block != Global CI Migration
Exact T3c Evidence != Automatic Migration Right
Migration Admission != Runtime Authority
Migration Admission != Compatibility Proof
Migration Admission != Substitutability
Rollback Evidence Must Remain Addressable
Trigger Preservation != Conformance Equivalence
```

Exit condition for T3d:

- pinned parent-plan digest passes fail-closed validation;
- migration assessment remains `MIGRATION_ADMISSIBLE`;
- live MarketCloser generated slice remains 5/5 success;
- frozen T3a/T3b/T3c evidence remains reproducible;
- all non-target MarketCloser predecessor blocks remain unchanged;
- no other workflow block is migrated in the same increment.

### T4 — Receipt Runtime SDK v0.1 — NEXT

Extract repeated receipt-engineering operations only after at least two independent existing components prove byte-identical behavior through the shared runtime.

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
- import safety is preserved;
- no runtime activation/external effect is introduced;
- component-local implementation remains a rollback path during the candidate phase.

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

Assessment should distinguish wire/schema, semantic, conformance, dependency, effect-ceiling, authority/responsibility, frontier/freshness and consumer-specific operational compatibility.

```text
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed
```

## 5. Secondary reusable candidates

These remain extraction candidates above Core until repeated independent evidence justifies them.

### Human Decision Gate

Potential artifacts:

```text
HumanDecisionRequest
HumanDecisionReceipt
```

with bounded states such as `APPROVE | REJECT | DEFER | REQUEST_CHANGES | ABSTAIN`.

```text
Human Approval != Authority
Human Approval != ActionPermit
Human Approval != Execution
```

### Observation / Provenance Profile

Candidate common envelope across Core outcome observation, KONTUR external observation, deployment observation, publication observation and future world-state sensors:

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

Candidate content-addressed append-only storage/retrieval:

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

The store carries no truth or authority semantics by itself.

### Bounded Interaction Lifecycle

A reusable FSM/profile may be justified if independent products continue to repeat candidate → review → effect-candidate → observation → closure structures. It remains above Core unless separate promotion evidence proves otherwise.

## 6. Parallel product/pilot policy

- Keep at most **one major reusable-tooling line** and **one bounded product/application evidence line** active simultaneously.
- New product semantics do not enter Core merely to simplify tooling.
- Shared abstractions require at least two independent existing consumers before extraction.
- Tooling changes that modify component outputs require differential evidence.
- Product pilots may reveal shared abstractions; they may not declare those abstractions Core-required.
- MarketCloser remains an application consumer of Marketer Pessimist and reusable infrastructure.
- KONTUR remains an independent evidence line and must not become a reverse dependency of generic tooling.

## 7. CI and dependency-cost objective

Historical pattern:

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
  command-set parity
  constrained conformance orchestration
  execution-evidence parity
  bounded migration evidence
  receipt utilities
```

The objective is lower duplicate engineering, not weaker validation.

```text
CI Cost Reduction != Validation Weakening
Generated Dependency Set != Inferred Safety
Parity Success != Validation Removal
Execution Evidence Parity != Automatic Migration
One Successful Migration != Bulk Migration Authorization
```

## 8. Compatibility and migration policy

- Core v0.1 remains the historical semantic compatibility surface.
- Existing component canonicalization rules are never silently normalized.
- Existing receipts are never rewritten in place.
- Cross-version protocol consumption continues through Evolution/Compatibility receipts.
- Component substitution requires a consumer-specific assessment.
- Historical command-set parity is orchestration evidence, not migration permission.
- Generated execution success is execution evidence, not authority.
- Exact execution-evidence parity makes bounded migration review possible; it does not authorize unrelated migrations.
- Every migrated block retains explicit historical rollback evidence.
- Historical workflow evolution must preserve addressability of old evidence rather than pretending old CI never existed.
- Deprecation remains append-only with preserved historical meaning.

## 9. Near-term merge sequence

1. **Completed:** Component Manifest v0.1 (#631/#632).
2. **Completed:** Dependency / Impact Graph v0.1 (#633/#634).
3. **Completed:** Graph-vs-Manual Conformance Parity v0.1 (#635/#636).
4. **Completed:** Generated Conformance Runner v0.1 (#637/#638).
5. **Completed:** Historical-vs-Generated Execution Evidence Parity v0.1 (#639/#640).
6. **Current:** Bounded CI Migration Gate v0.1 for one five-command Marketer Pessimist predecessor block (#641 / PR #642).
7. **Next:** Receipt Runtime SDK v0.1 with at least two byte-identical differential consumers.
8. Implementation Substitution Assessment v0.1.
9. Expand manifests only when required by concrete proofs; do not mass-migrate repository metadata.
10. Evaluate Human Decision Gate and Observation/Provenance extraction from independent real consumers.
11. Add generic provenance-store candidate only after common storage/replay requirements are demonstrated.
12. Re-evaluate ecosystem release-candidate readiness after reusable receipt runtime and bounded substitution evidence exist.

Each item remains a separate review/merge gate. No item automatically authorizes its successor.

## 10. Release-candidate criteria

An ecosystem release candidate should require both vertical evidence and horizontal reuse evidence.

### Vertical evidence

At least three independent lines, including:

- KONTUR;
- Маркетолог Пессимиста / MarketCloser application evidence kept semantically distinct;
- Честный найм or an independently exercised FREESHIELD line.

### Horizontal evidence

At minimum:

- reusable Component Manifests across independent layers;
- machine-derived dependency/impact graph;
- exact graph-vs-manual conformance parity;
- generated dependency-first conformance execution;
- explicit execution-evidence classification;
- at least one bounded CI migration with preserved rollback evidence;
- provider-neutral transport interoperability;
- explicit version/migration policy;
- at least one non-trivial implementation-substitution assessment;
- security, privacy, accessibility and contestability review;
- Russian and English navigation.

A release candidate is not automatically a release, standard, certification, legal registration, universal interoperability proof or authority grant.

## 11. Current architectural direction

Optimize for:

```text
fewer duplicated mechanisms
+ explicit interfaces
+ stronger dependency evidence
+ reusable conformance
+ observable execution evidence
+ bounded reversible migration
+ replaceable implementations
+ preserved semantic boundaries
```

rather than:

```text
more universal semantic layers
+ product-specific reverse dependencies
+ larger manually maintained CI chains
+ implicit migration from one successful experiment
```

The next proof of architectural universality is not another abstract primitive. It is evidence that independent components can share receipt-runtime mechanics while preserving their historical identity rules, and that implementation substitution is claimed only when consumer-specific evidence supports it.
