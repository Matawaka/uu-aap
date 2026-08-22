# PoAI Adjudication / Resolution Artifact — experimental Level 3.1f research

**Status:** successor research after `poai-genesis-v0.0.1`; **not** a Genesis PoAI record type; **not** legal adjudication; **not** PoAI/R or PoAI/V.

Tracking: RFC #49, implementation #50, live acceptance #51. Predecessor research: Appeal RFC #45 and Review Artifact #34.

## Motivation

An Appeal Request records that a challenge was filed. It does not record that the challenge was accepted, rejected, or otherwise resolved.

A later actor or institution may declare a resolution. That declaration should become its own provenance-bearing artifact rather than rewriting the appeal, review, or original decision.

Core invariants:

`appeal request != adjudication decision != executed effect != observed outcome`

`adjudication context != appeal context != review context != decision context`

## Experimental model

Level 3.1f tests a separate browser-generated `PoAIAdjudicationSidecar`.

The artifact records:

- `adjudication_id` and `decided_at`;
- root `decision_record_id`;
- required `appeal_request_id`;
- optional targeted review references;
- self-declared adjudicator label;
- adjudicator authority and jurisdiction as `unknown` by default;
- a language-neutral `declared_disposition`;
- optional language-neutral `declared_directives[]`;
- its own adjudication evidence cutoff;
- optional evidence references and notes;
- explicit negative claims that implementation, execution, observed outcome, truth, causality, legal effect, authority, jurisdiction, and a canonical verdict are not established by the artifact itself.

## Declared disposition is not execution

Example:

`declared_disposition = accepted`

with:

`declared_directive = suspend_pending_review`

means only that the adjudication artifact records a declared acceptance and directive.

It does **not** establish that a suspension was actually implemented.

Therefore:

`declared resolution != executed effect`

and:

`executed effect != observed outcome`

A future execution/compliance artifact may be needed if PoAI is to represent whether downstream actors actually carried out a directive.

## Temporal separation

The Adjudication Sidecar may contain:

`adjudication_horizon.evidence_cutoff`

This cutoff may be later than Decision, Review, or Appeal cutoffs, but it must not be later than `decided_at`.

Later adjudication evidence MUST NOT be copied into earlier provenance horizons.

## Authority and jurisdiction

An adjudicator name or institutional label does not prove authority or jurisdiction.

The first experiment therefore fixes:

- `authority_status = unknown`;
- `jurisdiction_status = unknown`.

Future institutional credentials or attestations may support these claims, but Level 3.1f does not define them.

## Multiple adjudications

More than one adjudication artifact may coexist for the same appeal until a future institutional protocol defines precedence, jurisdiction, or conflict resolution.

PoAI must not invent a winning adjudication merely because one artifact is newer.

## Machine boundary

The artifact deliberately omits `protocol: "PoAI"` and is expected to fail the Genesis `poai-record.schema.json` validator.

It also must not contain Decision Boundary, Knowledge Cutoff, Review Horizon, Appeal Horizon, or scalar trust/completeness/intelligence scores.

## Relationship to future execution / outcome

A future provenance chain may distinguish:

`Decision -> Review -> Appeal Request -> Adjudication -> Execution / Compliance -> Observed Outcome`

This document defines only the experimental Adjudication artifact.

## Privacy

Adjudicator name and notes are optional. No chain-of-thought is required.

## Current acceptance criteria

1. source decision record remains unchanged;
2. `appeal_request_id` is required;
3. adjudicator authority/jurisdiction remain unknown;
4. disposition and directives are language-neutral machine codes;
5. directives do not establish execution;
6. adjudication evidence cutoff is no later than `decided_at`;
7. no earlier provenance horizon is copied into the artifact;
8. no scalar score is emitted;
9. EN/RU presentation does not alter machine semantics;
10. Genesis validator rejects the artifact as a PoAI decision record.
