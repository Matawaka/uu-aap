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

**Initial proposer/editor:** [Matawaka](https://github.com/Matawaka)  
This attribution identifies the initial public proposer; it does not grant unilateral authority over future protocol meaning.
