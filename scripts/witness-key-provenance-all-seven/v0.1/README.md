# All-Seven Witness Key Operator-Source Provenance v0.1

Tracking issue: #937.

This additive successor starts from merged #936 at exact main:

`becaff7af61d76ee4bdae09e2aa60aae559da417`

Merged #936 froze exact operator-source observations for five of the seven witness vkeys pinned by #934. This package does not rewrite or reinterpret that receipt. It asks only whether the two pins missing from #936 can be observed from their direct operator pages and composed with the frozen five-key evidence.

## Exact predecessor

- #936 profile blob: `23184a0049c069deb7c07d0572c4b45dcd1b9e99`
- #936 qualification receipt blob: `8f0c7f0b08e77dfc7ebcd6a615a8bb3b9223fee3`
- #936 qualification fingerprint: `2a533ce2b03ba170bfb8c6e33cced5994acc61f18fed6b94ee42931307f615d8`
- predecessor observed keys: `5`

The exact seven-pin set is independently rebound to merged #934 profile blob `4f1c10b9551661b6236febe3d744e4255065ce52`.

## New direct operator sources

- `https://www.rgdd.se/poc-witness/about`
- `https://witness1.smartit.nu/witness1/about.txt`

The Witness Network table is useful discovery/context but is not accepted as the executable key-provenance source. CI fetches only the two direct pages above and requires the exact full #934 vkey bytes.

## Temporal composition

The strong case is intentionally:

```text
frozen #936 exact observed pins = 5
live exact new operator-page pins = 2
distinct composed exact #934 pins = 7
```

It is **not** described as seven simultaneous live re-fetches. The strongest permitted verdict is:

`ALL_SEVEN_PINNED_WITNESS_KEYS_OPERATOR_SOURCE_OBSERVED_ACROSS_BOUND_PREDECESSOR_AND_SUCCESSOR_EVIDENCE_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED`

A later layer may choose to re-fetch all seven sources in one run if simultaneous freshness becomes materially useful.

## Non-claims

Always false include witness identity, operator independence, all-witness independence, all-seven-currently-reobserved-in-one-run, second Bitcoin anchor, complete history, producer/global non-equivocation, all-manifest completeness, selective-submission absence, C2PA manifest inclusion, trusted time, truth, authority, canonicality, maliciousness and automatic remediation.

In particular:

```text
7/7 key provenance observations != 7 independent witnesses
7/7 key provenance observations != producer/global non-equivocation
7/7 key provenance observations != C2PA completeness
Provenance != truth
Provenance != authority
Trigger != Authorization
```

## Effects

Read-only HTTPS GET only. No POST, witness/log mutation, key rotation, OpenTimestamps submission, Bitcoin transaction, upstream comment, Core/SPEC/Registry mutation, release/tag, automatic action or remediation.
