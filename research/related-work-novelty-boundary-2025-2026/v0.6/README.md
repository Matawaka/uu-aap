# Operational Generalization Audit v0.6

Status: `CANDIDATE_BEFORE_INDEPENDENT_CI; INSUFFICIENT_EVIDENCE`

Tracks #966.

Exact predecessor: qualified v0.5 head `186b4a68267f911840ba3a78001dd587fad9af67`.

Exact predecessor research subtree (`v0.5`) Git tree: `d735e56df71952bbd98f09b2d8884db44d511f0b`.

## Question

v0.5 established that unification did **not** improve synthetic detection recall over an intentionally strong specialized-union profile. v0.6 therefore asks a different question:

> Does a common typed semantic-boundary architecture show measurable operational value on independent held-out material through portability, integration complexity, verdict provenance, replayability, or detection — without inflating a lower evidence level into an upstream implementation result?

## First upstream source

The first admitted external source is the public MIT-licensed `Parslee-ai/statebench` repository pinned to commit:

`1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7`

Canonical v1.0 test path:

`data/releases/v1.0/test.jsonl`

Pinned Git blob:

`3d0bcce1a7725384cf7c25eb4695a784e6a275cd`

The upstream model harness/baselines were **not executed** in v0.6. The full pinned test payload was also not materialized and replayed inside this research branch. Therefore no held-out detection recall, benign false-positive rate, StateBench performance comparison, or upstream implementation score is reported.

## What is measured here

v0.6 measures only what the admitted evidence supports:

- exact upstream repository/commit/path/blob provenance;
- a deterministic track-to-v0.4 semantic mapping adapter;
- mapping coverage and ambiguity over the documented pinned-release track vocabulary;
- deterministic adapter replay;
- provenance-field completeness for the adapter result;
- explicit absence of execution evidence for stronger claims.

The documented mapping audit currently produces:

- `DIRECT`: 1 track;
- `PARTIAL`: 4 tracks;
- `AMBIGUOUS`: 3 tracks;
- `UNMAPPED`: 5 tracks;
- total documented tracks under audit: 13.

These are **track-vocabulary mapping counts**, not fixture-performance counts.

## Result

`INSUFFICIENT_EVIDENCE`

The independent corpus already pressures portability because much of its state-correctness vocabulary does not map one-to-one onto the ten v0.4 semantic-promotion classes. But without executing an upstream harness/spec-vector replay or materializing and scoring the held-out payload, v0.6 cannot establish either an operational advantage or an operational non-advantage.

## Non-effects

This audit does not establish detection advantage, integration-complexity advantage, verdict-provenance advantage, portability advantage, no-operational-advantage, upstream implementation performance, LLM performance, real-world superiority, novelty, world-first status, patentability, production readiness, release authority, standards authority, automatic merge, or merge authority.
