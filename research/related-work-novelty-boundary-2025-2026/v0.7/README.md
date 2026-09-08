# StateBench Full Payload Replay v0.7

Issue: #970

Exact predecessor: `6823b9765894f410960c15ad797c4f6949c6225e`

Exact predecessor v0.6 subtree: `9372de8b191fd4d4a024e16723556eba097e2cfc`

## Purpose

v0.7 converts the v0.6 StateBench evidence from documentation/bounded-inspection pressure into a real replay of the complete pinned public v1.0 `test.jsonl` payload.

The replay is performed by an independent GitHub Actions runner. It fetches the exact raw path at the exact upstream commit, then independently verifies:

1. byte length = `638933`;
2. Git blob SHA-1 = `3d0bcce1a7725384cf7c25eb4695a784e6a275cd`;
3. UTF-8/JSONL parseability;
4. exactly `209` non-empty records;
5. exactly `209` unique fixture IDs.

Only after those gates does it apply the frozen v0.6 `track-mapping.json` and derive fixture-level mapping counts, actual track/domain counts, query counts, and any unexpected tracks.

## Evidence boundary

The evidence vocabulary remains:

`execution_evidence_level = UPSTREAM_DATASET_ADAPTED`

A successful network run additionally establishes:

`dataset_replay_status = FULL_PINNED_TEST_PAYLOAD_REPLAYED`

This is stronger payload evidence than v0.6, but it is **not** execution of StateBench's model/baseline implementation and is not a Matawaka evaluator run.

Therefore these remain unavailable:

- held-out detection recall;
- benign false-positive rate;
- StateBench model score;
- Matawaka model score;
- detection superiority or non-superiority.

## Anti-cherry-picking rule

v0.7 does not select favorable fixtures. All 209 records in the exact pinned test blob are replayed. The v0.6 track mapping is byte-bound before the payload is analyzed; unknown tracks are retained as `UNMAPPED` rather than silently classified.

## Non-effects

No v0.1-v0.6 rewrite. No Stable Core, SPEC, PRINCIPLES, PoAI, C2PA, runtime, package or product mutation. No upstream implementation claim, LLM-performance claim, novelty/world-first/patentability claim, release authority, standards authority, automatic merge, or merge authority.
