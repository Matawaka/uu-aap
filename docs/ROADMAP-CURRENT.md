# UU-AAP Current Roadmap Marker

Status: current-frontier reconciliation after RC v0.4, CAI/C2PA executable interoperability, verifier P1.1–P1.20, unified/finalized Pages deployment, and live deployed-byte observability.

Canonical reconciliation frontier: `53beba76a82916dcd90239e59b1c0e49db55beae`.

Predecessor current-roadmap blob preserved by `tooling/current-frontier-reconciliation/v0.2/`:

`8ac748575c6c9f2e1da180d849106b9bab6faead`

Its declared origin was `b3e1fb858ffc30366293c490baed7cbecfcfa26a`. This successor does not rewrite that earlier observation or any Release Candidate Checkpoint v0.1–v0.4 artifact.

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
- Formal RC Governance Review v0.1 — COMPLETED through #728–#732 within bounded repository-evidence scope; this is not external validation or certification.
- Release Candidate Checkpoint v0.4 — PRESERVED HISTORICAL via #734; its decision remains `RELEASE_CANDIDATE_EXTERNAL_EVIDENCE_PENDING` for its exact frontier.
- CAI/C2PA priority execution roadmap #778 — COMPLETED as an interoperability roadmap. P0.1, P0.2 and P0.4–P0.8 produced executable evidence/composition surfaces; the evidence-informed profile is merged.
- C2PA P0.3 cross-SDK preservation — `INCOMPLETE`. #783 preserves Swift `BLOCKED` and Android `INCOMPATIBLE/LOSSY`; #791 reports `NO_RECLASSIFICATION_REQUIRED`, which does not mean the gaps are resolved.
- C2PA evidence PRs #781/#782 — `INTENTIONALLY_UNMERGED_EVIDENCE_ANCHORS`. They are consumed by exact SHA from merged #783/#791 and are not ordinary pending feature merges.
- Verifier presentation/distribution P1.1–P1.20 — `ACCEPTED_BOUNDED`. The chain keeps integrity, identity, provenance, availability, authority, responsibility and truth separate; candidate federation/disposition/integrity remain distinct from authority.
- Pages post-deployment observability — `OBSERVED_MATCH_BOUNDED`: P1.18 succeeded after the P1.20 deployment for the exact triggering artifact envelope and observed public payload bytes. This is not producer authentication, trusted time, truth or future availability.
- KONTUR successor #722 — `PARALLEL_NON_CORE`; field/product evidence does not create a Stable Core dependency.
- Public Review #1–#7 — `WAITING_EXTERNAL`.
- Core Pilot 002 #718/#422 — `WAITING_EXTERNAL`; Run 001 remains inadmissible without eligible independently authored external input.
- Workbench — `PAUSED_EXTERNAL_PRODUCT` by explicit human decision. Historical Workbench evidence remains provenance; Workbench development is not in the current UU-AAP critical path.
- IP/software-registration/patent tracks #486/#492 — `HUMAN_OR_EXTERNAL_DECISION`; they remain separate from Core architecture completion.

## Current release boundary

```text
engineering = PASS_BOUNDED
internal governance = PASS_BOUNDED
security evidence = EVIDENCE_CLOSED_BOUNDED
C2PA P0.3 = INCOMPLETE
verifier P1.1-P1.20 = ACCEPTED_BOUNDED
public review = WAITING_EXTERNAL
core pilot 002 = WAITING_EXTERNAL
Workbench = PAUSED_EXTERNAL_PRODUCT
release candidate = EXTERNAL_EVIDENCE_PENDING
```

`Engineering PASS != External Validation`

`Internal Governance PASS != External Validation`

`External Evidence Pending != Failure`

`Release Candidate != Release`

No current roadmap marker creates release/tag/publication authority, certification, legal status, runtime activation or ActionPermit.

## Current actionable lanes

1. **Primary:** obtain genuine external participation and eligible Public Review evidence through existing low-friction surfaces (#1–#7, #422, #774, #775). Project-authored text must not be counted as external evidence.
2. Admit Core Pilot 002 Run 001 only after its existing admission gate accepts real external input; do not fabricate a participant or pre-authorize a disposition.
3. Keep C2PA P0.3 on successor-watch. Re-audit Swift/Android only when the upstream interfaces move enough to require a targeted executable successor; do not rewrite #781/#782/#783.
4. Keep KONTUR as a parallel bounded product/pilot lane; no automatic Stable Core promotion or live-runtime mandate.
5. Keep Workbench paused until a separate human decision resumes that product line.
6. Keep IP/legal/private filing work separate from the architecture critical path and ask for human decisions where applicant, privacy, payment, jurisdiction or filing strategy is material.
7. For legacy PoAI Level 3/4 issues, create a fresh successor only when a current concrete need is selected; historical open state alone is not implementation priority.
8. Before adding another semantic Core layer, require a concrete externally or operationally evidenced gap that cannot be solved by existing integration/tooling surfaces.

No P1.21 or new Stable Core layer is the default next step.

## Roadmap-role vocabulary

- `CURRENT` — actionable repository work supported by current evidence.
- `ACCEPTED_BOUNDED` — accepted implementation evidence for a named scope, without authority/truth escalation.
- `PARALLEL_NON_CORE` — active or available product/pilot evolution that does not create a Core dependency.
- `PAUSED_EXTERNAL_PRODUCT` — intentionally paused product line outside the current repository critical path.
- `INTENTIONALLY_UNMERGED_EVIDENCE_ANCHORS` — open PR refs retained as immutable evidence inputs, not ordinary merge backlog.
- `SUCCESSOR_NEEDED` — concern remains relevant but the old issue should not be treated as the current implementation frontier.
- `WAITING_EXTERNAL` — blocked on external participant/operator/legal/field evidence.
- `TARGET_SURFACE` — intentionally open interaction/experiment target, not implementation backlog.
- `HUMAN_OR_EXTERNAL_DECISION` — technical work cannot safely choose the remaining applicant/legal/private/action boundary.
- `INSUFFICIENT_EVIDENCE` — current role cannot safely be inferred.

## Legacy PoAI Level 3/4 line

Older open Level 3/4 research and acceptance issues remain historical/research evidence and retain the earlier `SUCCESSOR_NEEDED` current-roadmap classification unless a new concrete successor is selected. This does not claim they were never implemented and does not rewrite frozen PoAI semantics.

## C2PA evidence-anchor rule

#781 and #782 are special current open PRs. Merged #783 intentionally binds their exact evidence heads while keeping them unmerged, and #791 explicitly preserves that arrangement.

```text
Open Evidence PR != Pending Feature Merge
Historical Evidence Anchor != Compatibility PASS
Upstream Unchanged != Gap Resolved
Targeted Re-audit Request != Historical Rewrite
```

They should not be merged or closed merely to make the open-PR count zero.

## Reconciliation correction rule

`Insufficient Evidence at T1 != Unimplemented Forever`.

When later evidence is found, a new additive reconciliation receipt may supersede a current classification while preserving the earlier audit as an honest record of what was known then.

## Invariants

`Historical Roadmap != Current Roadmap Marker`

`Open Issue != Current Priority`

`Open PR != Merge Obligation`

`Waiting External != Failed`

`Target Surface != Unimplemented Feature`

`Successor Needed != Historical Work Invalid`

`Later Evidence != Earlier Audit Rewrite`

`Parallel Pilot != Stable-Core Dependency`

`Field Evidence != Automatic Runtime Authority`

`Integrity != Truth`

`Identity != Authority`

`Provenance != Historical Availability`

`Availability != Consideration`

`Candidate != Disposition != Integrity != Authority`

`Deployed Byte Match != Producer Authentication`

`Internal Governance PASS != External Validation`

`Release Candidate != Release`

`Roadmap Marker != Release Authorization`

`Roadmap Marker != Authority`
