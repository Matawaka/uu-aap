# Changelog

## Repository hardening — 2026-08-23 (non-normative)

Repository-facing provenance, responsibility, licensing and checkpoint infrastructure was completed and cross-linked without changing UU-AAP v0.1 normative semantics.

Key repository-state changes:

- added canonical project-origin, attribution and anti-impersonation notice;
- added repository-scoped responsibility boundaries to prevent responsibility laundering across forks, merges, AI-assisted work and downstream implementations;
- added machine-readable project citation metadata and repository-scoped CODEOWNERS routing;
- finalized the open licensing split: non-software content under CC BY 4.0 and software/implementation content under Apache-2.0, with full canonical license texts under `LICENSES/`;
- added explicit contribution licensing (`inbound = outbound`) and contributor rights/provenance responsibility;
- created and preserved product-protection checkpoint `uu-aap-product-protection-v0.1`;
- created and preserved open-licensing checkpoint `uu-aap-licensing-v0.1`;
- preserved predecessor PoAI authority and CCRP experimental checkpoint tags;
- added `docs/CANONICAL-STATE.md` as the current non-normative map of release/checkpoint anchors, provenance documents, licensing state and repository-control boundaries;
- clarified that GitHub Rulesets are administrative controls and are not equivalent to committed cryptographic evidence;
- clarified that `.github/CODEOWNERS` is review-routing metadata and that mandatory code-owner approval must not be claimed unless repository rules actually enforce it with a safe reviewer/bypass model.

These hardening changes do not establish legal identity, adjudicated copyright ownership, universal authority, factual truth, causality, downstream responsibility or PoAI/V conformance.

## 0.1 — 2026-08-22

First public draft and first real-work pilot.

Key design decisions:

- replaced blanket “final human responsibility” with scoped responsibility matrix;
- added Augmented Mind principles as normative constraints;
- added explicit uncertainty/epistemic status;
- added contestability, correction and appeal model;
- strengthened anti-surveillance requirements;
- prohibited scalar “human purity” or universal trust scoring;
- clarified C2PA as preferred provenance infrastructure rather than a competing target;
- added W3C Verifiable Credentials as an attestation option;
- documented adjacent IETF Proof of Process drafts with their time-limited status; they are not represented as established standards;
- opened public RFC and Discussion #8;
- added Pilot 001 — «Вайбкодинг реальности» as a UU-AAP/T real-work manifest with explicit limitations and selective-disclosure evidence notes.

The v0.1 release is intended as a stable point of reference for the public review. Future normative changes should be published as successor versions rather than silently rewriting the meaning of this release.
