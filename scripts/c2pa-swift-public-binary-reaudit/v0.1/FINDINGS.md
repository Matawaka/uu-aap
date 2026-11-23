# Executed findings and qualification provenance

## First native execution (before freezing)

Run `35703765253`, head `a3c861ecd994e1e9d05da2afb688e4cff434784e`.

- current_main artifact `10683996020`: SHA-256 `1591179b1998ab136ded50267f979fa8b590e2e845923e323eff6dbc694fcc9d`.
- release_frontier artifact `10683961017`: SHA-256 `bfc6733a8231b9ec6f87c0407c290552a0301794ff51802aa9abe1ce926f4982`.

Both archives were downloaded and their digests checked. Both public consumers
resolved, built, signed a new local PNG, and called Reader.json and Reader.crJSON.
The SDK reports claimSignature.validated plus signingCredential.untrusted, as
expected for the public test credentials. This is not signer identity/trust proof.
Actual runner: macOS 15.7.9 arm64, Xcode 16.4, Apple Swift 6.1.2.

## Observed distinction, not an irreversible-loss claim

Both historical Codable cases PASS with their unchanged fixture bytes. The
extension survives Swift decode/encode and is present unchanged in the exact
JSON supplied to the native Builder.

The full unknown extension in the active native Reader JSON differs at:

```
/nested/sequence
input:  [1,2,3]  (JSON array)
output: "AQID"   (JSON string)
```

The same active manifest in Reader.crJSON contains the original array, and the
full tested unknown extension compares equal there. Merely parsing crJSON would
not prove this: inspect_reader.py independently compares raw outputs, binds the
same active manifest label, and compares the exact extension to the pre-native
input. Tests reject borrowing a preserved field from a different manifest or
blaming native code for loss that already occurred before its input.

The generic external-reference payload compares equal through Reader.json after
only the declared location.hash byte-rendering normalization. Full crJSON
external-reference payload preservation is NOT assessed here; raw CBOR rendering
also exposes padding fields, which are not silently stripped into a broader PASS.

The initial `receipt.json` contains `NATIVE_SIGN_READ_LOSSY`, meaning the tested
**Reader.json route**, not destruction of the signed asset's data. It is retained
unchanged per execution. The separate qualification-receipt.json states the more
precise, raw-evidence-derived result:

`READER_JSON_EXTENSION_TYPE_DRIFT_CRJSON_PRESERVED`

This is neither global compatibility PASS nor proof of irreversible data loss.
The original missing-symbol build blocker is not reproduced on these exact
v0.0.13 consumers. Older v0.0.12 receipts remain correct historical observations.

Both native Reader outputs report `org.contentauth.c2pa_rs: 0.90.0`; this is
recorded as SDK-reported metadata, not inferred from the newer source-build
configuration or promoted to independently audited native build provenance.

## Freeze procedure

The two frozen qualification receipts were first locally re-derived from the
checked downloaded macOS artifacts, using qualify.py and inspect_reader.py.
They are NOT represented as having been emitted by the older bootstrap workflow.
The completed PR must then reproduce them through the full newer workflow:
public resolution, cold build, fresh native sign/read, raw Reader-path inspection,
and unconditional byte equality with the frozen receipts and dependency locks.
There is no remaining optional/draft bootstrap gate.

Raw signatures, signed PNG hashes, manifest identifiers and command diagnostics
are per-run evidence; they are not rewritten to make them deterministic. The
frozen projection binds the separate phase receipt and resolved lock, preserves
the platform/toolchain scope and withholds every broader claim.

## Remaining work

#988 remains open for Android and any separately selected source-built lane.
#1009 remains open for voluntary actual external review. This is internal UU-AAP
measurement, not reviewer-owned external validation. No outreach, upstream
patch, release, public-log mutation, authority expansion or merge is authorized.
