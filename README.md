# UU-AAP — Augmented Authorship & Accountability Protocol

**Public Draft v0.1 · Request for Comment**  
**Review window:** 22 August 2026 — 6 October 2026

> **Human agency, not human purity. Provenance of decisions, not surveillance of typing.**

UU-AAP is an open proposal for describing accountable human–AI authorship of books and other long-form intellectual works.

It is designed around a simple distinction:

- AI can generate options, transformations, summaries, drafts, searches and critiques;
- humans and organizations can exercise authority, judgment and responsibility in defined scopes;
- the protocol should make those relationships inspectable without pretending that authorship can be reduced to a “human/AI percentage”.

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
- [Краткий путеводитель на русском](proposals/poai/README.ru.md)
- [Genesis principles](proposals/poai/PRINCIPLES.md)
- [Machine-readable schema](proposals/poai/schema/poai-record.schema.json)
- [Test vectors](proposals/poai/test-vectors/)

## Join the public review

- **Broad design discussion:** [What should accountable AI-augmented authorship mean? — Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8)
- **Main RFC:** [UU-AAP v0.1 Public Review — Issue #1](https://github.com/Matawaka/uu-aap/issues/1)
- **Concrete failure cases and proposals:** [Open Issues](https://github.com/Matawaka/uu-aap/issues)

Agreement is not required. Concrete counterexamples, privacy risks, implementation failures and competing models are especially valuable at this stage.

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

For broad questions and competing design models, use [Discussion #8](https://github.com/Matawaka/uu-aap/discussions/8). For a concrete protocol defect or proposed normative change, open an Issue.

**Initial proposer/editor:** [Matawaka](https://github.com/Matawaka)  
This attribution identifies the initial public proposer; it does not grant unilateral authority over future protocol meaning.
