# UU-AAP Current Roadmap Marker

Status: current-frontier successor after accepted phased Responsibility Status Provenance B + C; completed Core Pilot 002 Run 001, RC v0.5, CAI/C2PA executable interoperability, verifier P1.1–P1.20, unified/finalized Pages deployment, and live deployed-byte observability remain preserved as bounded predecessors.

Canonical reconciliation frontier: `53beba76a82916dcd90239e59b1c0e49db55beae`.

Core Pilot 002 Run 001 accepted frontier:

`26bdda55acf6368726428184d8eed489dbc2c9ad`

Accepted Responsibility Stage B frontier:

`5201cb686bcef52053e055595c2315c36aa1ec56`

Accepted Responsibility Stage C / current semantic successor frontier:

`967e026eac9de58753fc01934d7e6a431b9c973c`

Predecessor current-roadmap blob:

`98f6d594b7d45013bec5c3155fb2b47c72bca795`

The predecessor marker correctly stopped at `HUMAN_NORMATIVE_DESIGN_DECISION_REQUIRED`. Issue #852 then recorded the human choice of phased B + C; #854 accepted optional machine-native responsibility-status provenance binding, and #856 accepted the optional `UU-AAP/RA1` stronger assurance overlay. This successor advances only the **current** state. It does not rewrite Run 001, historical v0.1 manifests, Current Frontier Reconciliation v0.2, Release Candidate Checkpoint v0.5, or any historical Core/SPEC artifact.

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
- Release Candidate Checkpoint v0.4 — PRESERVED HISTORICAL via #734.
- Current Frontier Reconciliation v0.2 — ACCEPTED via #841; it reconciled the repository through verifier P1.20 while preserving external gates and C2PA P0.3 incompleteness.
- Release Candidate Checkpoint v0.5 — ACCEPTED via #843; its bounded decision remains `RELEASE_CANDIDATE_EXTERNAL_EVIDENCE_PENDING` for its exact frontier and creates no release/tag/publication authority.
- CAI/C2PA priority execution roadmap #778 — COMPLETED as an interoperability roadmap. P0.1, P0.2 and P0.4–P0.8 produced executable evidence/composition surfaces; the evidence-informed profile is merged.
- C2PA P0.3 cross-SDK preservation — `INCOMPLETE`. #783 preserves Swift `BLOCKED` and Android `INCOMPATIBLE/LOSSY`; #791 reports `NO_RECLASSIFICATION_REQUIRED`, which does not mean the gaps are resolved.
- C2PA evidence PRs #781/#782 — `INTENTIONALLY_UNMERGED_EVIDENCE_ANCHORS`. They are consumed by exact SHA from merged #783/#791 and are not ordinary pending feature merges.
- Verifier presentation/distribution P1.1–P1.20 — `ACCEPTED_BOUNDED`. The chain keeps integrity, identity, provenance, availability, authority, responsibility and truth separate; candidate federation/disposition/integrity remain distinct from authority.
- Pages post-deployment observability — `OBSERVED_MATCH_BOUNDED`: P1.18 succeeded after the P1.20 deployment for the exact triggering artifact envelope and observed public payload bytes. This is not producer authentication, trusted time, truth or future availability.
- KONTUR successor #722 — `PARALLEL_NON_CORE`; field/product evidence does not create a Stable Core dependency.
- Public Review #1–#7 — `WAITING_EXTERNAL`; one completed Pilot 002 run does not by itself complete broader Public Review or establish external validation.
- Core Pilot 002 #718/#422 — `COMPLETED_ACCEPT_FOR_FOLLOWUP`. #845 byte-bound the public source, #846 admitted the exact source under repository-owner selection, and #849 completed Run 001. Machine result: `pilots/core-pilot-002/run-001/result/v0.1/result.json`; result class `REPRESENTATION_PROVENANCE_GAP_CONFIRMED_WITH_EXISTING_DISPLAY_MITIGATION`. Reviewer human identity and independence remain unestablished; standing/expertise/authority remain unknown; the submission is not promoted to truth.
- Responsibility Status Provenance Binding v0.1 / Stage B — `ACCEPTED_OPTIONAL_BINDING` via #854. `protocols/responsibility-status-provenance/v0.1/` adds a separately versioned sidecar that binds an exact manifest SHA-256 plus exact responsibility index and copied entry. It supports `DECLARATION_ONLY` and `ATTRIBUTABLE_ACCEPTANCE_EVIDENCE_BOUND` without modifying the historical v0.1 manifest schema.
- Responsibility Assurance `UU-AAP/RA1` v0.1 / Stage C — `ACCEPTED_OPTIONAL_ASSURANCE_OVERLAY` via #856. `protocols/responsibility-assurance/v0.1/` consumes accepted Stage B and requires attributable acceptance evidence coverage for every `accepted/shared` responsibility entry only when the stronger RA1 claim is asserted. D/T/V/R remain unchanged.
- Human responsibility design gate #852 — `COMPLETED`; phased B + C was selected and separately accepted. The Run 001 representation gap now has an additive machine-native successor and optional stronger assurance path without silent reinterpretation of historical v0.1 declarations.
- Workbench — `PAUSED_EXTERNAL_PRODUCT` by explicit human decision. Historical Workbench evidence remains provenance; Workbench development is not in the current UU-AAP critical path.
- IP/software-registration/patent tracks #486/#492 — `HUMAN_OR_EXTERNAL_DECISION`; they remain separate from Core architecture completion.

## Current release boundary

```text
engineering = PASS_BOUNDED
internal governance = PASS_BOUNDED
security evidence = EVIDENCE_CLOSED_BOUNDED
C2PA P0.3 = INCOMPLETE
verifier P1.1-P1.20 = ACCEPTED_BOUNDED
public review #1-#7 = WAITING_EXTERNAL
core pilot 002 run 001 = COMPLETED_ACCEPT_FOR_FOLLOWUP
responsibility Stage B = ACCEPTED_OPTIONAL_BINDING
responsibility Stage C / UU-AAP/RA1 = ACCEPTED_OPTIONAL_ASSURANCE_OVERLAY
Workbench = PAUSED_EXTERNAL_PRODUCT
release candidate v0.5 = EXTERNAL_EVIDENCE_PENDING (historical exact-frontier decision)
```

`Engineering PASS != External Validation`

`Internal Governance PASS != External Validation`

`One External Pilot Input != External Validation`

`Run 001 Completed != Universal Validation`

`Stage B Binding != Verified Identity or Authority`

`RA1 Satisfied != Truth, Liability, Certification or Release Authority`

`External Evidence Pending != Failure`

`Release Candidate != Release`

No current roadmap marker creates release/tag/publication authority, certification, legal status, runtime activation or ActionPermit.

## Current actionable lanes

1. Continue genuine external participation through Public Review #1–#7 and low-friction surfaces #774/#775. The completed Pilot 002 run plus accepted B+C successor is one bounded external-source feedback cycle, not general external validation or certification.
2. Treat the responsibility B+C line as `ACCEPTED_BOUNDED` unless field/interoperability evidence reveals a concrete remaining gap. Do not create another responsibility semantic layer merely to extend the version sequence.
3. When a verifier or downstream integration needs responsibility assurance, reuse Stage B declaration/evidence separation and present RA1 as a separate optional overlay; do not collapse it into D/T/V/R or a universal verified-responsibility badge.
4. Keep C2PA P0.3 on successor-watch. Re-audit Swift/Android only when upstream interfaces move enough to require a targeted executable successor; do not rewrite #781/#782/#783.
5. Keep KONTUR as a parallel bounded product/pilot lane; no automatic Stable Core promotion or live-runtime mandate.
6. Keep Workbench paused until a separate human decision resumes that product line.
7. Keep IP/legal/private filing work separate from the architecture critical path and ask for human decisions where applicant, privacy, payment, jurisdiction or filing strategy is material.
8. For legacy PoAI Level 3/4 issues, create a fresh successor only when a current concrete need is selected; historical open state alone is not implementation priority.
9. Before adding any unrelated semantic Core layer, require a concrete externally or operationally evidenced gap that cannot be solved by existing integration/tooling surfaces.

No P1.21 or unrelated new Stable Core layer is the default next step.

## Roadmap-role vocabulary

- `CURRENT` — actionable repository work supported by current evidence.
- `ACCEPTED_BOUNDED` — accepted implementation evidence for a named scope, without authority/truth escalation.
- `COMPLETED_ACCEPT_FOR_FOLLOWUP` — a bounded pilot/run completed with a preserved concern and follow-up disposition; this is not truth certification or repair authority.
- `ACCEPTED_OPTIONAL_BINDING` — an additive optional machine representation is accepted while historical baseline records remain valid without it.
- `ACCEPTED_OPTIONAL_ASSURANCE_OVERLAY` — an optional stronger claim/profile is accepted and consumes a bounded predecessor without changing baseline validity.
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

## Core Pilot 002 -> Responsibility B+C rule

The first #422 submission moved through separate, preserved stages:

```text
public source observed
  -> exact source admitted by explicit project selection
  -> counterexample reproduced against exact current schema
  -> interpretation kept separate from source
  -> disposition = accept_for_followup
  -> explicit human B+C decision
  -> Stage B optional exact status-provenance binding
  -> Stage C optional RA1 stronger assurance overlay
```

The accepted Run 001 result remains the evidence that motivated the successor. B and C do not rewrite that result or the original responsibility entry. Stage B binds provenance outside the historical entry; Stage C makes a stronger coverage claim only when the accepted Stage B evidence exists for all `accepted/shared` entries.

```text
Different Account Label != Verified Human Identity
Author Association NONE != Independence Proof
App-Mediated Submission != Synthetic By Definition
Admitted External Source != Accepted Truth
Counterexample Reproduced != Reviewer Authority
accept_for_followup != Normative Change
Stage B Declarant Reference != Verified Identity
Stage B Acceptance Evidence != Authority Proof
Stage B Attributable Acceptance != Factual Truth
RA1_NOT_SATISFIED != Baseline Manifest Invalidity
RA1 Satisfied != Legal Liability or Certification
RA1 Satisfied != Release/Publication/Action Authority
```

No later successor may erase the source objection, rewrite the Run 001 result, or silently reinterpret historical v0.1 manifests merely because B+C now exists.

## Reconciliation correction rule

`Insufficient Evidence at T1 != Unimplemented Forever`.

When later evidence is found, a new additive reconciliation/observation/result receipt may supersede a current classification while preserving the earlier audit as an honest record of what was known then.

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

`Different Account Label != Verified Human Identity`

`Admitted External Source != Accepted Truth`

`Run Disposition != Normative Change`

`Stage B Binding != Responsibility Status Rewrite`

`Evidence Bound != Evidence Trusted`

`Attributable Acceptance != Authority`

`RA1 != D/T/V/R Rewrite`

`RA1 != Certification`

`Internal Governance PASS != External Validation`

`Release Candidate != Release`

`Roadmap Marker != Release Authorization`

`Roadmap Marker != Authority`
