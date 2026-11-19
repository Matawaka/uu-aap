# Matawaka Related Work & Novelty Boundary 2025–2026 — v0.1

Status: `BOUNDED_RESEARCH_PACKAGE_QUALIFIED; NOVELTY_UNRESOLVED`

This directory contains a bounded research-landscape audit for public work published during 2025–2026 that materially overlaps with UU-AAP, Proof of Available Intelligence (PoAI), Matawaka authority/action boundaries, C2PA interoperability, decision provenance, agent authorization, transparency, and human–AI authorship.

## Purpose

The audit is designed to answer four separate questions without collapsing them:

1. What public work clearly predates the public UU-AAP / PoAI frontier?
2. What work emerged independently in a closely parallel time window?
3. What work postdates the public frontier and is useful as convergence evidence without implying influence?
4. Which Matawaka claims remain plausible research-novelty candidates after those overlaps are removed?

## Public Matawaka anchors used by this audit

The audit uses repository-public evidence, not private project history, as its temporal baseline.

- `Matawaka/uu-aap` public repository creation: 2026-08-22.
- PoAI compositional-intelligence boundary: Issue #27, created 2026-08-22. It explicitly separates resource provenance, availability/consideration, authority, and responsibility.
- UU-AAP Minimal Stable Core: Issue #303, created 2026-08-24. It defines the seven-layer typed flow `State/Evidence -> Availability -> Intent -> Authority/Responsibility -> Coordination -> Action Gate -> Outcome/Successor` and requires explicit assertions plus non-effects.
- Agent-callable gateway: Issue #307, created 2026-08-24. It exposes the stack to agents before externally consequential actions and binds predecessor state, authority, constrained effect, observed result, and successor state.

These are publication anchors only. They do not prove invention dates, patent priority, first conception, or world-first status.

## Method

Every external source is classified independently by:

- first public date observed;
- source class and maturity;
- relation to the public Matawaka anchor (`PUBLIC_PREDECESSOR`, `PARALLEL_WINDOW`, `POST_PUBLICATION_CONVERGENCE`);
- exact overlap with one or more Matawaka semantic surfaces;
- important non-overlap;
- whether the source defeats a broad novelty claim, only narrows it, or is merely adjacent;
- source-status limitations.

The audit deliberately distinguishes IETF consensus RFCs from individual Internet-Drafts, peer-reviewed work from preprints, standards-body drafts from GitHub proposals, and product announcements from protocol specifications.

## Governing boundaries

```text
similar language != semantic equivalence
semantic overlap != derivation
chronological precedence != patent prior-art determination
public predecessor != complete prior-art search
post-publication similarity != evidence of influence
independent convergence != endorsement
novelty candidate != novelty established
novelty audit != freedom-to-operate opinion
```

The audit must not claim that Matawaka is "first in the world" unless a separate appropriately scoped evidence process could support that statement. A negative search result is recorded only as `EXACT_MATCH_NOT_FOUND_IN_BOUNDED_AUDIT`.

## Current thesis under bounded audit

The most crowded areas are already clear: AI-contribution disclosure, human accountability, content provenance, provenance-versus-permission separation, agent action authorization, pre-action permits, delegation receipts, execution receipts, transparency/non-equivocation, and ordinary decision traces all have substantial public predecessors.

The stronger remaining research candidates are narrower:

1. **Semantic Non-Escalation under Heterogeneous Evidence Composition** — valid evidence from one semantic layer must not silently create a stronger claim in another layer.
2. **Explicit machine-readable non-effects as receipt semantics** — a receipt states both what it establishes and what it explicitly does not establish where cross-layer confusion is material.
3. **Available Intelligence != Considered Intelligence != Authority** — heterogeneous human, AI, documentary, institutional and model resources are represented with availability and consideration separately from decision authority and responsibility.
4. **End-to-end typed semantic continuity** — one provider-neutral stack links state/evidence, availability, intent, authority/responsibility, coordination, action permission, observed action/outcome, and successor state without implicit transitions.
5. **Cross-domain composition** — the same semantic discipline is applied to human–AI authorship/governance and real-world agent action rather than treating those as unrelated accountability domains.

All five remain `NOVELTY_CANDIDATE`, not `NOVELTY_ESTABLISHED`.

## v0.1 package

- `README.md` — method, interpretation, boundaries and synthesis.
- `STATUS.md` — exact predecessor and current bounded research posture.
- `NOTE.md` — preserves the distinction between materialization and independent qualification.
- `source-ledger.json` — machine-readable public-source census.
- `source-ledger.schema.json` — closed schema for the census.
- `claim-matrix.json` — Matawaka claim -> external overlap -> bounded novelty posture.
- `claim-matrix.schema.json` — closed schema.
- `validate_landscape.py` — deterministic cross-document and semantic validator.
- `test_landscape.py` — hostile mutation suite preventing temporal/semantic promotion.
- `SOURCES.md` — human-readable annotated bibliography and status notes.
- `NOVELTY-BOUNDARY.md` — candidate claims that survive the bounded audit and claims that should not be used.
- `implementation-receipt.json` + schema — preserves the pre-qualification candidate state.
- `qualification-receipt.json` + schema — preserves the first fail-closed run and first independent GREEN qualification without rewriting either history.
- `validate_qualification.py` — exact frozen first-qualification validator.
- `.github/workflows/related-work-novelty-boundary-v0.1.yml` — repository-read-only CI; located outside this directory only because GitHub Actions requires workflow placement under `.github/workflows/`.

## Qualification history

The first pull-request run correctly failed closed only at the audit-only diff guard because the shallow checkout did not contain the exact predecessor object. The source ledger/claim-matrix validator and hostile suite had already passed.

The successor workflow fetched full history, bound the exact predecessor, and produced the first independent GREEN qualification on head `0c2c17ae81a82c19c16f4655d351b69a1ab9681a`:

- source ledger + claim matrix: `SUCCESS`;
- hostile suite: `16/16`;
- exact predecessor: `SUCCESS`;
- audit-only diff: `SUCCESS`;
- normative/runtime guard: `SUCCESS`.

This establishes only that the bounded research package and its anti-promotion guards executed as designed. It does not establish novelty, patentability, freedom to operate, influence, priority, or world-first status.

## Validation intent

The validator and hostile suite enforce at minimum:

- unique source and claim identifiers;
- closed vocabularies and exact public anchors;
- conservative separation of predecessor, parallel-window and post-publication evidence;
- post-publication convergence cannot defeat or narrow a pre-existing novelty claim;
- claim references must resolve to admitted ledger sources;
- crowded broad claims require an actual public predecessor classified as defeating the broad claim;
- novelty candidates require bounded surviving claims and cannot silently become `world-first`, `patentable`, or equivalent positive conclusions;
- unknown fields and score/confidence injection fail closed.

## Non-effects

This research package does not:

- change UU-AAP Stable Core, SPEC, PRINCIPLES, schemas or conformance profiles;
- change PoAI Genesis semantics;
- change C2PA interoperability classifications;
- assert patent novelty, patentability, freedom to operate, legal priority or non-infringement;
- infer copying, derivation or influence from temporal proximity;
- convert an Internet-Draft into IETF consensus;
- convert a preprint into peer-reviewed evidence;
- convert external work into Matawaka authority;
- authorize publication outside the repository, release/tag creation, runtime activation or external action.

`Research comparison != semantic mutation != legal conclusion != publication authority`.
