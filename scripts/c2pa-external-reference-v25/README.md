# C2PA 2.4 → 2.5 external-reference representation re-audit v0.1

**Status:** bounded experimental candidate. **No** normative UV-02 profile change, C2PA 2.5 conformance claim, issuance, runtime gate or external fetch is implemented.

## Why this exists

The repo's [P0.2 `c2pa.external-reference` smoke fixture](../c2pa-external-reference/README.md) pins a 2.4 design baseline and uses `c2patool v0.27.16`. The versioned C2PA **2.5** specification (§14.10.4.2.2, §14.10.5.2–.3) clarifies representation bytes after transfer/Content-Encoding removal, size/hash/media-type handling, and expanded excluded external-assertion labels. This candidate probes those boundaries without upgrading the 2.4 profile.

**Normative sources:**

- 2.4: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html (previous baseline; external reference §18.24)
- 2.5: https://spec.c2pa.org/specifications/specifications/2.5/specs/C2PA_Specification.html (§14.10.4.2.2 and §14.10.5.2–.3)
- Versioned upstream source baseline: https://github.com/c2pa-org/specifications/blob/3d91c65d34d4de1b3af7fd678bfffa6d06e495c4/build/site/specifications/2.5/specs/C2PA_Specification.html.md
- Downstream tracking and deduplication: https://github.com/Matawaka/uu-aap/issues/1004#issuecomment-6393228420

A source export may omit inline CDDL: official versioned HTML and linked schemas take precedence over generated `.html.md` mirrors. No source here establishes C2PA SDK 2.5 support.

## Exactly what this probe checks

`verify-resource.js` accepts **caller-supplied bytes after HTTP transfer decoding** (e.g. after chunk framing is removed); it is *not* an HTTP client. It removes supported Content-Encoding codings (`gzip`, `deflate`, `br`, or identity, in inverse order), checks a bounded post-decoding size, and calculates SHA-256 on the resulting **exact bytes before** charset decoding, JSON parsing, whitespace normalization or reserialization.

A single bounded fixture verifies that the hash, `size` and base media type match the declared values. It rejects malformed SHA-256 digests, unrecognized content codings, decompression failure/limit overflow and two specifically identified newly forbidden external assertion labels (`c2pa.cloud-data`, `c2pa.hash.segment`). **This is not the exhaustive 2.5 assertion-label policy, nor a general HTTP or C2PA validator.** Unchecked labels never gain an `allowed` or conformant classification.

Default local encoded and decoded limits are each 1 MiB. Real deployments require separately reviewed URI allowlists, DNS/IP rebinding protection, credential stripping, redirects, response deadlines, response-type handling, decompression ratio and total budgets. No network retrieval is performed or authorized by this probe.

## Reproduce the offline experiment

```sh
node --check scripts/c2pa-external-reference-v25/verify-resource.js
node --test scripts/c2pa-external-reference-v25/test.js
```

The test suite includes positive cases and hostile counterexamples for raw bytes, gzip, brotli, deflate, stacked encodings, hash-of-compressed-body false positives, unexpected charset/JSON transforms, label refusal, digest and size constraints, byte limits, corrupted compression and unknown content codings. A `PASS` means only those test cases matched this local model.

GitHub Actions also runs the **existing pinned 2.4 baseline** through `c2patool v0.27.16` (sign PNG, re-read, verify exact record hash, reject tampering), separately from the new 2.5 representation probe. A passing baseline SDK smoke is **not** a C2PA 2.5 compatibility result. Runs must be read back before claiming a CI PASS.

## Version / evidence matrix and next gates

| Surface | Evidence classification | Next gate |
| --- | --- | --- |
| Standard hashed `c2pa.external-reference`, C2PA 2.4 | `SUPPORTED_BY_PUBLISHED_SPEC`, existing P0.2 test | Retain historical 2.4 pin and existing signer/authority separation |
| 2.5 decoded representation, size, media type and SHA-256 | `SUPPORTED_BY_PUBLISHED_SPEC` / locally probed subset | Independent review of full 2.5 normative text, fixtures and decoder limits |
| 2.5 external label exclusions | `SUPPORTED_BY_PUBLISHED_SPEC` / partial two-label probe | Complete label matrix, schema semantics and C2PA SDK observation |
| 2.5 HTTP retrieval policies | normative **MAY** protections, partial offline guards | Separate hardened network retrieval design and hostile request/redirect tests |
| Swift/Android/C2PA SDK 2.5 preservation and signature validation | `SDK_EVIDENCE_MISSING` | Exact SDK versions, independent 2.5 signed asset vectors and cross-SDK roundtrips |
| Assertion retraction/status (`specifications#140`) | `PROPOSED_ONLY` | Normative mechanism, status-source authentication, nonresponse distinctions |
| Live-video genesis/resync (`specifications#130` / proposed successor) | `OUT_OF_CURRENT_SCOPE` | Independent profile; no inferred genesis, sentinel predecessor or current blocker |

### Assertion status / authority split (design, not protocol)

Track independently: **(a)** immutable signed C2PA evidence/digest result; **(b)** mutable assertion-status evidence (resolved, not attempted, unreachable or unknown, and only later normative retraction if established); **(c)** independently authorized UU VERIFIED lifecycle and issuer state; **(d)** UU-AAP action authority. No retraction mechanism has yet been adopted by this fixture. A signed C2PA manifest does not establish truth, current status, decision-time availability or permission. Never infer `VALID`, `REVOKED` or `ActionPermit` from the absence of a resolvable status reference.

**Disposition:** research-only PR for human review. No UV-02/UV-03 candidate contract, credential, policy, production issuer, mark or action gate is changed. This PR does not merge itself.
