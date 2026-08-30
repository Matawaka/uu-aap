# C2PA Swift Round-Trip Preservation v0.1

Status: **candidate interoperability evidence; not C2PA conformance, not UU-AAP Core, and not a normative dependency on an unmerged upstream PR**.

Roadmap: `#778` P0.3. Predecessor binding fixture: `#780` / `4387d95046ac16264e05d0c14012501cef466dfd`.

Upstream candidate under test:

- repository: `contentauth/c2pa-swift`;
- PR: `#161` — `Feat: Preserve unknown fields and accept OS alias`;
- pinned head: `b43d93b7c15daca4f04d33284b821fd1330bbf88`;
- stacked base at observation: `fix/cstring-array-alloc-failure` / `7f337301de08a3d35a07abbf36ccc5f490e8b391`.

The exact commit is used so later force-pushes or branch movement cannot rewrite this evidence.

## Why this test exists

P0.2 proved that a standard C2PA 2.4 `c2pa.external-reference` hashed assertion can bind an external UU-AAP record without inventing a new assertion namespace.

P0.3 asks a different question:

> Can another SDK read, inspect and re-encode relevant C2PA/extension data without silently deleting it or promoting it into stronger semantics?

PR #161 addresses one concrete Swift gap: `ClaimGeneratorInfo` and `Metadata` previously dropped unmodeled JSON members during a decode/encode cycle; the candidate adds an `additionalFields` surface.

## Fixture A — unknown field in an open model

`fixtures/claim-generator-info.json` adds a nested fixture-only field:

```text
org.example.uu_aap_reference
```

This name is **not** a registered C2PA assertion namespace and does not define protocol semantics. It exists only to behave like a future application extension that the SDK does not know in advance.

Acceptance requires:

1. Swift decodes `ClaimGeneratorInfo`;
2. the unknown field is inspectable through `additionalFields`;
3. nested arrays, numbers, booleans and strings remain semantically equal;
4. re-encoding places the field back at the same object level;
5. no unknown data is promoted into top-level `author`, `authority`, `responsibility`, `trust`, `trusted` or `publication_authorization` fields.

## Fixture B — standard external-reference payload

`fixtures/external-reference.json` represents the P0.2 interface using:

```text
label = c2pa.external-reference
```

At the pinned Swift candidate frontier this label is not represented by a dedicated enum case. `AssertionDefinition` therefore decodes it through the generic `.custom(label:data:)` + `AnyCodable` path.

Acceptance requires the complete assertion JSON to be semantically equal after:

```text
decode -> inspect -> encode
```

This includes URL, algorithm, byte-array hash, media type, size, description and an unknown future consumer hint.

## Equivalence rule

**Byte equality is not required. Semantic JSON equality is required.**

JSON object key ordering and encoder whitespace are not semantic. The harness canonicalizes JSON objects with sorted keys before comparison. Values, nesting, array order, field presence and types must survive.

This rule is deliberately narrower than C2PA binary/JUMBF canonicalization and does not redefine it.

## Reproducibility

The root fixture package pins:

- `contentauth/c2pa-swift` to the exact PR #161 head SHA;
- `swift-certificates` to `1.19.4`;
- `swift-asn1` to `1.7.1`;
- `swift-crypto` to `4.5.1`.

These are the lower-bound dependency versions declared by that pinned `c2pa-swift` Package manifest. CI copies the test package to `/tmp` before SwiftPM resolution so no generated build state or `Package.resolved` mutates the UU-AAP checkout.

## Run

On macOS 14+ with a compatible Swift/Xcode toolchain:

```bash
swift run --package-path scripts/c2pa-swift-roundtrip RoundTripFixture \
  scripts/c2pa-swift-roundtrip/fixtures/claim-generator-info.json \
  scripts/c2pa-swift-roundtrip/fixtures/external-reference.json
```

CI runs the same executable on `macos-15` with Xcode 16.4, matching the upstream test family.

## Interpretation

A passing receipt means only:

```text
pinned Swift candidate preserves tested semantics
```

It does **not** mean:

```text
candidate PR merged upstream
all Swift C2PA models preserve unknown fields
Android parity exists
cross-SDK equivalence is complete
preserved field is trusted
preserved field is authoritative
P0.3 is complete
```

P0.3 remains open until at least a stable Swift upstream frontier and an Android/second-SDK parity surface are both evaluated.
