# C2PA signed external-reference hash matrix — v0.3

**Status: experimental / non-normative / CI-verifiable.** This package uses actual locally signed C2PA PNG assets produced by the pinned public `c2patool` release. The production issuer, trust roots, content assertions, UV-02, and UU-AAP decision authority are **unchanged**.

## Basis and purpose

Previous merged research [#1017](https://github.com/Matawaka/uu-aap/pull/1017) and [#1018](https://github.com/Matawaka/uu-aap/pull/1018) showed the exact-byte external-reference representation algorithm and a single SHA-256 signing/reading fixture. They did **not** prove that the public SDK can sign, re-read, and preserve actual C2PA external-reference assertions using SHA-384 and SHA-512.

This v0.3 experiment isolates that gap. Official published [C2PA 2.5](https://spec.c2pa.org/specifications/specifications/2.5/specs/C2PA_Specification.html) §12.1 lists `sha256`, `sha384`, and `sha512` as allowed hash algorithms. Its §14.10.4.2.2 defines external-reference validation and §14.10.5 clarifies retrieval representation; nevertheless, **an algorithm supported by the specification is not necessarily implemented by a specific SDK**.

Exact public SDK pin: [contentauth/c2patool v0.28.4](https://github.com/contentauth/c2patool/releases/tag/v0.28.4), released 2026-10-26, Linux `x86_64-unknown-linux-gnu.tar.gz` archive SHA-256 `097e9efaff765baf7738a40c640012419cad419ce3e1aa36cf68e0576309c971`. Its bundled development signer is **FOR TESTING ONLY**.

## Experiment

Use one committed synthetic record `scripts/c2pa-external-reference/fixtures/external-uu-aap-record.json`. `build-signed-fixture.js` recomputes its exact-byte SHA-256, SHA-384, or SHA-512 and emits a standard `c2pa.external-reference` gathered-assertion manifest definition with the same fixed URL and `application/json` byte size. For each algorithm, CI independently:

1. Downloads and verifies the exact official binary archive, checks `--version`, constructs a deterministic PNG source.
2. Signs a *distinct* C2PA PNG via the real `c2patool v0.28.4` SDK CLI and reads the emitted manifest back.
3. Calls `assertLiveC2paReport` (existing semantic-boundary gate) to refuse invalid claim reports; it tolerates only explicitly declared development-signer trust limitations.
4. Checks that exactly one standard `c2pa.external-reference` in the active manifest preserves the declared algorithm, URL, media type, exact-byte length and algorithm-specific digest bytes; no invented UU-AAP assertion label.
5. Appends a byte to a *copy* of the external record and confirms the same signed asset's reference check fails closed for that algorithm.
6. Applies five deliberately hostile **read-report** mutations, separately for each algorithm: `alg` substitution, hash-byte tampering, external URL drift, forbidden asserted JUMBF label, and an explicit `Invalid` validation state. The same verifier MUST reject all of them. These synthetic report mutations are not independent C2PA claim signatures or substitute interoperability vectors.

```text
                            pinned c2patool 0.28.4
synthetic JSON bytes    ->  signed PNG (SHA-256) -> readback -> match + tamper rejection
same synthetic JSON     ->  signed PNG (SHA-384) -> readback -> match + tamper rejection
same synthetic JSON     ->  signed PNG (SHA-512) -> readback -> match + tamper rejection
```

**Note:** the negative cases modify either the *external resource* or the JSON report returned by the reader, not the signed C2PA asset itself. The five hostile JSON report mutations are a verifier robustness check and do not demonstrate that C2PA verification rejects signature-level tampering. No network URI is dereferenced. The reference URL is reserved for example data and does not grant an internet fetch, trust, permission or current lifecycle status.

## Acceptance / limitations

* Exact byte digest matching and a passing public SDK status establishes a **path-specific, signed-fixture readback result** for the pinned version and algorithm only. A failure for one algorithm is an actual compatibility signal and MUST NOT be hidden as a passing skipped lane.
* It does not prove the signed claim asserts C2PA **2.5** semantics or that this SDK passes full C2PA 2.5 conformance, HTTP retrieval, Content-Encoding, arbitrary labels, unknown-field preservation, cross-SDK (Swift/Android), or real trust-root validation.
* Signer cryptographic integrity does not imply truth, human review, UU-AAP authorship, approval, responsible actor, publication authority, PoAI decision-time availability, current assertion status, or ActionPermit.
* C2PA #130 live-video genesis and #140 assertion retraction are unrelated open documentary dependencies and not implemented here.
* `CURRENT_BINDING_REAUDIT_REQUIRED` is retained for any general 2.5 compatibility claim. `NO_CURRENT_SCOPE_IMPACT` for current 2.4-pinned #999/#1003 and normative gate.

Run the matrix via GitHub Actions workflow `.github/workflows/c2pa-v25-signed-algorithm-matrix-v0.3.yml` on the proposed PR. **Do not claim PASS before reading the exact workflow run and job steps.** No SDK binary or generated signed assets are committed to the repo.
