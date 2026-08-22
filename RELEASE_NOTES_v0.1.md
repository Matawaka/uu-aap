# UU-AAP v0.1 — Public Draft

**Status:** first public reference release / request for comment  
**Public review:** 22 August 2026 — 6 October 2026

UU-AAP v0.1 is the first frozen public reference point for the Augmented Authorship & Accountability Protocol.

It is intentionally a **draft**, not a certification scheme and not a claim that the protocol is complete.

## Included in v0.1

- normative specification (`SPEC.md`);
- Augmented Mind design principles (`PRINCIPLES.md`);
- JSON Schema for machine-readable manifests;
- scoped responsibility matrix;
- AI participation disclosure by role and materiality;
- concept lineage and decision traces;
- epistemic-status vocabulary;
- selective disclosure and anti-surveillance requirements;
- correction, dispute and appeal model;
- C2PA-oriented interoperability strategy;
- W3C Verifiable Credentials as an optional attestation path;
- public governance, contribution and security notes;
- first real-work pilot.

## Pilot 001 — «Вайбкодинг реальности»

The release includes the first UU-AAP/T pilot manifest for a real long-form work created through substantial human–AI collaboration.

The pilot intentionally records limitations rather than hiding them:

- no canonical PDF/EPUB artifact is cryptographically bound yet;
- factual verification is declared as limited/mixed rather than independently audited;
- historical model/version identity is incomplete;
- complete prompt histories remain private;
- no independent book-specific appeal body exists yet.

This is deliberate. UU-AAP should work on imperfect real provenance, not only idealized workflows designed after the protocol exists.

## Integrity model

Tag `v0.1` should point to one exact Git commit. That tagged commit and its recursive Git tree are the canonical protocol-repository snapshot for this release.

The tag should be protected from update and deletion through a GitHub tag ruleset. Later changes to `main` therefore create successor work and do not redefine v0.1.

A separate signed SHA-256 artifact manifest may be added in a future release for distributed files such as PDF/EPUB.

## What v0.1 does not claim

This release does not claim to:

- detect undisclosed AI use;
- prove legal authorship or copyright ownership;
- prove factual truth;
- rank “human purity”;
- require full prompt disclosure;
- provide a universal trust score;
- certify any work or author.

## Public review

Broad discussion:
https://github.com/Matawaka/uu-aap/discussions/8

Main RFC:
https://github.com/Matawaka/uu-aap/issues/1

Concrete protocol defects and proposed normative changes should be opened as separate Issues.
