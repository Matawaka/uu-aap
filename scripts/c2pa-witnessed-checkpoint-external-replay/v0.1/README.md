# Portable external replay v0.1 (#1009)

This is a **UU-AAP-owned, separately implemented verifier and review package**,
not an external review. Its strongest preparation result is
`PORTABLE_EXTERNAL_REPLAY_PACKAGE_READY`. No reviewer has been contacted by this
package. A reviewer-owned run, code revision and vector digest must be recorded
separately before claiming external reproduction or considering a spec proposal.

## Run the exact frozen vector offline

Requires Node.js 22 or newer. No npm, Python, private repository, CI artifact,
network access, private signing key, old verifier, or old PASS receipt is needed.
Copy this directory anywhere and run:

```sh
node verify.mjs
node --test test.mjs
```

The verifier uses Node's standard Ed25519 implementation. It independently
recomputes the domain-separated commitment, RFC6962 two-leaf inclusion, log
signature, timestamped witness signatures, distinct-name quorum, policy binding
and active-parent/external-reference relationships. It does not import #1008's
Python verifier or use the predecessor receipt's verdict as an oracle.

`bundle.json` is copied **byte-for-byte** from the first frozen #1008 run:

```
accepted commit: 06b6d9b194938a1d6de21d9958b67f264ea47c25
source run:      35693812515
source artifact: 10679103065
bundle bytes:   4789
bundle SHA-256:  56fb5783904e8b75c1ddd7ed5d13acba111aaf671b8ec2612cec85d3d86e672e
semantic hash:  39ad8a08ac1637d5afebdccf444aee39eb65ccfea18139a903b03375f9234480
```

`inputs.json` supplies explicit public-key/policy configuration and a documented
projection of the historical C2PA reports. Its provenance records original file
sizes/digests. `pins.json` binds the distributed inputs; it is an integrity
manifest, **not a self-authenticating trust root**. Obtain the package revision
and digest through a channel the reviewer trusts. The exact historical receipt
is included for reference, but the verifier does not read it.

## Two distinct replay claims

**Offline:** `OFFLINE_CRYPTO_AND_REPORTED_C2PA_BINDING_REPLAY_PASS` verifies actual
checkpoint/cosignature bytes plus the relationships in the frozen report
projection. The historical archive did **not** include the signed successor
JPEG or its raw COSE/JUMBF payload. Comparing historical JSON reports cannot
revalidate the original C2PA signature, asset hash binding or signing identity.
The offline verifier therefore sets `historical_c2pa_asset_revalidated: false`.
It is not a general C2PA validator and does not infer success from an SDK status
bit in the historical receipt.

**Fresh live replay:** requires Linux x86-64, Python 3.12+, Node.js 22+, network
for two public hash-pinned downloads, and an unused loopback port 8765:

```sh
python live-replay.py --output-dir /tmp/c2pa-review-new-run
```

This creates a **new** local successor using the pinned c2patool 0.27.16 archive,
the original public predecessor fixture and the unchanged bundle. The SDK reads
and validates the new signed asset; the standalone verifier then checks the
active-manifest references and exact bundle binding in those fresh reports.
The output includes the new signed JPEG, reports, executable/asset hashes and a
run-specific receipt. It is not the original historical successor byte stream.
Random C2PA instance identifiers/signatures need not reproduce across runs.
No checkpoint is submitted to a public log or witness. The HTTP server serves
only the fixed bundle on 127.0.0.1. A busy port or unavailable pinned dependency
blocks execution; no fallback implementation or public service is substituted.

`FRESH_LOCAL_SUCCESSOR_C2PA_AND_INDEPENDENT_BINDING_REPLAY_PASS` is still an
internal execution when run by UU-AAP. Even a clean CI result does not establish
`EXTERNAL_REVIEWER_REPRODUCED_BOUNDED_PROFILE_SEMANTICS`.

## Canonical commitment and crypto scope

Let `C` be sorted-key, compact UTF-8 JSON for the original subject core:
`active_manifest`, `claim_signature`, `hash_algorithm`, `witness_policy_sha256`.
For this closed ASCII/integer subset (not a general JCS implementation):

```
commitment = SHA256(UTF8(domain) || 0x00 || C)
leaf       = SHA256(0x00 || commitment)
root       = SHA256(0x01 || supplied_sibling || leaf)  # index 1, size 2
```

The full commitment preimage is emitted as hex for independent implementations.
The signed checkpoint includes origin, size and root; Ed25519 log signatures
use signed-note type 0x01. Witness type 0x04 signatures cover
`cosignature/v1\ntime <timestamp>\n` followed by the exact checkpoint body.
The declared vkey identifier is checked against its public-key material. The
log key is configured separately from the candidate note. Unknown/duplicate
signatures are rejected by this **closed vector profile**; generic C2SP signed
note clients normally ignore unknown keys. This stricter profile behavior is
not a claim of full signed-note implementation conformance.

Sources for the independently implemented byte rules:

- C2SP signed-note v1.0.0: https://c2sp.org/signed-note@v1.0.0
- C2SP tlog-cosignature v1.0.1: https://c2sp.org/tlog-cosignature@v1.0.1
- RFC6962 section 2.1: https://www.rfc-editor.org/rfc/rfc6962#section-2.1
- C2PA 2.4: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html

## Deliberate limits and the quorum counterexample

The three witness keys are deterministic local test identities controlled by
one harness. Signatures alone do not reproduce stateful witness consistency
checks or demonstrate independent operators. The fixture timestamps
1700000101/1700000102 are **synthetic**, not real evidence that this C2PA
predecessor existed in 2023. No real-world time bound is asserted.

For a fixed uniform q-of-M policy with at most f equivocating witnesses, honest
intersection requires `2q - M > f`, not merely a nonempty intersection. For
2-of-3, `{A,B}` and `{B,C}` intersect at B. If B equivocates, both sets can contain
an honest witness (A and C) while the intersection contains none. The tests
exercise this counterexample. This does not rewrite #1008's bounded receipt;
it prevents any stronger claim from being inferred from majority arithmetic.

```
policy hash binding != relying-party policy trust
quorum intersection != honest intersection
witness signatures != state-transition replay
reported C2PA binding != original asset revalidation
witnessed predecessor != witnessed successor
inclusion/non-equivocation evidence != submission completeness
synthetic witness timestamps != real-world time bounds
internal separate implementation != independent external reviewer
```

The 83 positive/hostile tests include parser ambiguity, key substitution,
observed timestamp drift, unknown/duplicate witnesses, non-active ancestor
substitution, inclusion corruption, exact external binding, same-claim
self-reference, and prohibited claims. Mutation tests recompute outer hashes
where appropriate, so they exercise semantics rather than failing only on a
frozen file checksum.

No Core/SPEC/registry change, release, automatic outreach or merge is authorized.
