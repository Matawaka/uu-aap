# C2PA Swift upstream-merge targeted re-audit v0.3

This package is the executable successor required by merged #791 after the relevant Swift upstream frontier changed.

## Trigger

Historical #781 / #791 evidence was bound to a frontier where `contentauth/c2pa-swift#161` was still open and default-branch `ClaimGeneratorInfo` did not yet expose unknown-field preservation.

Current public evidence now shows:

- `contentauth/c2pa-swift#161` merged on 2026-09-03;
- exact current main pinned here: `6fa8a78c16abac3b3f7eb4832c2cc943c9c19f0f`;
- `ClaimGeneratorInfo.additionalFields` is present on main;
- `Reader.crJSON()` calls `c2pa_reader_crjson`;
- `Package.swift` still references `C2PAC v0.0.12`;
- Android remains exactly `077035cda5bf6849abf270829b98af789cc31e4f` and is not rerun merely for symmetry.

The merged v0.2 re-audit classifier therefore requires a targeted executable Swift retest.

## Qualified current result

The independent macOS runner on exact Swift main `6fa8a78c16abac3b3f7eb4832c2cc943c9c19f0f` resolved the public package, downloaded the exact `C2PAC v0.0.12` artifact, and attempted a real external SwiftPM build.

The observed result is:

```text
Swift current-main source contract = CURRENT_MAIN_SOURCE_PASS
Swift external SwiftPM consumer     = BLOCKED_SOURCE_BINARY_SKEW
Android current frontier            = UNCHANGED_NO_RETEST_REQUIRED
Cross-SDK compatibility             = NOT ESTABLISHED
P0.3 complete                       = false
```

The build failed at current `Library/Sources/Reader.swift` because the Swift source calls:

```text
c2pa_reader_crjson
```

while the public binary package selected by current `Package.swift` remains `C2PAC v0.0.12` and does not expose that symbol to the Swift build.

The build exit code was `1`; the semantic round-trip executable therefore did not run. This is **not** a failed preservation round trip. It is a packaging/source-binary skew that blocks the consumer before the round-trip can execute.

Frozen machine evidence:

- `current-observation.json` — exact execution observation;
- `current-receipt.json` — deterministic typed classification;
- receipt fingerprint: `a7ae8037e188e552c07106f546db16169757bb620250cfd8df17e05e2df77b53`;
- observation SHA-256: `0d71fe53f7adacb68a671e7d71d146a08036676ea095b83e7a791942ca531dea`.

The qualifying Actions evidence was produced by run `33949831417`, artifact `9964473296`, artifact SHA-256 `0f7040a9201b58b788f7eb9fe0aba814b72c37f9cd2bfb4ae900f1de5fe45af7`. The final CI reruns the same pinned consumer and requires runtime observation/receipt parity with the frozen files.

## What this tests

The macOS job pins the exact current Swift main and attempts to build an external SwiftPM consumer using the same semantic fixtures originally prepared in #781.

Possible executable classifications are:

```text
ROUNDTRIP_PASS
BLOCKED_SOURCE_BINARY_SKEW
BUILD_FAILED_OTHER
ROUNDTRIP_FAILED
```

At this pinned frontier, qualification now requires exact parity with the frozen `BLOCKED_SOURCE_BINARY_SKEW` evidence. A future changed upstream/package frontier must be handled by a successor instead of silently changing this historical receipt.

`BUILD_FAILED_OTHER` and `ROUNDTRIP_FAILED` remain distinct observable classifications and fail admission so unexpected behavior is investigated rather than normalized.

## Semantic fixture coverage

If a future successor build succeeds, the fixture is prepared to verify:

1. unknown nested `ClaimGeneratorInfo` data is inspectable through `additionalFields` and survives decode/encode semantically;
2. standard `c2pa.external-reference` survives the generic assertion path semantically;
3. unknown data is not promoted into authorship, authority, responsibility, trust or publication authorization.

Those semantic round-trip checks are **not claimed as executed at this v0.3 frontier**, because the external consumer build is blocked first.

## Historical boundary

This successor never rewrites:

- #781 historical Swift `PASS(source) / BLOCKED(round-trip)` evidence;
- #782 historical Android `INCOMPATIBLE / LOSSY` evidence;
- merged #783 `INCOMPLETE` cross-SDK contract.

The current result refines the reason for Swift blocking after #161 merged: source preservation moved to current main, while external consumer execution remains blocked by the public source/binary package skew.

Android did not move, so P0.3 remains incomplete.

## Invariants

```text
Source preservation != Consumer round-trip
Upstream merge != Packaging compatibility
Packaging compatibility != Semantic preservation
Semantic preservation != Trust or authority
Build blocked != Round-trip failed
Successor result != Historical rewrite
```

## Metadata correction

Historical PR text that calls #777 a live draft is stale: #777 is closed without merge. The correction belongs in successor comments/metadata, not by rewriting old evidence branches.
