# PoAI Appeal / Contest Request Sidecar — experimental Level 3.1e research

**Status:** successor research after `poai-genesis-v0.0.1`; **not** a Genesis PoAI record type; **not** legal adjudication; **not** PoAI/R conformance; **not** PoAI/V.

Tracking: RFC #45, implementation #46, live acceptance #47.

## Motivation

PoAI decision records preserve a decision-time intelligence horizon. Review Sidecars preserve later review provenance without rewriting that horizon. A further step is needed when an affected participant or institution contests either the original decision, a later review, or both.

The act of contesting must itself become provenance-bearing without silently changing any prior artifact.

Core invariants:

`appeal request != adjudication != reversal`

`appeal context != review context != decision context`

`requested effect != established effect`

## Experimental model

Level 3.1e tests a separate browser-generated `PoAIAppealRequestSidecar`.

The first experimental artifact contains:

- its own artifact type/version;
- `appeal_id` and `filed_at`;
- root `decision_record_id`;
- explicit `targets[]` for the source decision record or a specific Review Sidecar;
- optional self-declared appellant label;
- `authority_status: unknown` and `standing_status: unknown` by default;
- a separate `appeal_horizon.evidence_cutoff`;
- language-neutral grounds codes;
- one requested-action code;
- optional additional evidence references and notes;
- observed source validation state;
- explicit negative claims that the artifact does not establish acceptance, stay, reversal, truth, causality, legal effect, authority, standing or a canonical verdict.

## Target separation

The root decision remains explicit even when a review is the immediate target.

Examples:

`decision -> appeal A`

`decision -> review A <- appeal B`

Appeal B can contest Review A while preserving `decision_record_id` as the root decision context. The review and decision remain different objects.

## Appeal horizon

Later appeal evidence belongs to the appeal-time horizon, not the original decision or review horizon.

The first experiment permits an appeal evidence cutoff that is later than the source Decision Boundary / Review Horizon, but it requires:

`appeal_horizon.evidence_cutoff <= filed_at`

The artifact does not copy the source Decision Boundary, `knowledge_cutoff`, or Review Horizon into itself.

## Grounds

The first language-neutral experimental grounds include:

- `new_evidence`;
- `procedural_issue`;
- `authority_dispute`;
- `factual_dispute`;
- `causal_dispute`;
- `completeness_dispute`;
- `future_intervention_dispute`;
- `other`.

These are request classifications, not findings.

## Requested actions

Experimental requested actions include:

- `reconsider`;
- `correct_record`;
- `review_evidence`;
- `review_authority`;
- `suspend_pending_review`;
- `issue_successor_record`;
- `other`.

Every requested action includes `establishes_effect: false`.

A request for suspension therefore does not create a stay. A request for correction does not modify the source record. A request for a successor does not force a successor to exist.

## Pre-event appeals

An appeal may exist while a Future Target remains `not_yet_observable`. This is a central research property for future-facing governance: a consequential prediction or intervention can be contested before the predicted event becomes factual.

The appeal does not itself change Future Target epistemic status or outcome.

## Standing and authority

The first experiment does not infer institutional standing or appellant authority from a name, role or organization. Both remain `unknown`.

A future institutional layer may represent standing, jurisdiction, acceptance and adjudication separately. Those concepts must not be silently inferred by this Level 3.1e artifact.

## Machine boundary

The Appeal Request Sidecar deliberately omits `protocol: "PoAI"` and is expected to fail the Genesis `poai-record.schema.json` validator.

It also prohibits historical-context/scalar keys such as:

- `decision_boundary`;
- `knowledge_cutoff`;
- `review_horizon`;
- `score` / `percentage` / `rating`;
- `intelligence_score` / `trust_score`.

## Relationship to adjudication

This artifact represents filing/contest provenance only. A future adjudication, acceptance, rejection, stay, remand or reversal should be modeled as a separate provenance-bearing event rather than by mutating this request in place.

Candidate future chain:

`PoAI decision -> Review -> Appeal Request -> Adjudication -> Outcome`

No adjudication model is standardized here.

## Privacy

Browser export is local-first. Appellant name and notes are optional. The artifact does not require chain-of-thought. Future evidence handling may require selective disclosure, encryption, attestations or escrow.
