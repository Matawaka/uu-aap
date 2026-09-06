# C2PA witness receipt binding v0.1

This package is an additive successor to accepted #951 and reuses the standard C2PA `c2pa.external-reference` mechanism already accepted through #780/#786.

It binds the **exact frozen bytes** of:

`scripts/witness-rgdd-attributed-project-history/v0.1/qualification-receipt.json`

from canonical post-#951 commit `ca1b8d2c229861f9bbcfe61041fcf31434b7c8e9`.

The source receipt is not rewritten. In particular its historical field:

`claims.c2pa_manifest_inclusion_proven = false`

remains false. The new fact belongs only to this successor layer:

`ACCEPTED_WITNESS_ATTRIBUTION_RECEIPT_HASH_BOUND_BY_STANDARD_C2PA_EXTERNAL_REFERENCE`

The composition is:

```text
accepted frozen #951 receipt bytes
        -> exact Git blob / byte count / SHA-256 / receipt fingerprint
        -> standard c2pa.external-reference
        -> signed fixture asset
        -> live C2PA validation
        -> immutable commit-pinned URL resolution
        -> exact byte + digest match
        -> separate successor binding receipt
```

Mandatory distinctions:

```text
C2PA external-reference binding != truth
C2PA external-reference binding != authority
C2PA external-reference binding != legal identity
C2PA external-reference binding != operator control
C2PA external-reference binding != witness independence
C2PA external-reference binding != complete history
C2PA external-reference binding != all manifests submitted
C2PA external-reference binding != C2PA ecosystem completeness
C2PA signer != witness operator
C2PA signer != UU-AAP authority
successor binding != historical backfill
```

No custom C2PA assertion namespace is registered. The external receipt remains arbitrary JSON referenced by URL/hash/size/media type. Workflow permissions are read-only; no upstream mutation, release/tag, Core/SPEC/Registry change, automatic remediation, or merge authority is created here.
