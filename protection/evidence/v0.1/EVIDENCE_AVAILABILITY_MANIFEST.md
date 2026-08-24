# Evidence Availability Manifest v0.1

## Purpose

`EvidenceAvailabilityManifest v0.1` makes one explicitly selected set of evidence files independently byte-verifiable after the files have been copied outside the system that originally produced them.

It records, for each selected regular file:

- a canonical relative path;
- an evidence role label;
- exact byte length;
- SHA-256 of the exact bytes.

The ordered file entries are then bound into one RFC8785/JCS SHA-256 `set_digest` together with the declared repository revision/tree context.

This is a **portable integrity layer**, not an evidence-truth or authority layer.

## Why this is separate from repository integrity

Git commits and tags already identify repository snapshots. `FILE_HASHES.md` deliberately avoids a hand-maintained flat SHA-256 table for every repository file.

This manifest has a different scope: a generated evidence/distribution set that may leave Git or an Actions artifact container.

```text
Git commit/tree identity
!= external evidence-set identity
```

and:

```text
artifact name exists
!= inner evidence bytes independently identified
```

The manifest is generated from actual local bytes. It is not intended to be manually maintained as a repository-wide hash inventory.

## Build boundary

The builder accepts only an explicit list of relative paths beneath one selected root directory.

It rejects:

- absolute paths;
- `..` traversal;
- backslash/non-canonical paths;
- duplicate paths;
- final-path symlinks;
- paths resolving outside the selected root;
- non-regular files.

The builder reads the exact bytes, records their sizes and SHA-256 digests, sorts entries by canonical relative path, and computes the set digest.

## Verification boundary

A verifier with the manifest and a recovered evidence directory can independently check:

1. manifest structure and bounded claims;
2. file-set ordering and uniqueness;
3. exact size of every selected file;
4. exact SHA-256 of every selected file;
5. the aggregate RFC8785/JCS set digest;
6. deterministic manifest identity.

A successful verification receipt means only that the available files match the bytes described by that manifest.

## Claims intentionally kept false

A positive manifest or verification MUST NOT establish:

- durability of the archive/container that carried the files;
- guaranteed long-term availability;
- truth of the evidence contents;
- completeness of the evidence set;
- authority;
- canonicality;
- legal liability;
- KONTUR readiness;
- KONTUR activation authorization;
- KONTUR activation.

Therefore:

```text
manifest verified
!= evidence true
!= evidence complete
!= archive survives forever
!= authority
!= canonicality
!= liability
!= KONTUR readiness
!= KONTUR activation
```

## Retention model

This layer reduces dependence on a short-lived artifact container by making copied inner files self-checkable against a small portable manifest.

It does **not** itself solve storage durability. A manifest whose files have all disappeared is still only a description of unavailable evidence.

For long-lived evidence, the manifest should travel with multiple independently maintained copies under the Continuity plane.

## Usage

Programmatic API:

```js
const Evidence = require('./evidence-availability-manifest.js');

const manifest = await Evidence.buildManifest({
  rootDir,
  sourceContext,
  fileSpecs,
  recordedAt
});

const receipt = await Evidence.verifyManifest({ rootDir, manifest });
```

CLI build:

```text
node evidence-availability-manifest.js build <root> <spec.json> <output.json> <recorded_at>
```

CLI verify:

```text
node evidence-availability-manifest.js verify <root> <manifest.json>
```

The output file is created with create-new semantics; an existing output is not overwritten.

## Relationship to KONTUR

This is a generic protection/evidence primitive. It imports no KONTUR code, performs no KONTUR readiness assessment, and has no activation/preflight/executor surface.

It may later be used to preserve KONTUR audit evidence, but that future use is a separate integration step and must not retroactively strengthen any historical audit conclusion.
