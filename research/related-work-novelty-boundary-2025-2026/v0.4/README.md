# Semantic-Escalation Fault Taxonomy Audit v0.4

Status: `RESEARCH_CANDIDATE_BEFORE_INDEPENDENT_CI`

Exact predecessor: `e4c5c88d3703968334069026873a5fa880bad226` (qualified foundational-pressure v0.3).

Issue: #962.

## Question

After v0.3 removed all unchanged foundational novelty candidates, this audit asks a narrower evaluation question:

> Is there still useful research space for one machine-checkable mutation corpus that tests heterogeneous invalid semantic promotions across decision epistemics, evidence/provenance, authority/review, invocation/execution/effect and causality?

The audit does **not** ask whether Matawaka invented semantic non-escalation. That broad claim is already untenable.

## Why another successor is necessary

Modern predecessors already name and/or test many individual failures:

- StateBench: resurrection, hallucination, scope leak, stale reasoning, authority violation, temporal decay;
- APL: decontextualization, frame laundering, semantic overclaim;
- AIRGuard: authority confusion;
- CAP+PCL: forged-but-policy-satisfying declared context;
- Causality Laundering: denial-feedback causal leakage;
- WEXP: verifier-enforced claim non-inflation across observation, intent, invocation and execution;
- EAL-Bench: endogenous authorization laundering, but only after the public UU-AAP anchor.

Therefore:

```text
named failure != unified taxonomy
multiple failure classes != first identification of semantic escalation
single-axis conformance suite != cross-layer integration benchmark
post-publication convergence != predecessor evidence
benchmark integration candidate != novelty established
```

## Current bounded result

The broad taxonomy claim is defeated.

Eight of the ten tested promotion classes have meaningful public predecessor support before 2026-08-22. One exact authorization-laundering form appears after publication and is preserved only as convergence evidence. One class — `availability/awareness -> consideration/intent` — lacks an exact modern executable materialization in this bounded corpus, despite strong foundational theory already admitted in v0.3.

The only surviving v0.4 research candidate is therefore deliberately narrow:

> a single machine-checkable mutation corpus and verifier discipline spanning several already-known semantic-promotion families across epistemics, provenance, authority/review, execution/effect and causality.

This is an **integration/evaluation candidate**, not a foundational or world-first claim.

## Promotion classes

1. observation/evidence -> broader truth or semantic claim;
2. untrusted context -> action authority;
3. declared context -> verified context;
4. stale/superseded memory -> current authority;
5. approval/intent -> performed action;
6. invocation/dispatch -> completed effect;
7. provenance/dependency -> causality;
8. identity/presence -> standing or authority;
9. review/approval -> current execution permission;
10. availability/awareness -> consideration or intent.

## Package

- `taxonomy-ledger.json` + closed schema;
- `promotion-matrix.json` + closed schema;
- `validate_taxonomy.py` — temporal, cross-reference, result and exact-v0.3 binding validator;
- `test_taxonomy.py` — baseline + hostile promotion mutations;
- `SOURCES.md` — annotated source notes;
- `TAXONOMY-RESULT.md` — bounded interpretation and successor direction;
- implementation/qualification evidence and dedicated read-only CI.

## Frozen predecessor discipline

`validate_taxonomy.py` recomputes Git blob identities for the qualified v0.3 foundational result, ledger, matrix, validators, hostile suite and qualification evidence. A v0.4 successor cannot quietly weaken v0.3 in order to recover a stronger claim.

## Non-effects

This audit does not establish novelty, world-first status, a complete prior-art search, patentability or freedom to operate. It does not revive v0.3-defeated foundational novelty. It does not modify Stable Core, PoAI Genesis, C2PA interoperability, runtime/products, releases/tags or merge authority.
