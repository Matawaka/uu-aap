# Witness Key Provenance Same-Run All-Seven v0.1

Tracking issue: #939.

This additive successor starts from merged #938 at exact main `0f064ffc60c15ce98125b657f2f32eba09e0d933`.

Merged #938 established a bounded **temporal composition**:

```text
5 frozen #936 operator-source observations
+ 2 live direct operator observations
= 7/7 exact #934 pinned witness keys
```

It deliberately kept `all_seven_currently_reobserved_in_one_run = false`.

This package asks the next narrower question: can all seven exact #934-pinned witness vkeys be observed from the bounded source set fetched within one workflow run?

## Exact predecessor binding

The package binds merged #938 without rewriting it:

- #938 profile blob: `c2fc9dae0db399e9d2c14c4010d0f2b7d93d9bb0`;
- #938 qualification receipt blob: `3d02d7c5b95be3fd813faa4f1118da0ecb6dabe7`;
- #938 frozen receipt fingerprint: `0e46babcd7db57080b282d5216f50f4b9e4955eeed0cf53a14e8c77294ca142a`;
- exact #934 seven-pin profile blob: `4f1c10b9551661b6236febe3d744e4255065ce52`.

CI reruns #938's hostile suite and validates its frozen qualification receipt before the new same-run layer executes.

## Closed same-run source set

One bounded run fetches exactly six URLs for seven pins:

- `https://witness.stagemole.eu/about` — stagemole;
- `https://transparency.dev/witnesses` — little-garden and ring-any-bells;
- `https://remora.n621.de/` — remora;
- `https://raw.githubusercontent.com/geomys/magnolia/0545421c001b16c0fb328cd9254010c46fa424a6/cmd/hetrix/geomys.go` — Navigli operator-owned repository material;
- `https://www.rgdd.se/poc-witness/about` — rgdd;
- `https://witness1.smartit.nu/witness1/about.txt` — SmartIT.

The Geomys body is additionally required to hash as Git blob `95a3e95134487229343bb6197f6fa1723cfa20d7`.

The TrustFabric URL intentionally appears in two source records because that one page carries two exact pinned vkeys. The verifier requires seven distinct pins but only six distinct matched URLs.

## Admission boundary

Strong admission requires:

```text
matched_witness_key_count == 7
unique_source_url_count == 6
observed_witness_vkeys == exact #934 seven-pin set
all_seven_reobserved_in_one_bounded_run == true
```

The strongest permitted verdict is:

`ALL_SEVEN_PINNED_WITNESS_KEYS_SOURCE_MATERIAL_REOBSERVED_IN_ONE_BOUNDED_RUN_IDENTITY_INDEPENDENCE_AND_CURRENT_ACTIVITY_NOT_ESTABLISHED`

This wording is intentionally about **source material**. A commit-pinned operator-owned repository source can re-publish exact key material without proving that the corresponding key is currently active at a live service.

## Mandatory non-claims

```text
7/7 same-run source-material observation != 7 currently active witness keys
7/7 exact key bytes != witness identity
7 exact pins != 7 independent operators
6 URLs/hosts != organizational independence
same-run provenance != checkpoint non-equivocation
witness provenance != producer/global non-equivocation
same-run provenance != complete history
same-run provenance != C2PA manifest inclusion/completeness
external publication != trusted universal time
provenance != truth
provenance != authority
Trigger != Authorization
```

`all_seven_currently_active_proven`, witness/legal identity, independence, non-equivocation, C2PA completeness, trusted time, truth, authority, canonicality, maliciousness and remediation claims remain false.

## Effects

Read-only HTTPS GET plus local verification only. No POST, witness/log mutation, key rotation, OpenTimestamps submission, Bitcoin transaction, upstream comment, Core/SPEC/Registry mutation, release/tag, automatic action or remediation.
