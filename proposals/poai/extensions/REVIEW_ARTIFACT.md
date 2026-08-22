# PoAI Review Artifact / Sidecar — experimental Level 3.1d research

**Status:** successor research after `poai-genesis-v0.0.1`; **not** a Genesis PoAI record type; **not** PoAI/R conformance; **not** PoAI/V.

Tracking: RFC #34, implementation #35, machine contract #36, plurality #37, review-time horizon #38.

## Motivation

A PoAI decision record is intended to preserve a decision-time intelligence horizon. Later reviewers may know more than the original decision-maker and may ask different questions of the same immutable record.

The review context must therefore remain distinct from the decision context.

Core invariants:

`review context != decision context`

`review finding != historical fact at the original Decision Boundary`

`validity != completeness != truth`

`completeness is purpose-relative`

## Experimental model

Level 3.1d tests a separate browser-generated **Review Sidecar**. The sidecar references the reviewed `record_id` but does not mutate or extend the source PoAI JSON.

The first experimental sidecar records:

- its own artifact type/version;
- `review_id`;
- `reviewed_record_id`;
- `reviewed_at`;
- interface-local `review_purpose`;
- review-lens identifier/version;
- optional self-declared reviewer label;
- source validation state as observed by the browser (`PASS` or `unknown`);
- language-neutral observed review-cue codes;
- optional review notes;
- source artifact-binding state;
- explicit negative claims that the sidecar does not certify truth, causal proof, legal responsibility or authority.

The first sidecar intentionally does **not** copy the original Decision Boundary or Knowledge Cutoff.

## Why a separate artifact

Embedding a later review purpose into the original decision record would risk hindsight injection. A regulator, auditor, publisher, court, researcher and affected participant can legitimately review the same historical record for different purposes.

A separate artifact allows these reviews to coexist:

`decision record -> review artifact A`

`decision record -> review artifact B`

without requiring either reviewer to rewrite the decision-time provenance.

## Machine boundary

The Review Sidecar deliberately omits `protocol: "PoAI"` and is expected to **fail** the Genesis `poai-record.schema.json` validator. CI tests this rejection explicitly.

This prevents a convenient UI artifact from silently becoming a new Genesis record family.

The current artifact type is:

`PoAIReviewSidecar`

with experimental version:

`0.0.1-experimental`

These identifiers are research implementation labels, not finalized protocol vocabulary.

## No scalar review score

The sidecar stores cue codes, not a completeness percentage or trust score.

Examples of cue codes include:

- `authority_status_unknown`;
- `consideration_unknown`;
- `used_without_established_availability`;
- `future_target_expected_for_purpose`;
- `publication_artifact_binding_expected`.

This preserves the semantic difference between materially different unknowns.

## Review-time horizon

The first sidecar stores `reviewed_at` only. A future revision may need a separate review-evidence cutoff, but that must remain distinct from the original decision `knowledge_cutoff`.

Later review evidence MUST NOT be silently copied into the original decision horizon.

## Plurality

Multiple reviews of one source record must be able to coexist. The current sidecar contains `previous_review` / `successor_review` placeholders but does not yet define a canonical review DAG or conflict-resolution mechanism.

Reviewer disagreement is a future design problem, not a reason to collapse reviews into one canonical verdict.

## Relationship to PoAI/R

A future PoAI/R profile may be better modeled as a conformance claim backed by one or more review artifacts rather than as a mutable status on the original decision record.

This is only a hypothesis. No PoAI/R machine requirement is introduced here.

## Privacy and selective disclosure

The browser implementation is local-first. Reviewer name and notes are optional. Future review evidence may need selective disclosure, encrypted references, escrow or attestations.

The review artifact must not require chain-of-thought.

## Current acceptance criteria

1. exporting a sidecar does not mutate the source PoAI JSON;
2. source `record_id` is referenced explicitly;
3. review purpose is stored in the sidecar, not the source record;
4. observed cues are stored as language-neutral codes;
5. sidecar has its own review-time timestamp;
6. no Decision Boundary / Knowledge Cutoff fields are copied into the sidecar;
7. no scalar score fields are emitted;
8. EN/RU presentation does not alter machine sidecar semantics;
9. the Genesis validator rejects the sidecar as a PoAI decision record.
