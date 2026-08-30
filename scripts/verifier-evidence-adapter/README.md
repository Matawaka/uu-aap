# P1.4 Evidence Adapter Layer v0.1

Issue: #802.

P1.4 inserts a deliberately bounded layer between external observations and the P1.3 explicit-input verifier.

```text
external observation
        |
        v
bounded registered adapter
        |
        v
candidate claim
        |
        X  no automatic acceptance
        |
        v
future explicit acceptance/materialization gate
        |
        v
P1.3 dimension_claims
```

The core invariant is:

```text
candidate claim != accepted verifier claim
```

## Initial registry

| Adapter | Allowed candidate dimension |
| --- | --- |
| `c2pa.provenance.v0.1` | `provenance` |
| `poai.availability.v0.1` | `availability` |
| `uuaap.authority.v0.1` | `authority` |
| `uuaap.responsibility.v0.1` | `responsibility` |

P1.4 v0.1 has no adapter that may emit `integrity`, `identity` or `truth`.

The fixture is derived from the already-merged P0.4 composition semantics. It intentionally also contains external payload fields such as `verified`, `verified_true`, signer/action labels and `trust_score`. Those values remain opaque input data unless a registered adapter explicitly reads a documented field for its single allowlisted dimension.

## Unknown and conflicting evidence

An unknown adapter produces an `UNMAPPED` receipt and preserves the observation as an evidence item. It emits no semantic candidate.

Multiple observations may produce conflicting candidates in the same dimension. P1.4 preserves the plurality; it does not calculate a winner, confidence score or umbrella verdict.

## Local browser surface

`/verifier/adapt/` accepts pasted JSON or a local JSON file and runs the same bounded registry in browser JavaScript. Shared fixtures prove browser output equals the canonical Python package result.

The page performs no server upload, model call, analytics or external runtime request.

## Non-effects

P1.4 does not parse arbitrary C2PA binary/JUMBF data and is not a C2PA conformance implementation. It does not identify a person, establish authorship, backfill historical availability, grant authority, assign responsibility outside an explicit responsibility observation, establish factual truth, or accept any candidate into P1.3 automatically.
