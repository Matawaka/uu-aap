# C2PA 2.4 → 2.5 external-reference representation re-audit v0.2

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

`verify-resource.js` accepts **caller-supplied bytes after HTTP transfer decoding** (e.g. after chunk framing is removed); it is *not* an HTTP client. It removes supported Content-Encoding codings (`gzip`, `deflate`, `br`, or identity, in inverse order), checks a bounded post-decoding size, and calculates the declared C2PA 2.5 SHA-256, SHA-384, or SHA-512 digest on the resulting **exact bytes before** charset decoding, JSON parsing, whitespace normalization or reserialization.

A single bounded fixture verifies that the hash, `size` and base media type match the declared values. It rejects malformed algorithm-specific digest lengths, unsupported algorithms, unrecognized content codings, decompression failure/limit overflow, and the **14 explicitly forbidden external target labels** listed by C2PA 2.5 §16.4.2 / §14.10.4.2.2: `c2pa.actions`, `c2pa.actions.v2`, `c2pa.cloud-data`, `c2pa.external-reference`, `c2pa.hash.bmff.v2`, `c2pa.hash.bmff.v3`, `c2pa.hash.boxes`, `c2pa.hash.collection.data`, `c2pa.hash.data`, `c2pa.hash.multi-asset`, `c2pa.hash.segment`, `c2pa.ingredient`, `c2pa.ingredient.v2`, `c2pa.ingredient.v3`. This remains an **offline representation subset, not a general HTTP or C2PA validator**. A caller-supplied label outside this prohibition list is **not** certified as a valid JUMBF assertion, and no C2PA conformance or authority is granted.

Default local encoded and decoded limits are each 1 MiB, with a maximum of four Content-Encoding decompression layers. Real deployments require separately reviewed URI allowlists, DNS/IP rebinding protection, credential stripping, redirects, response deadlines, response-type handling, decompression ratio and total budgets. No network retrieval is performed or authorized by this probe.

## Reproduce the offline experiment

```sh
node --check scripts/c2pa-external-reference-v25/verify-resource.js
node --test scripts/c2pa-external-reference-v25/test.js
```

The test suite includes positive cases and hostile counterexamples for raw bytes, gzip, brotli, deflate, stacked encodings, hash-of-compressed-body false positives, unexpected charset/JSON transforms, label refusal, digest and size constraints, byte limits, corrupted compression and unknown content codings. A `PASS` means only those test cases matched this local model.

GitHub Actions runs two **independent SDK observation lanes** using the same P0.2 SHA-256 external-reference fixture: historical `c2patool v0.27.16` pin and official `contentauth/c2patool v0.28.4` (published 2026-10-26; release Linux archive SHA-256 `097e9efaff765baf7738a40c640012419cad419ce3e1aa36cf68e0576309c971`). Both attempt sign PNG, re-read, verify exact record hash and reject tampering. The 0.28.4 binary is fetched from its exact official release and SHA-256-verified before execution. Observed CI run [41390995537](https://github.com/Matawaka/uu-aap/actions/runs/41390995537) passed the 24-case offline probe, historical v0.27.16 regression and v0.28.4 successor SDK smoke. This *successor SDK smoke* shows only path-specific fixture preservation, **not** C2PA 2.5 conformance, SDK-wide compatibility or any additional assertion status semantics. CI results must be read back before asserting PASS.

## Version / evidence matrix and next gates

| Surface | Evidence classification | Next gate |
| --- | --- | --- |
| Standard hashed `c2pa.external-reference`, C2PA 2.4 | `SUPPORTED_BY_PUBLISHED_SPEC`, existing P0.2 test | Retain historical 2.4 pin and existing signer/authority separation |
| 2.5 decoded representation, size, media type and SHA-256/384/512 | `SUPPORTED_BY_PUBLISHED_SPEC` / locally probed subset | Independent review of full 2.5 normative text, fixtures and decoder limits |
| 2.5 external label exclusions | `SUPPORTED_BY_PUBLISHED_SPEC` / all 14 standard disallowed labels probed | JUMBF/claim-context checks and independent spec-profile review |
| 2.5 HTTP retrieval policies | normative **MAY** protections, partial offline guards | Separate hardened network retrieval design and hostile request/redirect tests |
| C2PATool 0.28.4 successor preservation | `SDK_EVIDENCE_PATH_SPECIFIC_PASS` (CI run [41390995537](https://github.com/Matawaka/uu-aap/actions/runs/41390995537), job `pinned-28-sdk-successor-observation`) | Independent 2.5-signed asset vectors and cross-SDK tests; no version-wide claim |
| Swift/Android SDK 2.5 preservation and signature validation | `SDK_EVIDENCE_MISSING` | Independent 2.5 signed asset vectors and cross-SDK roundtrips |
| Assertion retraction/status (`specifications#140`) | `PROPOSED_ONLY` | Normative mechanism, status-source authentication, nonresponse distinctions |
| Live-video genesis/resync (`specifications#130` / proposed successor) | `OUT_OF_CURRENT_SCOPE` | Independent profile; no inferred genesis, sentinel predecessor or current blocker |

### Assertion status / authority split (design, not protocol)

Track independently: **(a)** immutable signed C2PA evidence/digest result; **(b)** mutable assertion-status evidence (resolved, not attempted, unreachable or unknown, and only later normative retraction if established); **(c)** independently authorized UU VERIFIED lifecycle and issuer state; **(d)** UU-AAP action authority. No retraction mechanism has yet been adopted by this fixture. A signed C2PA manifest does not establish truth, current status, decision-time availability or permission. Never infer `VALID`, `REVOKED` or `ActionPermit` from the absence of a resolvable status reference.

**Disposition:** research-only PR for human review. No UV-02/UV-03 candidate contract, credential, policy, production issuer, mark or action gate is changed. This PR does not merge itself.
