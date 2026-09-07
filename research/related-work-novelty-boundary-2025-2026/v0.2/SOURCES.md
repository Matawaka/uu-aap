# v0.2 pressure sources — annotated notes

Only dated public material admitted by `pressure-ledger.json` may be used as predecessor pressure.

| Date | Source | Status | Primary pressure |
|---|---|---|---|
| 2026-04-22 | Execution-Witness Binding / MVAR | SSRN preprint | planning-policy != execution authorization; proof-carrying execution witness |
| 2026-05-10 | SOOS Intent Declaration Primitive | individual IETF Internet-Draft | per-transition intent as a separate governance object |
| 2026-05-12 | Quantifying Potential Observation Missingness in IRL | preprint | original decision-maker may have observations absent from later record |
| 2026-05-24 | SOOS Multi-Agent Delegation | individual IETF Internet-Draft | authority narrowing and multi-agent governance |
| 2026-06-06 | Oplogica verification discipline | public GitHub implementation | deterministic machine-readable negative/limitation flags |
| 2026-06-13 | Agent Action Capsule | individual IETF Internet-Draft | authorization record != what agent actually did; separate outcomes |
| 2026-06-16 | Microsoft IFC for autonomous agents | industry research publication | tool authorization != authorized information flow |
| 2026-06-22 | EP Authorization Evidence Chains | individual IETF Internet-Draft | heterogeneous receipt composition with type-specific verification |
| 2026-06-23 | SCITT AI-Agent Action Receipts | individual IETF Internet-Draft | narrow signed receipt + explicit non-claims |
| 2026-07-22 | QIK-VRT EFFECT_ACK | individual IETF Internet-Draft | receipt != understanding/compliance/effect authorization |
| 2026-07-29 | FAVA | preprint | evidence-backed permission graph + deterministic SMT pre-effect gate |

## MVAR

Public posting used for chronology: 22 April 2026. The paper states an earlier written date, but the audit does not promote a private/written date into public priority.

Relevant overlap: policy may be evaluated before execution and carried as an execution witness; one-time authorization evidence can be consumed deterministically. This substantially weakens any broad Matawaka claim around proof-carrying pre-action authorization.

## SOOS

SOOS is treated as a family, not one isolated draft. IDP and MAD alone establish that by May 2026 public work already separated intent declaration, delegation and authority narrowing inside a broader governed execution architecture. Later SOOS SOV/MJWT/GAR/AEP/HEM documents increase the architectural overlap, but v0.2 uses the earliest dated public members as the primary chronology anchors.

Important limitation: individual Internet-Drafts are work in progress and are not IETF consensus.

## Oplogica

Repository metadata observed in this audit:

```text
created_at = 2026-05-20T19:22:21Z
pushed_at  = 2026-06-06T15:43:42Z
```

The public `verification_discipline.py` exposes fixed machine-readable negative fields including decision-correctness/compliance/fairness non-establishment. This defeats any broad claim that Matawaka invented machine-readable negative semantics.

It does **not** by itself defeat the narrower shared-envelope claim because Oplogica's discipline block describes one verification-result family rather than heterogeneous typed receipts composed under one common semantic contract.

## EP-AEC

The -00 draft is dated 22 June 2026. Its key pressure is direct: it composes identity, delegation, permit, human authorization and transparency evidence for one exact action, verifying each type under its own rules and applying a fail-closed requirement expression.

Therefore heterogeneous receipt composition is not a Matawaka novelty claim.

The remaining distinction, if any, must be outside authorization-satisfaction composition: availability, consideration, authorship responsibility, outcome/successor semantics, or a general semantic-power calculus.

## SCITT action receipts / AAC

These two independent drafts substantially pressure Matawaka's receipt semantics:

- the SCITT agent receipt explicitly limits what a signed action record proves;
- AAC distinguishes authorization records from what the agent actually did and treats later outcomes as separate statements.

This means `authorization != action != outcome` is already prior public work.

## QIK-VRT EFFECT_ACK

The July draft explicitly distinguishes technical receipt from downstream-effect authorization and states that receipt does not establish understanding, policy compliance or truth of external evidence. It is strong prior art against broad semantic-non-promotion rhetoric, although it remains a specialized transport/application boundary.

## FAVA and Microsoft IFC

Both pressure the claim that semantic safety comes from model-side interpretation. FAVA lowers natural-language tasks into an evidence-backed permission graph and verifies it with SMT before effect. Microsoft IFC treats confidentiality/integrity policy as a deterministic system control around autonomous-agent actions.

Neither is an authorship/decision semantic receipt stack.

## Observation missingness

The May preprint establishes that later data may omit observations that were available to the original decision-maker, and that this can change the interpretation of observed actions. Therefore `information available at the time` is not itself a PoAI novelty claim.

The remaining PoAI question is whether existence, availability, consideration/reliance, authority and responsibility are represented as independent relations for heterogeneous intelligence resources.
