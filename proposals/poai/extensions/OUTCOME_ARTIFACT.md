# Observed Outcome Sidecar — Level 3.1i successor research

Status: **experimental successor research** after the frozen `poai-genesis-v0.0.1` checkpoint.

This document does not change Genesis conformance and does not define PoAI/V.

## Why a separate outcome artifact?

PoAI already distinguishes a decision-time horizon from later knowledge. Review, appeal, adjudication, execution and verification artifacts may all appear after the original decision. None of them should silently become the factual outcome.

The outcome layer therefore preserves another boundary:

`verification report != outcome observation != causal attribution != responsibility`

and:

`observed outcome report != truth certification`

A later observation may be useful evidence, but it must not move the original Decision Boundary or Knowledge Cutoff.

## Reuse the Genesis outcome vocabulary

The experimental sidecar reuses the frozen Genesis `outcome.status` vocabulary exactly:

- `not_yet_observable`
- `realized`
- `not_realized_without_intervention`
- `not_realized_after_intervention`
- `indeterminate`
- `not_applicable`

It does not introduce a competing outcome taxonomy.

## Experimental artifact

`PoAIObservedOutcomeSidecar` v0.0.1-experimental contains:

- `observation_id`, `observed_at`;
- root `decision_record_id`;
- optional `future_target_id`;
- references to execution and verification artifacts;
- observer self-declaration with authority and independence remaining unknown;
- `observation_horizon.evidence_cutoff`;
- observation method;
- declared Genesis-compatible outcome status;
- intervention/execution provenance refs;
- separate causal status;
- evidence refs / notes;
- explicit negative claims.

## Causality remains separate

The experiment allows causal-status values:

- `not_assessed`
- `associated_not_proven`
- `disputed`
- `unknown`

`associated_not_proven` follows the existing synthetic Future Target successor example: an intervention can be temporally associated with a non-realized future without PoAI claiming that the intervention alone caused the result.

Therefore:

`not_realized_after_intervention != intervention proven causal`

## Intervention provenance

`not_realized_after_intervention` requires at least one intervention/execution provenance reference. The sidecar may reference an Execution Sidecar such as `urn:poai:execution:...` without treating the executor's report as verified truth.

Conflicting Execution Verification Sidecars may also be referenced simultaneously. Their disagreement is preserved rather than resolved by the outcome artifact.

## Observation horizon

Outcome-time evidence belongs only to the observation horizon:

`observation_horizon.evidence_cutoff <= observed_at`

It may be later than every earlier horizon. It must never be injected into the original decision-time Knowledge Cutoff.

## What v0.0.1 does not establish

Even a sidecar with `declared_outcome.status = realized` or `not_realized_after_intervention` keeps the following claims false:

- observed outcome established as certified fact;
- verified execution/compliance;
- truth certification;
- causal proof;
- legal effect;
- observer authority/independence;
- responsibility;
- canonical outcome or verdict.

A stronger later profile may require cryptographic evidence binding, institutional attestations or multiple corroborating observations before stronger claims are permitted.

## Relationship to successor PoAI records

Genesis already demonstrates a successor decision record that adds a later observed outcome without rewriting the original Knowledge Cutoff. The new sidecar is lower-level observation provenance: it can exist before any later actor chooses to construct a successor decision record.

Creating a successor record from one or more outcome observations is a separate future protocol act and is intentionally not automatic in Level 3.1i.

## Tracking

- RFC: Issue #64
- implementation: Issue #65
- live acceptance: Issue #66
