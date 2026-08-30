# C2PA Cross-SDK Preservation Contract v0.1

Status: **additive interoperability synthesis for #778 P0.3; not C2PA conformance, not UU-AAP Core, and not an aggregate trust score**.

Predecessor: #780 / `4387d95046ac16264e05d0c14012501cef466dfd`.

Evidence inputs are deliberately kept in separate PRs:

- #781 — Swift preservation/source↔binary frontier;
- #782 — Android preservation/encode incompatibility frontier;
- #777 — semantic-boundary draft, which remains independent of this executable evidence.

This directory does not require #781 or #782 to be merged. It binds its observations to their immutable evidence head SHAs and upstream SDK SHAs.

## Why this contract exists

P0.2 showed that UU-AAP can bind an external governance record through the standard C2PA 2.4 `c2pa.external-reference` mechanism without inventing a new assertion namespace.

P0.3 asks the next question:

> If different real SDK consumers encounter that data, what do they preserve, reject, lose, or fail to reach?

A binary pass/fail flag is not expressive enough. More importantly, a numeric compatibility or trust score would erase the causal reason for a failure. The contract therefore uses four explicit surface states:

| State | Meaning |
| --- | --- |
| `PASS` | The narrowly named acceptance condition was actually satisfied at the pinned frontier. |
| `LOSSY` | Input was accepted, but semantically relevant unmodeled data disappeared across the tested read/write cycle. |
| `BLOCKED` | The executable observation could not be reached because packaging/interface state prevented that path from running. |
| `INCOMPATIBLE` | The SDK explicitly rejected the tested surface at a named stage. |

These states are **not ordinal grades**. `BLOCKED` is not “worse” or “better” than `INCOMPATIBLE`; it means a different causal condition.

## Shared fixture proof

The external-reference fixture used by Swift #781 and Android #782 is byte-identical. Both evidence branches expose the same Git blob:

```text
b324c12d86ee82f02ef0fe0b71c9c7d215d40613
```

That makes the comparison a real cross-SDK observation rather than two loosely similar examples.

The `ClaimGeneratorInfo` fixtures have one intentional known-field difference (`operating_system`: macOS vs Android). Their fixture-only `org.example.uu_aap_reference` extension subtree is semantically identical and is compared independently of that platform field.

## Current matrix

### Swift candidate

Pinned upstream candidate:

```text
contentauth/c2pa-swift#161
b43d93b7c15daca4f04d33284b821fd1330bbf88
```

Observed:

- source-level unknown-field preservation contract: `PASS`;
- external SwiftPM consumer round-trip: `BLOCKED`;
- cause: source calls `c2pa_reader_crjson`, while the public package still resolves `C2PAC v0.0.12` without that interface;
- round-trip harness therefore did not execute;
- no executable claim is made that Swift proved the governance-promotion guard.

### Android

Pinned upstream:

```text
contentauth/c2pa-android
077035cda5bf6849abf270829b98af789cc31e4f
```

Observed in the official Gradle project:

- `c2pa.external-reference` decode: accepted;
- generic assertion re-encode: `INCOMPATIBLE` at `encode_rejected`;
- concrete exception: `kotlinx.serialization.SerializationException`, `Serializer for class 'Custom' is not found`;
- unknown nested `ClaimGeneratorInfo` extension: `LOSSY` — tolerated on decode, absent on encode;
- governance-promotion guard on that tested claim path: `PASS`.

## Equivalence rule

For these JSON fixtures, byte identity is not required for a successful semantic round-trip because whitespace and object-key order are non-semantic.

The following are semantic and must survive:

- values;
- JSON types;
- nesting;
- array order;
- field presence.

This rule is only for the JSON fixture comparison. It does **not** redefine C2PA binary/JUMBF canonicalization or signature verification.

## Semantic boundary

Preserving bytes or fields never promotes their meaning.

In particular:

```text
preserved provenance ≠ trusted provenance
C2PA signer ≠ UU-AAP author/approver/responsible actor/decision authority
unknown extension ≠ authority claim
SDK acceptance ≠ truth
SDK rejection ≠ falsity
```

An adapter is allowed to bridge representation differences, but it must not manufacture semantic authority as compensation for SDK incompatibility.

## Overall P0.3 status

`INCOMPLETE`.

The two real SDK consumers have now produced explicit, reproducible states against a shared fixture, which materially satisfies the evidence-gathering side of the P0.3 acceptance surface. But the current frontiers do not establish lossless cross-SDK preservation:

```text
Swift   -> BLOCKED before round-trip execution
Android -> INCOMPATIBLE external-reference re-encode
Android -> LOSSY unknown modeled-object extension
```

The next gate is to re-run against:

1. a consumable Swift preservation frontier where source and binary package are aligned; and
2. an Android frontier or bounded adapter path that can preserve/re-emit the tested data without semantic promotion.

Until then, `p0_3_complete` remains false.

## Failure-closed evolution

The validation is intentionally hostile to stale conclusions:

- evidence PR/head SHAs are pinned;
- upstream SDK SHAs are pinned;
- the cross-SDK external fixture must remain byte-identical;
- the shared extension subtree must remain semantically identical;
- only the four explicit state labels are allowed;
- no key containing `score` may appear in the contract except the explicit prohibition flag `aggregate_score_permitted: false`;
- if a future frontier changes behavior, the old receipt must fail and require explicit reclassification.

## Boundary

This work does not modify UU-AAP Core, register a C2PA namespace, create a universal verifier, or combine provenance and governance into a single trust measure.
