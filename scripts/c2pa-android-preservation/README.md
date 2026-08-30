# C2PA Android Preservation Frontier v0.1

Status: **executable interoperability evidence; not C2PA conformance, not UU-AAP Core, and not a trust or authority mapping**.

Roadmap: `#778` P0.3. Predecessor binding fixture: `#780` / `4387d95046ac16264e05d0c14012501cef466dfd`.

Pinned upstream frontier:

- repository: `contentauth/c2pa-android`;
- commit: `077035cda5bf6849abf270829b98af789cc31e4f`;
- language surface: Kotlin / kotlinx.serialization.

## Question

P0.3 asks whether a consumer SDK can read and re-encode relevant C2PA or extension data without silently deleting it or promoting it into stronger semantics.

The Android SDK currently exposes two different forward-compatibility behaviors.

### Standard / unknown assertion label

`AssertionDefinition` falls back to:

```text
AssertionDefinition.Custom(label, JsonElement)
```

for labels it does not model explicitly. This allows the complete payload of the standard C2PA 2.4 `c2pa.external-reference` fixture to survive decode → inspect → encode as JSON.

### Unknown field inside a modeled object

`ClaimGeneratorInfo` models only its declared fields. The shared `C2PAJson` configuration uses:

```text
ignoreUnknownKeys = true
```

This is tolerant parsing, but it is **not preservation**. An unknown nested field can be accepted on decode and then disappear on encode.

That distinction is the interoperability finding:

```text
ignore unknown != preserve unknown
```

## Executable acceptance

`UUAAPForwardCompatibilityTest.kt` is copied into an exact checkout of the pinned Android SDK and run as a JVM unit test.

It requires both observations to remain true at the pinned frontier:

1. `c2pa.external-reference` decodes as `AssertionDefinition.Custom` and re-encodes with semantic JSON equality;
2. fixture-only `org.example.uu_aap_reference` inside `ClaimGeneratorInfo` is accepted on input but absent after re-encoding;
3. the dropped extension is not promoted into `author`, `authority`, `responsibility`, `trust`, `trusted` or `publication_authorization` fields.

The second assertion is intentionally a **negative preservation receipt**, not a desired end state. If Android later adds unknown-field preservation, this test must fail so the evidence is reclassified rather than silently kept as historical truth.

## Fixture boundary

`org.example.uu_aap_reference` is fixture-only. It is not a registered C2PA assertion namespace and does not define UU-AAP protocol semantics.

The `c2pa.external-reference` fixture uses the standard C2PA label established in P0.2 and remains a reference/binding surface only. Its presence does not prove authorship, authority, responsibility, truth or review.

## Interpretation

A passing Android receipt means only:

```text
external-reference payload preserved: yes
unknown ClaimGeneratorInfo extension preserved: no
unknown extension promoted to authority/trust: no
```

It does not mean:

```text
all Android C2PA data is lossless
all unknown assertions are safe to trust
Swift parity exists
P0.3 is complete
```

## Boundary

No Core files are changed. No C2PA namespace is registered. No provenance field is promoted into UU-AAP authority or responsibility semantics.
