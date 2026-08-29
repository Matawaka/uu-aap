# UU-AAP Ecosystem Roadmap

**Status:** post-T1–T5 engineering convergence; release-candidate governance evidence closure  
**Current evidence baseline:** `07009a16566fb839acd753215231c6a9c86a896d` — Implementation Substitution Assessment v0.1 merged via PR #646  
**Current increment:** P0 — Release Candidate Checkpoint v0.2, Issue #647  
**Stable semantic substrate:** [`protocols/core/v0.1/`](protocols/core/v0.1/)  
**Current checkpoint:** [`tooling/release-candidate-checkpoint/v0.2/`](tooling/release-candidate-checkpoint/v0.2/)

The seven-primitive semantic Core remains stable. The current bottleneck is no longer another universal semantic layer: it is converting completed reusable engineering evidence into an explicit release-candidate checkpoint and then closing only governance evidence gaps that the checkpoint actually exposes.

Detailed historical evidence remains authoritative in each stage's README, tests, schemas, frozen baselines and merge commits. This roadmap records sequencing and gates rather than duplicating those artifacts.

## 1. Strategic chain

```text
Stable semantic Core v0.1
  -> Component Manifest
  -> Dependency / Impact Graph
  -> Graph-vs-Manual Conformance Parity
  -> Generated Conformance Runner
  -> Execution Evidence Parity
  -> Bounded CI Migration Gate
  -> Receipt Runtime SDK
  -> Implementation Substitution Assessment
  -> Release Candidate Checkpoint v0.2
  -> evidence-driven governance closure
```

The reusable tooling plane may describe, validate, compare and orchestrate existing components. It must not silently become a new semantic Core, authority plane, release registry or product runtime.

## 2. Governing invariants

```text
Core != Product
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
One Migrated Block != Global CI Migration
Migration Admission != Runtime Authority
Shared Runtime != Universal Canonicalization Algorithm
Same SHA-256 Primitive != Same Identity Projection
Profile Selection != Semantic Compatibility
Hash Equality != Receipt Truth
Substitutable != Selected
Substitutable != Authorized
Substitutable != Activated
Substitutable != Executed
Narrow Scope Substitutable != Whole Component Substitutable
Historical Parity != Future Compatibility
File Exists != Review Passed
Historical Review != Current-Frontier Review
Technical PASS != Governance PASS
READY != Release
READY != Publication Authorization
READY != Certification
READY != Legal Status
READY != Authority
```

No successor may reinterpret historical receipts, rewrite historical evidence or strengthen an existing component's authority/effect semantics.

## 3. Stable semantic foundation

The minimum reusable semantic stack remains:

```text
State / Evidence Anchor
  -> Possibility / Availability
  -> Intent
  -> Authority / Responsibility
  -> Coordination / CCRP
  -> Action Gate
  -> Outcome / Provenance / Successor State
```

Existing supporting layers — Protocol Registry, Capability Negotiation, Capability Attestation, Stack Evolution / Compatibility, Interface Registry, IAL, FCL, AI Gateway / Transport and bounded lifecycle profiles — remain separate responsibilities.

**Core v0.2 remains intentionally blocked** until genuinely new semantic pressure cannot be expressed through the existing stable Core and explicit reusable tooling.

## 4. Reusable Runtime & Tooling Convergence

### T1 — Component Manifest v0.1 — COMPLETED (#631/#632)

Read-only component identity, exports, typed dependencies, conformance commands, effect/authority ceilings, canonicalization declaration, evolution reference and explicit non-effects.

### T2 — Dependency / Impact Graph v0.1 — COMPLETED (#633/#634)

Deterministic engineering reachability over typed edges with fail-closed unresolved required dependencies and cycle handling.

```text
Graph Reachability != Compatibility
Graph Reachability != Substitutability
Graph Reachability != Authority
```

### T3a — Graph-vs-Manual Conformance Parity v0.1 — COMPLETED (#635/#636)

Frozen MarketCloser Publication Observation predecessor baseline:

```text
manual commands = 27
graph commands  = 27
missing         = []
extra           = []
commands executed = false
```

### T3b — Generated Conformance Runner v0.1 — COMPLETED (#637/#638)

Constrained direct-process execution of a parity-proven plan with executable allowlist, `shell=false`, bounded environment, deterministic dependency-first order and evidence-only receipts.

### T3c — Execution Evidence Parity v0.1 — COMPLETED (#639/#640)

Historical-manual and generated-order execution of the same 27 commands produced exact per-command status/output-digest parity at the bound frontier.

### T3d — Bounded CI Migration Gate v0.1 — COMPLETED (#641/#642)

Only the proven five-command Marketer Pessimist predecessor slice was migrated. The remaining historical workflow evidence stays separately addressable.

```text
One Migrated Block != Global CI Migration
Migration Admission != Compatibility Proof
Migration Admission != Substitutability
```

### T4 — Receipt Runtime SDK v0.1 — COMPLETED (#643/#644)

Extracted deterministic receipt/content identity mechanics only after byte-stable differential evidence from independent consumers.

Named profiles preserve different historical identity projections; no universal canonicalization algorithm is inferred.

### T5 — Implementation Substitution Assessment v0.1 — COMPLETED (#645/#646)

Consumer-specific replacement assessment across explicit evidence dimensions with decisions:

```text
SUBSTITUTABLE
ADAPTER_REQUIRED
NOT_SUBSTITUTABLE
INSUFFICIENT_EVIDENCE
```

First real assessments are narrow `FUNCTION`-scope substitutions for the two T4 receipt-identity consumers. Whole-component substitution remains false.

```text
Substitution Assessment != Capability Selection
Substitution Assessment != ActionPermit
Substitutable != Selected != Authorized != Activated != Executed
```

## 5. P0 — Release Candidate Checkpoint v0.2 — CURRENT (#647)

Purpose: compose the completed T1–T5 engineering evidence and mandatory governance review evidence for one exact Git revision without assurance escalation.

Engineering gates:

```text
Component Manifest
Dependency / Impact Graph
Conformance Parity
Generated Conformance Runner
Execution Evidence Parity
Bounded CI Migration
Receipt Runtime
Implementation Substitution
```

Governance gates:

```text
Security
Privacy
Accessibility
Contestability
RU/EN semantic + navigation parity
```

Governance evidence vocabulary:

```text
PASS
PRESENT_UNVERIFIED
MISSING
INSUFFICIENT_EVIDENCE
```

Decision vocabulary:

```text
BLOCKED
INSUFFICIENT_EVIDENCE
RELEASE_CANDIDATE_REVIEW_PENDING
READY
```

The first factual post-T5 vector is bound to:

```text
07009a16566fb839acd753215231c6a9c86a896d
```

and currently derives:

```text
engineering = PASS
governance  = REVIEW_PENDING
decision    = RELEASE_CANDIDATE_REVIEW_PENDING
```

Observed governance evidence gaps are not automatically defects:

- Security — historical explicit bounded evidence exists, but it is not a current-frontier project-wide security review;
- Privacy — review proposal exists without an explicit current outcome;
- Accessibility — no project-wide review outcome identified;
- Contestability — proposal/questions exist without an explicit current outcome;
- RU/EN semantic + navigation parity — localized slices exist, but project-wide parity is not established.

P0 must preserve `docs/PROJECT-READINESS-CHECKPOINT-v0.1.md` unchanged.

## 6. P1 — Evidence-Driven Governance Closure — NEXT

P1 MUST NOT pre-create five new governance subsystems. It closes only the gaps P0 actually reports, using the smallest review artifact capable of producing a current-frontier explicit outcome.

Priority order after P0 merge:

1. **Accessibility review** — currently the only `MISSING` gate; define the minimum project-wide review surface and explicit outcome contract.
2. **Privacy + Contestability review closure** — turn existing proposals/questions into bounded current-frontier outcomes without inventing surveillance or authority semantics.
3. **Security current-frontier refresh** — reuse bounded historical audit structure where applicable, but do not inherit its old revision outcome.
4. **RU/EN semantic + navigation parity review** — assess project-level navigation and semantic equivalence; do not infer parity from one localized tooling slice.
5. Re-run P0 after each accepted governance evidence increment. Stop when the checkpoint state changes; do not continue expanding governance merely to create more process.

Potential result after P1 is still evidence-dependent. `READY` is not pre-authorized.

## 7. Deferred directions

The following remain intentionally deferred until repeated independent evidence justifies extraction:

- generic provenance store;
- Human Decision Gate reusable primitive;
- Observation / Provenance Profile;
- bounded interaction lifecycle abstraction;
- adapter SPI;
- additional receipt helpers beyond proven identity mechanics;
- whole-component substitution;
- Core v0.2.

Matawaka Workbench Windows remains paused and outside this convergence line.

## 8. Near-term execution sequence

```text
P0 implementation + factual report
  -> dedicated CI / predecessor preservation audit
  -> merge P0
  -> P1 accessibility review first
  -> checkpoint rerun
  -> close only remaining governance evidence gaps
```

The repository should prefer evidence-producing small successors over speculative universal abstractions.
