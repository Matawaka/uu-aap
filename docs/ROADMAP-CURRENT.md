# UU-AAP Current Roadmap Marker

Status: current-roadmap successor marker after post-T1–T5 convergence, Security Evidence Closure, Perceived Causal Liveness, DLC-SI v0.2, evidence/provenance closure, backlog reconciliation, Formal RC Governance Review, and RC Checkpoint v0.4.

Canonical origin frontier for this marker: `b3e1fb858ffc30366293c490baed7cbecfcfa26a`.

`ROADMAP.md` remains historical architectural evidence for the reusable-tooling convergence line. Its T1–T5 sections are not rewritten by this marker.

## Current state

- T1 Component Manifest v0.1 — COMPLETED.
- T2 Dependency / Impact Graph v0.1 — COMPLETED.
- T3a–T3d conformance parity / generated runner / evidence parity / bounded CI migration — COMPLETED.
- T4 Receipt Runtime SDK v0.1 — COMPLETED.
- T5 Implementation Substitution Assessment v0.1 — COMPLETED via #646.
- Security Evidence Closure — COMPLETED through #672 and successor evidence; bounded evidence closure is not certification.
- Perceived Causal Liveness — COMPLETED through #528 acceptance closure.
- DLC-SI — canonical v0.1 preserved; v0.2 successor semantics and acceptance COMPLETED through #526.
- Backlog Reconciliation v0.1 — COMPLETED through #697 and evidence-backed closure passes.
- Personal Sovereign Root / Personal Evidence Fabric #447 — COMPLETED via #448.
- Circumstantial Provenance / Evidence Independence #449 — COMPLETED via #721.
- KONTUR bounded fallibility / anti-solver umbrella #445 — historical first implementation acceptance COMPLETED; future cautious evolution moved to successor #722.
- Formal RC Governance Review v0.1 — COMPLETED through #728–#732: all seven internal dimensions PASS within explicitly bounded scopes; this is not external validation/certification.
- Release Candidate Checkpoint v0.4 — COMPLETED via #734; current decision is `RELEASE_CANDIDATE_EXTERNAL_EVIDENCE_PENDING`.

## Current actionable lanes

1. Keep KONTUR Game Companion successor #722 as a **parallel** bounded field/product evolution lane, not a Core dependency or automatic live-runtime mandate.
2. Keep Public Review #1–#7 and Core Pilot 002 successor #718 in `WAITING_EXTERNAL` until actual external evidence arrives; #422 remains a target surface.
3. Keep IP filing/patent tracks separate from architecture critical path where they require applicant, legal, or time-dependent decisions.
4. For the legacy PoAI Level 3/4 research line, create a fresh successor only when a current concrete need is selected; do not treat historical open state as current implementation priority.
5. Before adding another semantic Core layer, prefer integration, field evidence, reusable-engine/tooling consolidation, or a new bounded successor checkpoint justified by current evidence.

## Current release boundary

```text
engineering convergence = PASS
internal governance = PASS (bounded repository evidence)
security evidence = EVIDENCE_CLOSED_BOUNDED
public review = WAITING_EXTERNAL
core pilot 002 = WAITING_EXTERNAL
→ RELEASE_CANDIDATE_EXTERNAL_EVIDENCE_PENDING
```

`Internal Governance PASS != External Validation`

`Release Candidate != Release`

`External Evidence Pending != Failure`

No current roadmap marker creates release/tag/publication authority, certification, legal status, runtime activation or ActionPermit.

## Roadmap-role vocabulary

- `CURRENT` — actionable repository work supported by current evidence.
- `SUCCESSOR_NEEDED` — concern remains relevant but the old issue should not be treated as the current implementation frontier.
- `WAITING_EXTERNAL` — blocked on external participant/operator/legal/field evidence.
- `TARGET_SURFACE` — intentionally open interaction/experiment target, not implementation backlog.
- `INSUFFICIENT_EVIDENCE` — current role cannot safely be inferred.

## Legacy PoAI Level 3/4 line

The older open Level 3/4 research and acceptance issues are retained as historical/research evidence but classified `SUCCESSOR_NEEDED` for current-roadmap purposes by Backlog Reconciliation pass-009. This classification does not claim they were never implemented and does not rewrite frozen PoAI semantics.

## Reconciliation correction rule

`Insufficient Evidence at T1 != Unimplemented Forever`.

When later evidence is found, a new additive reconciliation receipt may supersede the current classification while preserving the earlier audit as an honest record of what was known then.

## Invariants

`Historical Roadmap != Current Roadmap Marker`

`Open Issue != Current Priority`

`Waiting External != Failed`

`Target Surface != Unimplemented Feature`

`Successor Needed != Historical Work Invalid`

`Later Evidence != Earlier Audit Rewrite`

`Parallel Pilot != Stable-Core Dependency`

`Field Evidence != Automatic Runtime Authority`

`Internal Governance PASS != External Validation`

`Release Candidate != Release`

`Roadmap Marker != Release Authorization`

`Roadmap Marker != Authority`
