# UU-AAP Current Roadmap Marker

Status: current-roadmap successor marker after post-T1–T5 convergence, Security Evidence Closure, Perceived Causal Liveness, DLC-SI v0.2, and backlog reconciliation.

Canonical origin frontier for this marker: `e7b547353abbbb9eb42c892e68904e73d93c5fb5`.

`ROADMAP.md` remains historical architectural evidence for the reusable-tooling convergence line. Its T1–T5 sections are not rewritten by this marker.

## Current state

- T1 Component Manifest v0.1 — COMPLETED.
- T2 Dependency / Impact Graph v0.1 — COMPLETED.
- T3a–T3d conformance parity / generated runner / evidence parity / bounded CI migration — COMPLETED.
- T4 Receipt Runtime SDK v0.1 — COMPLETED.
- T5 Implementation Substitution Assessment v0.1 — COMPLETED via #646.
- Post-T1–T5 Release Candidate Checkpoint v0.2 — materialized via #648; engineering passed while governance review remained explicitly separate.
- Security Evidence Closure — completed through #672 and successor evidence.
- Perceived Causal Liveness — completed through #528 acceptance closure.
- DLC-SI — canonical v0.1 preserved; v0.2 successor semantics and acceptance completed through #526.
- Live-acceptance audit schema hardening #341 — historical deliverable already completed via #348; earlier reconciliation uncertainty is superseded by pass-010 evidence.
- Backlog Reconciliation — active cleanup/reclassification line under #697.

## Current actionable lanes

1. Finish backlog/roadmap reconciliation and keep open-state distinct from current priority.
2. Develop Personal Sovereign Root / Personal Evidence Fabric (#447), then Circumstantial Provenance / Evidence Independence (#449).
3. Continue KONTUR Game Companion (#445) as a parallel bounded pilot, reusing common runtime semantics rather than becoming a Core dependency.
4. Keep Public Review #1–#7 and Core Pilot 002 successor #718 in `WAITING_EXTERNAL` until actual external evidence arrives; #422 remains a target surface.
5. Keep IP filing/patent tracks separate from architecture critical path where they require applicant, legal, or time-dependent decisions.

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

When later evidence is found, a new additive reconciliation receipt may supersede the current classification while preserving the earlier audit as an honest record of what was known then. Pass-010 applies this rule to #341.

## Invariants

`Historical Roadmap != Current Roadmap Marker`

`Completed T5 != End of Architecture Evolution`

`Open Issue != Current Priority`

`Waiting External != Failed`

`Target Surface != Unimplemented Feature`

`Successor Needed != Historical Work Invalid`

`Later Evidence != Earlier Audit Rewrite`

`Roadmap Marker != Release Authorization`

`Roadmap Marker != Authority`
