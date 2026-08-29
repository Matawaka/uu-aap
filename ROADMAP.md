# UU-AAP Ecosystem Roadmap

**Status:** reusable-runtime/tooling convergence after byte-stable receipt-runtime extraction and first consumer-specific substitution proof  
**Current evidence baseline:** `5d9d9e0faf35230ede54e8f49c71e049311b7e4a` (Receipt Runtime SDK v0.1, PR #644)  
**Current reusable-tooling increment:** Issue #645 / PR #646  
**Stable semantic substrate:** [`protocols/core/v0.1/`](protocols/core/v0.1/)  
**Component metadata:** [`tooling/component-manifest/v0.1/`](tooling/component-manifest/v0.1/)  
**Dependency/impact:** [`tooling/dependency-impact/v0.1/`](tooling/dependency-impact/v0.1/)  
**Command-set parity:** [`tooling/conformance-parity/v0.1/`](tooling/conformance-parity/v0.1/)  
**Generated execution:** [`tooling/generated-conformance-runner/v0.1/`](tooling/generated-conformance-runner/v0.1/)  
**Execution-evidence parity:** [`tooling/execution-evidence-parity/v0.1/`](tooling/execution-evidence-parity/v0.1/)  
**Bounded migration gate:** [`tooling/bounded-ci-migration/v0.1/`](tooling/bounded-ci-migration/v0.1/)  
**Receipt runtime:** [`tooling/receipt-runtime/v0.1/`](tooling/receipt-runtime/v0.1/)  
**Current substitution assessment:** [`tooling/implementation-substitution/v0.1/`](tooling/implementation-substitution/v0.1/)

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
Shared Runtime != Universal Canonicalization Algorithm
Same SHA-256 Primitive != Same Identity Projection
Profile Selection != Semantic Compatibility
Hash Equality != Receipt Truth
Hash Equality != Authority
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed
Narrow Scope Substitutable != Whole Component Substitutable
Consumer A Substitutable != Consumer B Substitutable
Historical Parity != Future Compatibility
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

### T3d — Bounded CI Migration Gate v0.1 — COMPLETED (#641/#642)

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

Merged migration evidence:

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

Historical T3a/T3b/T3c workflows materialize the frozen pre-migration workflow from Git history, preserving their original evidence semantics after the live migration.

```text
One Migrated Block != Global CI Migration
Exact T3c Evidence != Automatic Migration Right
Migration Admission != Runtime Authority
Migration Admission != Compatibility Proof
Migration Admission != Substitutability
Rollback Evidence Must Remain Addressable
Trigger Preservation != Conformance Equivalence
```

### T4 — Receipt Runtime SDK v0.1 — COMPLETED (#643/#644)

Purpose: extract repeated deterministic receipt/content identity operations only where independent consumers demonstrate byte-identical historical behavior.

The first extraction used two components from different architectural lines:

```text
AI-Transport-Reference
MarketCloser-Copy-Export-Receipt
```

Their historical algorithms share recursive key sorting and SHA-256, but **do not share the same identity projection**:

```text
AI Transport:
content-hash-zero-field-v0.1
  -> retain content_hash
  -> set it to ""
  -> canonicalize
  -> SHA-256

MarketCloser Copy/Export:
content-hash-omit-field-v0.1
  -> remove content_hash
  -> canonicalize
  -> SHA-256
```

The shared runtime therefore exposes explicit profile-dispatched operations:

```text
canonicalize(value)
project(profile, value)
canonicalJson(profile, value)
computeContentHash(profile, value)
verifyContentHash(profile, value)
rehash(profile, value)
deepEqualCanonical(left, right)
```

T4a used a two-stage differential proof: first alongside unchanged local implementations, then after real consumer delegation. Both consumers retained byte-stable historical identity and native conformance.

Merged T4 frontier:

```text
5d9d9e0faf35230ede54e8f49c71e049311b7e4a
```

Component Manifest represents the real reuse explicitly:

```text
Receipt-Runtime                  kind=TOOLING
AI-Transport-Reference           --RUNTIME_IMPORT--> Receipt-Runtime
MarketCloser-Copy-Export-Receipt --RUNTIME_IMPORT--> Receipt-Runtime
```

Historical T3 evidence remains separately addressable through the frozen pre-T4 Copy/Export Component Manifest rather than being silently recomputed using the current T4 dependency graph.

```text
Shared Runtime != Universal Canonicalization Algorithm
Same SHA-256 Primitive != Same Identity Projection
Profile Selection != Semantic Compatibility
Hash Equality != Receipt Truth
Hash Equality != Authority
Runtime Reuse != Core Promotion
Refactor Success != Historical Receipt Rewrite
Current Dependency Graph != Historical Evidence Graph
```

T4 did **not** extract frontier, predecessor, non-effect, storage or schema semantics. Those helpers still require separate independent repetition evidence.

### T5 — Implementation Substitution Assessment v0.1 — CURRENT (#645 / PR #646)

Purpose: turn already-existing evidence into a bounded, consumer-specific replacement decision without confusing compatibility, selection or execution with substitution.

Existing evidence planes remain distinct:

```text
Protocol Registry      -> exact immutable protocol resolution
Capability Negotiation -> declared compatibility
Capability Attestation -> reproducible conformance evidence
Stack Evolution        -> cross-version translation compatibility
Interface Registry     -> interface discovery
Component Manifest     -> component/dependency/effect metadata
Dependency Impact      -> engineering reachability
Receipt Runtime        -> deterministic receipt identity mechanics
```

T5 reduces explicit evidence across eight dimensions:

```text
wire_schema
semantic
conformance
dependency_fit
effect_ceiling
authority_responsibility
frontier_freshness
consumer_operational
```

Decision vocabulary:

```text
SUBSTITUTABLE
ADAPTER_REQUIRED
NOT_SUBSTITUTABLE
INSUFFICIENT_EVIDENCE
```

Fail-closed precedence:

```text
UNSATISFIED
  -> NOT_SUBSTITUTABLE
else INSUFFICIENT_EVIDENCE
  -> INSUFFICIENT_EVIDENCE
else ADAPTER_REQUIRED
  -> ADAPTER_REQUIRED
else
  -> SUBSTITUTABLE
```

The first real evidence does not invent a new whole runtime. It assesses the two already completed T4 replacements at the exact merged T4 frontier.

```text
consumer: AI-Transport-Reference
scope: FUNCTION / receipt_identity_mechanics
incumbent: historical component-local zero-field identity
candidate: Receipt-Runtime/content-hash-zero-field-v0.1
result: SUBSTITUTABLE
```

and:

```text
consumer: MarketCloser-Copy-Export-Receipt
scope: FUNCTION / receipt_identity_mechanics
incumbent: historical component-local omit-field identity
candidate: Receipt-Runtime/content-hash-omit-field-v0.1
result: SUBSTITUTABLE
```

Before accepting either real assessment, dedicated CI re-runs the T4 differential baseline and both native consumer conformance suites, checks exact historical/current Git blobs, current named profiles, required `RUNTIME_IMPORT` edges and no-effect ceilings.

T5 v0.1 deliberately refuses a broader claim:

```text
scope_kind = FUNCTION | INTERFACE
whole_component_substitution = false
```

It also rejects any input requesting implementation selection, authorization, activation or execution.

Synthetic fail-closed vectors exercise every decision and precedence among simultaneous blockers.

```text
Protocol Resolution != Substitution
Declared Compatibility != Substitution
Conformance Attestation != Substitution
CompatibilityReceipt != SubstitutionAssessmentReceipt
Substitution Assessment != Capability Selection
Substitution Assessment != ActionPermit
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed
Narrow Scope Substitutable != Whole Component Substitutable
Consumer A Substitutable != Consumer B Substitutable
Historical Parity != Future Compatibility
```

Every `SubstitutionAssessmentReceipt` keeps selection, activation, authority creation/expansion, responsibility acceptance, ActionPermit creation, execution, external effects, universal compatibility/substitutability and historical evidence rewriting false.

Exit condition for T5 v0.1:

- all four decision classes are exercised fail-closed;
- both real T4 consumer-specific function assessments classify `SUBSTITUTABLE` only after exact evidence revalidation;
- whole-component assessment remains rejected;
- the assessment component is explicit in Component Manifest and Dependency Impact without allowing graph reachability to prove substitution;
- public CLI and import surface remain deterministic and read-only;
- no selection, authorization, activation or production runtime switch occurs.

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
  profile-dispatched receipt identity
  consumer-specific substitution assessment
```

The objective is lower duplicate engineering, not weaker validation.

```text
CI Cost Reduction != Validation Weakening
Generated Dependency Set != Inferred Safety
Parity Success != Validation Removal
Execution Evidence Parity != Automatic Migration
One Successful Migration != Bulk Migration Authorization
Receipt Runtime Reuse != Semantic Unification
Substitution Evidence != Selection Or Activation
```

## 8. Compatibility and migration policy

- Core v0.1 remains the historical semantic compatibility surface.
- Existing component canonicalization rules are never silently normalized.
- Existing receipts are never rewritten in place.
- Shared receipt-runtime behavior requires an explicit named profile whenever historical projections differ.
- Cross-version protocol consumption continues through Evolution/Compatibility receipts.
- Component substitution requires a consumer-specific assessment.
- A successful narrow-scope assessment does not imply whole-component substitutability or substitutability for another consumer.
- A substitution assessment never performs selection, authorization, activation or execution.
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
6. **Completed:** Bounded CI Migration Gate v0.1 for one five-command Marketer Pessimist predecessor block (#641/#642).
7. **Completed:** Receipt Runtime SDK v0.1 with two independent profile-dispatched differential consumers (#643/#644).
8. **Current:** Implementation Substitution Assessment v0.1 with two real narrow-scope T4 consumer assessments (#645 / PR #646).
9. Expand substitution beyond `FUNCTION | INTERFACE` only after separate whole-component evidence exists; do not infer it from T5 v0.1 success.
10. Expand receipt-runtime helpers only when two independent components prove the exact repeated operation; do not generalize from adjacent code alone.
11. Expand manifests only when required by concrete proofs; do not mass-migrate repository metadata.
12. Evaluate Human Decision Gate and Observation/Provenance extraction from independent real consumers.
13. Add generic provenance-store candidate only after common storage/replay requirements are demonstrated.
14. Re-evaluate ecosystem release-candidate readiness after T5 merge and explicit security/privacy/accessibility/contestability review.

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
- at least two independent consumers of a profile-dispatched receipt runtime with byte-stable historical identities;
- explicit version/migration policy;
- at least one non-trivial, consumer-specific implementation-substitution assessment;
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
+ profile-dispatched receipt identity
+ consumer-specific replaceability evidence
+ preserved semantic boundaries
```

rather than:

```text
more universal semantic layers
+ product-specific reverse dependencies
+ larger manually maintained CI chains
+ implicit migration from one successful experiment
+ one canonicalization algorithm forced across historical components
+ whole-component substitutability inferred from a narrow refactor
```

The next proof of architectural universality is not another abstract primitive. It is evidence that reusable mechanisms can be replaced or reused under explicit consumer-specific evidence without turning compatibility, parity or reachability into silent selection, authority or execution.
