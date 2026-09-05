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

## What this tests

The macOS job pins the exact current Swift main and attempts to build an external SwiftPM consumer using the same semantic fixtures originally prepared in #781.

Possible executable classifications are:

```text
ROUNDTRIP_PASS
BLOCKED_SOURCE_BINARY_SKEW
BUILD_FAILED_OTHER
ROUNDTRIP_FAILED
```

CI accepts as a qualified current frontier only:

- `ROUNDTRIP_PASS`, after the fixture actually executes and both semantic round trips pass; or
- `BLOCKED_SOURCE_BINARY_SKEW`, when the build fails on the known `c2pa_reader_crjson` source/binary mismatch.

`BUILD_FAILED_OTHER` and `ROUNDTRIP_FAILED` are observable classifications but fail admission so the unexpected frontier must be investigated rather than normalized.

## Semantic fixture coverage

If the build succeeds, the fixture verifies:

1. unknown nested `ClaimGeneratorInfo` data is inspectable through `additionalFields` and survives decode/encode semantically;
2. standard `c2pa.external-reference` survives the generic assertion path semantically;
3. unknown data is not promoted into authorship, authority, responsibility, trust or publication authorization.

## Historical boundary

This successor never rewrites:

- #781 historical Swift `PASS(source) / BLOCKED(round-trip)` evidence;
- #782 historical Android `INCOMPATIBLE / LOSSY` evidence;
- merged #783 `INCOMPLETE` cross-SDK contract.

A current Swift `ROUNDTRIP_PASS` would establish only the tested Swift current frontier. It would **not** make P0.3 complete while Android remains unchanged.

## Invariants

```text
Source preservation != Consumer round-trip
Upstream merge != Packaging compatibility
Packaging compatibility != Semantic preservation
Semantic preservation != Trust or authority
Successor result != Historical rewrite
```

## Metadata correction

Historical PR text that calls #777 a live draft is stale: #777 is closed without merge. The correction belongs in successor comments/metadata, not by rewriting old evidence branches.
