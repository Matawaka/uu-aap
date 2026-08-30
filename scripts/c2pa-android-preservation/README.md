# C2PA Android Preservation Frontier v0.1

Status: **executable interoperability evidence; not C2PA conformance, not UU-AAP Core, and not a trust or authority mapping**.

Roadmap: `#778` P0.3. Predecessor binding fixture: `#780` / `4387d95046ac16264e05d0c14012501cef466dfd`.

Pinned upstream frontier:

- repository: `contentauth/c2pa-android`;
- commit: `077035cda5bf6849abf270829b98af789cc31e4f`;
- observed native dependency: `c2pa-rs v0.90.0`;
- language surface: Kotlin / kotlinx.serialization.

## Question

P0.3 asks whether a consumer SDK can read and re-encode relevant C2PA or extension data without silently deleting it or promoting it into stronger semantics.

The Android SDK currently exposes two distinct interoperability behaviors, both reproduced by CI against the exact pinned commit.

## 1. Standard `c2pa.external-reference`: decode accepted, encode rejected

The pinned Android serializer accepts the P0.2 `c2pa.external-reference` fixture and represents it as the generic:

```text
AssertionDefinition.Custom(label, JsonElement)
```

The subsequent re-encode does **not** succeed. The executable receipt records:

```text
external_reference_generic_path = INCOMPATIBLE
external_reference_failure_stage = encode_rejected
exception = kotlinx.serialization.SerializationException
message = Serializer for class 'Custom' is not found.
```

Therefore this frontier is **not** classified as round-trip preserving. It is an explicit SDK incompatibility on the tested generic re-emission path.

This is narrower than saying Android cannot consume C2PA external references in every possible workflow. It means the public Kotlin `AssertionDefinition` decode → inspect → encode path exercised here cannot losslessly re-emit the standard assertion at the pinned frontier.

## 2. Unknown field inside modeled `ClaimGeneratorInfo`: tolerant but lossy

`ClaimGeneratorInfo` models only its declared fields. The shared `C2PAJson` configuration uses:

```text
ignoreUnknownKeys = true
```

The fixture-only nested field `org.example.uu_aap_reference` is accepted during decode, but it is absent after re-encoding because the model has no preservation map.

This gives the second interoperability finding:

```text
ignore unknown != preserve unknown
```

Tolerant parsing prevents a hard decode failure, but it does not make the SDK a lossless intermediary for unmodeled provenance or extension information.

## Executable acceptance

`UUAAPForwardCompatibilityTest.kt` is copied into an exact checkout of the pinned Android SDK and run as a JVM unit test inside the official Gradle project.

The test and workflow require the following frontier to remain explicit:

1. `c2pa.external-reference` decode succeeds into the generic custom assertion path;
2. its re-encode is rejected with a serialization incompatibility at this pinned frontier;
3. fixture-only `org.example.uu_aap_reference` inside `ClaimGeneratorInfo` is tolerated on decode but is not preserved on encode;
4. no dropped or rejected extension is promoted into `author`, `authority`, `responsibility`, `trust`, `trusted` or `publication_authorization` semantics.

The checks are intentionally fail-closed. If a future SDK frontier starts semantically round-tripping the external reference or preserving the nested unknown field, the old receipt must fail and be reclassified rather than silently remaining historical truth.

## Fixture boundary

`org.example.uu_aap_reference` is fixture-only. It is not a registered C2PA assertion namespace and does not define UU-AAP protocol semantics.

The `c2pa.external-reference` fixture uses the standard C2PA label established in P0.2 and remains a reference/binding surface only. Its presence does not prove authorship, authority, responsibility, truth or review.

## Interpretation

A passing Android frontier receipt means only:

```text
external-reference decode: accepted
external-reference re-encode: rejected
external-reference generic path: INCOMPATIBLE
unknown ClaimGeneratorInfo extension tolerated: yes
unknown ClaimGeneratorInfo extension preserved: no (LOSSY)
unknown data promoted to authority/trust: no
```

It does **not** mean:

```text
all Android C2PA data is incompatible
all Android C2PA data is lossy
all unknown assertions are safe to trust
Swift parity exists
P0.3 is complete
```

## Cross-SDK status

This Android evidence is intended to compose with the separate Swift frontier in PR `#781`:

- Swift candidate source exposes unknown-field preservation APIs, but the public SwiftPM consumer is `BLOCKED` by a source↔binary packaging skew before the round-trip harness can execute;
- Android executes successfully, but the tested surfaces are `INCOMPATIBLE` for generic external-reference re-emission and `LOSSY` for unknown nested `ClaimGeneratorInfo` fields.

These states must remain separate. They are not combined into a trust, quality, or compatibility score.

## Boundary

No Core files are changed. No C2PA namespace is registered. No provenance field is promoted into UU-AAP authority or responsibility semantics.
