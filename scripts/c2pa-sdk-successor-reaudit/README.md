# C2PA SDK Preservation Successor Re-audit v0.2

Status: **bounded successor observation for #790**. This is not a rewrite of #781/#782/#783, not C2PA conformance, not UU-AAP Core, and not a compatibility or trust score.

Canonical repository predecessor:

`bcec8138cd819db96346d03c81009dbeaf4cd58f`

Historical evidence remains frozen:

- #781 / Swift evidence head `7258f0896429fe0d0ebe8d9aca4b9a509bfda815`;
- #782 / Android evidence head `adb64fc5a3f31753e68833f4182cd56c9ba3ee94`;
- #783 / merged cross-SDK contract `22c656f39003cbdfff939516e6a3d9acca13d9c4`;
- #783 historical status remains `INCOMPLETE`.

## Why this exists

#783 correctly preserved the causal P0.3 matrix:

```text
Swift source preservation contract -> PASS
Swift external SwiftPM round-trip   -> BLOCKED
Android external-reference path     -> INCOMPATIBLE
Android unknown nested field        -> LOSSY
```

Those statements are historical observations at exact upstream/evidence frontiers. A later SDK release must not mutate them in place.

The missing layer is therefore a successor observation that asks only:

> Has the relevant upstream frontier changed enough that the old classification must be retested?

## Classification model

Per SDK:

- `UNCHANGED` — the relevant observed interface/frontier still matches the baseline;
- `CHANGED_REAUDIT_REQUIRED` — the upstream frontier moved or a relevant interface changed;
- `RESOLVED_CANDIDATE_RETEST_REQUIRED` — a previously blocking/lossy surface appears potentially resolved, but no new executable PASS is inferred;
- `UNAVAILABLE` — the upstream observation could not be established.

Overall:

- `NO_RECLASSIFICATION_REQUIRED`;
- `TARGETED_REAUDIT_REQUIRED`;
- `OBSERVATION_INCOMPLETE`.

These states are causal, not ordinal. There is no score.

## Current baseline observation

At the v0.2 baseline:

### Swift

- `contentauth/c2pa-swift#161` is still open;
- PR head remains `b43d93b7c15daca4f04d33284b821fd1330bbf88`;
- candidate source still contains `ClaimGeneratorInfo.additionalFields` and `c2pa_reader_crjson`;
- candidate/public package still references `C2PAC v0.0.12`;
- default branch was observed at `30a6790dc3044e29bb998fe9e7a597d3f33375ea`;
- default-branch `ClaimGeneratorInfo` still lacks `additionalFields`.

Therefore the historical Swift `BLOCKED` classification is not reclassified.

### Android

- `contentauth/c2pa-android/main` remains exactly `077035cda5bf6849abf270829b98af789cc31e4f`;
- `ignoreUnknownKeys = true` remains present;
- `ClaimGeneratorInfo` still has no `additionalFields` preservation map;
- `AssertionDefinition.Custom` remains present.

That is the exact upstream SHA exercised by #782, so the historical `INCOMPATIBLE` / `LOSSY` classifications are not reclassified.

Expected first successor result:

```text
Swift  -> UNCHANGED
Android -> UNCHANGED
overall -> NO_RECLASSIFICATION_REQUIRED
```

This does **not** mean the gaps are fixed or that current lossless compatibility has been established.

## Historical preservation rule

The receipt always preserves:

```text
successor observation != historical rewrite
upstream unchanged != gap resolved
upstream changed != old evidence false
old evidence valid historically != current compatibility established
source change detected != round-trip PASS
packaging change detected != preservation PASS
ignore unknown != preserve unknown
preserve unknown != trust unknown
```

Even when a relevant upstream change is detected, the v0.2 result only requests a new executable audit. It never changes #783's historical `INCOMPLETE` status.

## Live observation

`collect-live.sh` performs public, read-only observations of:

- Swift PR #161 state/head;
- Swift candidate and default-branch packaging/preservation interfaces;
- Android current default-branch SHA and relevant serialization interfaces.

The collector writes only under `/tmp` and does not modify the checked-out repository or any upstream repository.

The workflow intentionally requires the currently expected `NO_RECLASSIFICATION_REQUIRED` state. If upstream moves, the workflow fails closed and exposes the successor classification instead of silently carrying old assumptions forward.

## Targeted successor rules

When Swift changes:

1. do not edit #781;
2. create a new Swift evidence successor;
3. rerun the dormant external SwiftPM round-trip harness on the new consumable frontier;
4. only an actually executed round-trip may become a new `PASS`.

When Android changes:

1. do not edit #782;
2. create a new Android evidence successor;
3. rerun both the standard `c2pa.external-reference` decode/encode path and unknown nested-field preservation test;
4. preserve rejection, loss, or success explicitly.

Only after new executable evidence exists should a new cross-SDK successor contract be created. #783 remains the historical v0.1 contract.

## Non-effects

This re-audit does not:

- modify `protocols/core/**`;
- establish C2PA conformance;
- register a UU-AAP C2PA namespace;
- establish current lossless preservation;
- establish current cross-SDK compatibility;
- create authorship, authority, responsibility or truth semantics;
- create a trust/compatibility score;
- merge or close #781/#782;
- overwrite #783.
