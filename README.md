# UU-AAP — Augmented Authorship & Accountability Protocol

**[Русский / Russian](README.ru.md)**

**Public Draft v0.1 · Request for Comment**  
**Review window:** 22 August 2026 — 6 October 2026

> **Human agency, not human purity. Provenance of decisions, not surveillance of typing.**

UU-AAP is an open proposal for describing accountable human–AI authorship of books and other long-form intellectual works.

It is designed around a simple distinction:

- AI can generate options, transformations, summaries, drafts, searches and critiques;
- humans and organizations can exercise authority, judgment and responsibility in defined scopes;
- the protocol should make those relationships inspectable without pretending that authorship can be reduced to a “human/AI percentage”.

## Start here / participate in 5 minutes

New to the project? Start with [`START-HERE.md`](START-HERE.md).

- **Review without coding:** [Issue #422](https://github.com/Matawaka/uu-aap/issues/422) — one concrete counterexample is enough.
- **Discuss UU-AAP:** [Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8).
- **Discuss PoAI:** [Discussion #10](https://github.com/Matawaka/uu-aap/discussions/10).
- **Build or test:** browse [`good first issue`](https://github.com/Matawaka/uu-aap/issues?q=is%3Aissue+state%3Aopen+label%3A%22good+first+issue%22) and [`help wanted`](https://github.com/Matawaka/uu-aap/issues?q=is%3Aissue+state%3Aopen+label%3A%22help+wanted%22).

Participation is not endorsement. These entry points do not change protocol authority, conformance, canonical state, or release status.

## Canonical repository state, provenance and licensing

The canonical repository is `https://github.com/Matawaka/uu-aap`.

For the current map of release/checkpoint anchors, provenance documents, licensing state and repository-control boundaries, see [`docs/CANONICAL-STATE.md`](docs/CANONICAL-STATE.md).

Key repository-facing records:

- [`NOTICE.md`](NOTICE.md) — canonical origin, attribution and anti-impersonation boundary;
- [`RESPONSIBILITY.md`](RESPONSIBILITY.md) — responsibility-laundering boundary;
- [`LICENSE.md`](LICENSE.md) — finalized repository licensing map;
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution licensing and provenance responsibility;
- [`FILE_HASHES.md`](FILE_HASHES.md) — release/checkpoint integrity-anchor policy;
- [`CITATION.cff`](CITATION.cff) — machine-readable project citation.

The finalized open licensing model is:

- non-software content → **CC BY 4.0**;
- software and implementation content → **Apache-2.0**;
- file-specific and third-party notices override repository defaults where applicable.

Open reuse does not transfer canonical project status or endorsement.

`permission to copy != canonical succession`

`open license != endorsement`

The first public draft remains anchored by tag `v0.1`. Later repository-scoped protection and licensing checkpoints are preserved as separate tags rather than silently redefining the release.

## Why this exists

Content provenance standards can bind declarations to digital artifacts. Publishing policies can require AI disclosure. Neither alone describes the **governance of meaning**: who set the intent, selected among alternatives, validated claims, accepted uncertainty, and authorized publication.

UU-AAP adds that layer.

## First real-work pilot

**Pilot 001 — «Вайбкодинг реальности»** is now published as a **UU-AAP/T — Traceable** manifest.

- [Pilot overview](pilots/vibe-coding-reality/README.md)
- [Machine-readable manifest](pilots/vibe-coding-reality/manifest.json)
- [Evidence and limitations note](pilots/vibe-coding-reality/EVIDENCE.md)

The pilot intentionally does **not** claim profile V yet: no canonical PDF/EPUB artifact has been selected and cryptographically bound. This makes the example useful for testing whether the protocol can represent incomplete but honest provenance rather than forcing a false appearance of completeness.

## Research proposals

### Proof of Available Intelligence (PoAI) — Genesis

PoAI is an adjacent, non-normative research proposal exploring a broader question:

> **What relevant human, machine, institutional or documentary intelligence was actually available to a specific decision before it became history?**

PoAI does **not** change UU-AAP v0.1 conformance. It is being developed under [`proposals/poai/`](proposals/poai/) so the boundary between authorship governance and decision-level available intelligence remains inspectable.

- [PoAI start page / Quick Start](proposals/poai/README.md)
- [PoAI Level 3 — public Web Verifier & Record Builder](https://matawaka.github.io/uu-aap/poai/)
- [Level 3 alpha v0.1 checkpoint notes](docs/poai/ALPHA-v0.1.md)
- [PoAI Genesis RFC — Discussion #10](https://github.com/Matawaka/uu-aap/discussions/10)
- [Краткий путеводитель на русском](proposals/poai/README.ru.md)
- [Genesis principles](proposals/poai/PRINCIPLES.md)
- [Machine layer](proposals/poai/MACHINE_LAYER.md)
- [Machine-readable schema](proposals/poai/schema/poai-record.schema.json)
- [Test vectors](proposals/poai/test-vectors/)

## Join the public review

- **Fastest concrete review / Core Pilot 002:** [External Review Entry — Issue #422](https://github.com/Matawaka/uu-aap/issues/422)
- **Russian quick review path:** [PUBLIC_REVIEW.ru.md](PUBLIC_REVIEW.ru.md)
- **Core Pilot 002 protocol:** [Public Review Intake & Contestable Resolution](pilots/core-pilot-002/README.md)
- **Russian Pilot 002 guide:** [pilots/core-pilot-002/README.ru.md](pilots/core-pilot-002/README.ru.md)
- **UU-AAP broad design discussion:** [What should accountable AI-augmented authorship mean? — Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8)
- **PoAI Genesis RFC:** [Proof of Available Intelligence v0.0 — Discussion #10](https://github.com/Matawaka/uu-aap/discussions/10)
- **Main UU-AAP RFC:** [UU-AAP v0.1 Public Review — Issue #1](https://github.com/Matawaka/uu-aap/issues/1)
- **Concrete failure cases and proposals:** [Open Issues](https://github.com/Matawaka/uu-aap/issues)

Agreement is not required. Concrete counterexamples, privacy risks, implementation failures and competing models are especially valuable at this stage.

For the lowest-friction path, one short external comment on Issue #422 is enough to provide a real review candidate. The project-authored invitation is not counted as external evidence, and a reviewer account is not treated as verified identity, authority, standing or expertise. The pilot preserves the submitted evidence separately from project interpretation and disposition; disposition itself does not change the protocol.

## Read in this order

1. [`PRINCIPLES.md`](PRINCIPLES.md) — non-negotiable design principles.
2. [`SPEC.md`](SPEC.md) — normative public draft.
3. [`SPEC.ru.md`](SPEC.ru.md) — Russian explanatory translation.
4. [`schema/uu-aap-manifest.schema.json`](schema/uu-aap-manifest.schema.json) — machine-readable draft.
5. [`examples/book-manifest.example.json`](examples/book-manifest.example.json) — example record.
6. [`PUBLIC_REVIEW.md`](PUBLIC_REVIEW.md) — how to challenge or improve the draft.
7. [`CONTESTABILITY.md`](CONTESTABILITY.md) — disputes, corrections and appeals.
8. [`SECURITY.md`](SECURITY.md) — threat model and privacy limits.
9. [`REFERENCES.md`](REFERENCES.md) — standards and adjacent work.
10. [`docs/CANONICAL-STATE.md`](docs/CANONICAL-STATE.md) — canonical repository anchors, provenance, licensing and protection-status boundaries.
11. [`NOTICE.md`](NOTICE.md), [`RESPONSIBILITY.md`](RESPONSIBILITY.md), [`LICENSE.md`](LICENSE.md) and [`GOVERNANCE.md`](GOVERNANCE.md) — repository provenance, responsibility, licensing and governance records.

## Four conformance profiles

- **UU-AAP/D — Disclosed:** participants, AI roles and responsibility scopes are disclosed.
- **UU-AAP/T — Traceable:** adds concept lineage, decision traces, epistemic status and version lineage.
- **UU-AAP/V — Verifiable:** adds cryptographic binding and signed/recorded provenance.
- **UU-AAP/R — Reviewed:** adds independent, scoped review.

Profiles describe **evidence strength**, not quality, truth, morality or “human purity”.

## What UU-AAP will not do

UU-AAP will not require:

- AI detectors as proof of authorship;
- biometric typing evidence;
- continuous screen recording;
- publication of complete prompt histories;
- a single trust score;
- a percentage of “human vs AI” authorship;
- blockchain as a mandatory dependency.

## Interoperability

UU-AAP is intended to reuse established infrastructure where practical, especially C2PA Content Credentials for artifact provenance and W3C Verifiable Credentials for attestations. It does not attempt to replace either standard.

## Public review

This draft is intentionally contestable. Please submit concrete failure cases: privacy harms, coercive uses, ambiguous responsibility, unverifiable claims, interoperability failures, accessibility problems, or unnecessary implementation burden.

For a short concrete review, use [Core Pilot 002 Issue #422](https://github.com/Matawaka/uu-aap/issues/422). Russian-speaking reviewers can start with [PUBLIC_REVIEW.ru.md](PUBLIC_REVIEW.ru.md). For broad UU-AAP questions and competing design models, use [Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8). For PoAI Genesis, use [Discussion #10](https://github.com/Matawaka/uu-aap/discussions/10). For a concrete protocol defect or proposed normative change, open an Issue.

**Initial proposer/editor:** [Matawaka](https://github.com/Matawaka)  
This attribution identifies the initial public proposer; it does not grant unilateral authority over future protocol meaning.
