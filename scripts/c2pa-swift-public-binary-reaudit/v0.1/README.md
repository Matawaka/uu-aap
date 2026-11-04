# Swift public-binary preservation re-audit v0.1

A bounded Swift-only slice of #988, additive after merged #1010 at
`260e325619ffd2eed12c43f982c369e6468d5f07` (tree
`e31aa59a911ae9d393721d6c74c7a906ba810865`). This does not close #988 or #1009.

## Exact targets

| Lane | Source revision | Public binary |
|---|---|---|
| release_frontier | 75312abc1d7f2e2be6964a4bdad7c98cdecb36d2 | C2PAC v0.0.13 |
| current_main (observed 2026-09-22; not a moving ref) | 4a698825259ff1142df7de90d62a0d3f2f50b467 | C2PAC v0.0.13 |

The original #988 source target is not silently replaced by the newer main.
Both public packages select archive SHA-256
`631ebb565d7f893dded6d99526067b3d901e209705c80d7be51be111a5aeefec`.
A source-build configuration changing to another c2pa-rs version does not
identify the native version in this published archive.

## Measurement

Each macOS job creates a fresh external SwiftPM consumer, uses a revision
requirement, resolves the PUBLIC binary, checks the archive digest independently,
records the exact source checkout, resolved dependency revisions and binary files,
and builds without patching or rebuilding upstream. Subsequent qualification runs
must keep the frozen Package.resolved and receipt unchanged.

The first two runtime cases use the historical JSON fixture bytes unchanged:
ClaimGeneratorInfo unknown-field decode/inspection/encode and generic
AssertionDefinition external-reference decode/encode. These are **codec** cases.
The old external-reference's 8-byte placeholder hash is not passed off as a valid
native signing fixture.

A separately named native fixture uses a SHA-256 digest of an actual local record,
a synthetic PNG and the pinned upstream public ES256 test key/certificate. It is
encoded through the Swift models, signed with Builder, reopened with Reader.json,
and exercises Reader.crJSON. Raw signed bytes and both Reader outputs are retained.
Only location.hash is normalized between byte-array and base64 rendering; other
payload/extension differences are not erased. Reader signature-validation codes
are recorded separately; preservation is not a signer-trust assertion.

No TSA is configured. The native executable must run under a network-denying
sandbox. Resource fetches are limited to public build dependencies/artifacts;
there are no upstream writes, public log/witness submissions or reviewer contacts.
The key is a public upstream test fixture, never a production signing key.

## Classifications

The runner distinguishes resolution failure, source/binary missing-C-symbol skew,
other build failure, runtime/probe failure, codec failure, native loss, and native
sign/read failure. The strongest positive observation is
`CODEC_AND_NATIVE_SIGN_READ_PRESERVATION_PASS` for the exact supplied cases.
A build without execution cannot yield it. Native errors do not retroactively
negate a separately measured codec pass, nor does a codec pass erase a native error.
A missing-symbol skew classification additionally requires the symbol to occur
in the pinned upstream source and be absent from the resolved public headers.

Read `execution.json`, raw command logs, Package.resolved and probe.json for
execution-specific provenance. The deterministic receipt is a bounded projection;
raw signatures, paths and diagnostics are not overwritten to manufacture parity.

## Gates and non-effects

The first PR bootstrap is draft-only, not final qualification. Before readiness,
inspect both runs, freeze their exact locks/receipts and remove the optional gate.
A later run must reproduce the accepted classification and exact receipt bytes.
Unexpected drift blocks admission; it is not normalized into an expected result.

No Android execution; no source-built-native execution; no iOS qualification;
no cross-SDK compatibility claim; no C2PA conformance, truth, authority, production
trust, external-review or global non-equivocation claim. All predecessor files
remain immutable. #1009 is awaiting voluntary reviewer-owned execution and does
not block this different research task.

`Source preservation != external consumer build != codec round-trip != native sign/read`

`Published binary update != compatibility PASS`
