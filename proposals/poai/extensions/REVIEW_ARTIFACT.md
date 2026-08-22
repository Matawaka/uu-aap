# PoAI Review Artifact / Sidecar — experimental Level 3.1d research

**Status:** successor research after `poai-genesis-v0.0.1`; **not** a Genesis PoAI record type; **not** PoAI/R conformance; **not** PoAI/V.

Tracking: RFC #34, completed first implementation #35/#36/#39, plurality #37, review-time horizon #38, v0.0.2 experiment #42/#43.

## Motivation

A PoAI decision record is intended to preserve a decision-time intelligence horizon. Later reviewers may know more than the original decision-maker and may ask different questions of the same immutable record.

The review context must therefore remain distinct from the decision context.

Core invariants:

`review context != decision context`

`review finding != historical fact at the original Decision Boundary`

`review evidence cutoff != decision knowledge cutoff`

`validity != completeness != truth`

`completeness is purpose-relative`

`multiple reviews may coexist without rewriting the reviewed record`

`disagreement is a relation, not a canonical overwrite`

## Experimental model

Level 3.1d tests a separate browser-generated **Review Sidecar**. The sidecar references the reviewed `record_id` but does not mutate or extend the source PoAI JSON.

The current experimental sidecar records:

- its own artifact type/version;
- `review_id`;
- root `reviewed_record_id`;
- `reviewed_at`;
- `review_horizon.evidence_cutoff`;
- interface-local `review_purpose`;
- review-lens identifier/version;
- optional self-declared reviewer label;
- reviewer authority status as `unknown` in this experiment;
- source validation state as observed by the browser (`PASS` or `unknown`);
- language-neutral observed review-cue codes;
- optional review notes;
- optional relations to other review IDs;
- source artifact-binding state;
- explicit negative claims that the sidecar does not certify truth, causal proof, legal responsibility, authority, or a canonical verdict.

The sidecar intentionally does **not** copy the original Decision Boundary or Knowledge Cutoff.

## Why a separate artifact

Embedding a later review purpose or evidence horizon into the original decision record would risk hindsight injection. A regulator, auditor, publisher, court, researcher and affected participant can legitimately review the same historical record for different purposes and at different times.

A separate artifact allows these reviews to coexist:

`decision record -> review artifact A`

`decision record -> review artifact B`

without requiring either reviewer to rewrite the decision-time provenance.

## Machine boundary

The Review Sidecar deliberately omits `protocol: "PoAI"` and is expected to **fail** the Genesis `poai-record.schema.json` validator. CI tests this rejection explicitly.

This prevents a convenient UI artifact from silently becoming a new Genesis record family.

The current artifact type is:

`PoAIReviewSidecar`

with current experimental export version:

`0.0.2-experimental`

These identifiers are research implementation labels, not finalized protocol vocabulary.

## Review-time horizon

The review has its own epistemic boundary:

- original `decision_boundary.knowledge_cutoff` answers what may belong to the decision-time horizon;
- sidecar `review_horizon.evidence_cutoff` answers what evidence may belong to this later review;
- `reviewed_at` records when the review artifact was produced.

The current experimental temporal invariant is:

`review_horizon.evidence_cutoff <= reviewed_at`

The review evidence cutoff may legitimately be later than the original decision Knowledge Cutoff. That later knowledge MUST remain in the review artifact and MUST NOT be injected into the historical decision record.

This is not a claim that every item before the review evidence cutoff was actually considered. It is only a time boundary for review-time evidence.

## Plurality and review relations

Multiple reviews of one source record may coexist without a single canonical verdict.

Each sidecar continues to point to the root decision through `reviewed_record_id`. Optional `review_relations[]` may point from one review artifact to another review artifact.

Current experimental relation vocabulary:

- `responds_to`;
- `supports`;
- `challenges`.

Example:

`decision record -> review A`

`decision record -> review B --challenges--> review A`

Review B challenging Review A does not mutate Review A and does not rewrite the decision record.

The implementation prohibits a sidecar from targeting its own `review_id`. It does **not** yet provide a global graph registry, cross-file cycle detection, conflict adjudication, reviewer accreditation, or a rule that chooses a winning review.

A set of independently published review artifacts may therefore form a partial graph only when their references are brought together.

## Reviewer authority

Review authority is independent from the authority recorded in the reviewed decision.

The current experiment fixes:

`reviewer.authority_status = unknown`

This prevents a reviewer label, institutional name or mere act of reviewing from being interpreted as accredited authority. Future PoAI/R work may define attestations or authority provenance separately.

## No scalar review score

The sidecar stores cue codes, not a completeness percentage or trust score.

Examples of cue codes include:

- `authority_status_unknown`;
- `consideration_unknown`;
- `used_without_established_availability`;
- `future_target_expected_for_purpose`;
- `publication_artifact_binding_expected`.

This preserves the semantic difference between materially different unknowns.

## No automatic canonical verdict

A review artifact may support or challenge another review, but the current sidecar explicitly does not establish a canonical verdict.

The absence of a single verdict is intentional. Different reviewers may have different purposes, evidence horizons, jurisdictions, mandates or disclosed evidence.

Consensus, adjudication and appeal are separate future institutional questions.

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
5. sidecar has its own `reviewed_at` timestamp;
6. review evidence has a separate `review_horizon.evidence_cutoff`;
7. review evidence cutoff may be later than decision knowledge cutoff but must not be later than `reviewed_at`;
8. no Decision Boundary / Knowledge Cutoff fields are copied into the sidecar;
9. multiple sidecars may reference the same source record and retain independent review IDs;
10. a sidecar may `responds_to`, `supports` or `challenges` another review ID without overwriting it;
11. reviewer authority remains unknown in this experiment;
12. no scalar score fields are emitted;
13. no automatic canonical verdict is emitted;
14. EN/RU presentation does not alter machine sidecar semantics;
15. the Genesis validator rejects the sidecar as a PoAI decision record.
