# C2PA Swift Preservation Frontier v0.1

Status: **reproducible interoperability evidence; not C2PA conformance, not UU-AAP Core, and not a normative dependency on an unmerged upstream PR**.

Roadmap: `#778` P0.3. Predecessor binding fixture: `#780` / `4387d95046ac16264e05d0c14012501cef466dfd`.

Upstream frontier under observation:

- repository: `contentauth/c2pa-swift`;
- PR: `#161` — preserve unknown manifest fields / accept OS alias;
- pinned head: `b43d93b7c15daca4f04d33284b821fd1330bbf88`;
- observed stacked base: `7f337301de08a3d35a07abbf36ccc5f490e8b391`.

The exact head SHA is used so later branch movement cannot rewrite this evidence.

## What P0.3 is testing

P0.2 proved that a standard C2PA 2.4 `c2pa.external-reference` hashed assertion can bind an external UU-AAP record without inventing a new assertion namespace.

P0.3 asks a separate preservation question:

> Can an SDK read, inspect and re-encode relevant C2PA or extension data without silently deleting it or promoting it into stronger authorship, authority, responsibility or trust semantics?

The pinned Swift candidate contains the intended preservation mechanism for open manifest models: `additionalFields` plus generic Codable helpers for unmodeled JSON members.

## Current observed frontier

A direct external SwiftPM consumer of the pinned source does **not** currently reach the round-trip executable.

The reason is a source↔binary packaging skew at the exact pinned frontier:

```text
pinned source SHA
  ├─ Reader.swift calls c2pa_reader_crjson(...)
  └─ Package.swift still downloads C2PAC v0.0.12

external SwiftPM build
  └─ cannot find 'c2pa_reader_crjson' in scope
```

This is not interpreted as a failure of UU-AAP semantics and not as evidence that unknown-field preservation itself is wrong. It means the public source package and its referenced binary artifact are not externally consumable together at this exact frontier.

Upstream's own PR checks for the pinned candidate have passed on its native build path. That does not remove the external SwiftPM packaging gap because upstream CI builds a fresh local C2PAC framework before testing the Swift layer.

## CI meaning

The workflow intentionally has two independent checks.

### 1. `pinned source contract`

It verifies against the exact upstream SHA that:

- `ClaimGeneratorInfo` contains `additionalFields`;
- the decoder/encoder helpers for unknown fields exist;
- `Reader.swift` consumes `c2pa_reader_crjson`;
- public `Package.swift` still references `C2PAC v0.0.12`.

### 2. `reproduce SwiftPM source-binary skew`

It resolves the exact candidate through SwiftPM on macOS 15 / Xcode 16.4 and requires the external consumer build to fail for the **specific known symbol mismatch**.

A green check therefore means:

```text
known packaging frontier reproduced exactly
```

It does **not** mean:

```text
round-trip preservation passed
candidate PR merged upstream
all Swift models preserve unknown fields
P0.3 complete
```

If the same pinned frontier ever builds successfully, the receipt fails closed instead of silently converting an old observation into a permanent assumption.

## Dormant round-trip harness

The package still contains `RoundTripFixture`. It is intentionally retained for the next compatible Swift frontier.

When source and binary packaging become mutually consumable, the harness tests two surfaces:

1. an unknown nested field inside `ClaimGeneratorInfo` survives decode → inspect → encode through `additionalFields`;
2. the complete standard `c2pa.external-reference` assertion survives through the generic assertion path with semantic JSON equality.

The fixture also rejects any accidental promotion of preserved extension data into top-level `author`, `authority`, `responsibility`, `trust`, `trusted` or `publication_authorization` keys.

## Equivalence rule

JSON byte identity is not required. Semantic JSON equality is required: values, types, nesting, array order and field presence must survive. Object key ordering and whitespace are not semantic.

This rule is narrower than C2PA binary/JUMBF canonicalization and does not redefine C2PA canonicalization.

## Boundary

This evidence does not:

- modify UU-AAP Core;
- register a UU-AAP C2PA namespace;
- treat preserved fields as trusted;
- infer authority or responsibility from SDK preservation;
- claim that `contentauth/c2pa-swift#161` is merged;
- close P0.3.

P0.3 remains open pending a stable/consumable Swift preservation frontier and parity evidence from Android or another independent SDK.
