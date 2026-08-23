# Project Survival Plane v0.6 — Human Canonical Recognition Protocol

v0.6 records a narrowly scoped human recognition decision for one exact, already-reviewable v0.5 succession proposal.

It does **not** publish, create, mutate, redirect, rename or otherwise establish a canonical origin.

Core boundaries:

`proposal reviewable != canonical recognition`

`human recognition != canonical publication`

`recognition artifact != origin mutation`

`recognized candidate != published canonical successor`

## Required predecessor state

Recognition may be recorded only when:

1. the `CanonicalSuccessionProposal` v0.5 self-digest is valid;
2. the `CanonicalSuccessionProposalAssessment` v0.5 self-digest is valid;
3. the assessment is exactly `proposal_reviewable`;
4. the assessment decision is `human_canonical_recognition_may_be_requested`;
5. proposal and assessment SHA-256 bindings match;
6. project IDs match;
7. candidate frontier/tree/ref-set bindings match the proposal;
8. the human supplies an explicit actor ID, actor-evidence SHA-256, a nonce, validity window, successor-origin logical ID, and the exact confirmation token.

## Human ceremony

The reference implementation requires the exact typed token:

`RECOGNIZE_FOR_CANONICAL_PUBLICATION_PREPARATION_ONLY`

This is an anti-accident ceremony, not proof of legal identity or informed consent in every jurisdiction.

The actor-evidence digest binds an external identity/authority evidence artifact without embedding credentials or secrets.

## Recognition result

A valid `HumanCanonicalRecognition` records repository-scoped intent that one exact candidate may proceed to a later canonical-publication stage.

It keeps false:

- canonical successor established;
- canonical origin created;
- canonical origin mutated;
- publication executed;
- ownership transferred;
- KONTUR activated;
- distributed consensus established;
- cryptographic or legal human identity proven;
- legal effect established;
- truth certified.

## Replay boundary

Issuance reserves the supplied nonce and proposal SHA-256 in a local durable state directory using exclusive file creation.

This prevents duplicate issuance only within that local state directory.

`local recognition replay protection != global/distributed uniqueness`

## No external effect

The v0.6 implementation performs no network I/O and no Git mutation. It reads proposal/assessment files and emits local JSON recognition/assessment artifacts only.

A later protocol must separately authorize and execute canonical publication.
