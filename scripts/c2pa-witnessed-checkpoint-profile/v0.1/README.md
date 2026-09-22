# C2PA witnessed-checkpoint assertion profile v0.1

Tracking issue: #1007. Exact predecessor: merged #1006 at
`f9a051b28b54088b202051f135fd77d084fb7326`.

This package tests a **non-circular** composition between a C2PA Update Manifest
and witnessed transparency evidence. It does not define a C2PA-standard
assertion namespace.

## Construction

A fixed known-good C2PA asset (`C.jpg` from
`contentauth/c2pa-rs@c2patool-v0.27.16`) is used as the predecessor.

A probe Update Manifest is first produced with the accepted c2patool frontier.
The probe exposes the exact `parentOf` ingredient HashedURI references to the
predecessor C2PA Manifest and Claim Signature. Those two predecessor references
become the subject of the transparency commitment.

The profile then builds:

```text
predecessor activeManifest HashedURI
+ predecessor claimSignature HashedURI
+ experimental witness-policy digest
        ↓ domain-separated canonical commitment
two-leaf RFC6962 fixture
        ↓
log-signed checkpoint
        ↓
2-of-3 Ed25519 witness cosignatures
        ↓
closed witnessed-checkpoint evidence bundle
        ↓ SHA-256
standard c2pa.external-reference
        ↓
successor C2PA Update Manifest
```

The final successor is independently read back. Its own `parentOf` ingredient
must carry the same predecessor HashedURI references used by the bundle.

## Why an Update Manifest

Embedding proof of a final claim digest inside that same final claim creates a
self-reference problem: adding the proof changes the claim. This v0.1 avoids
that by proving only bounded evidence about the **referenced predecessor**.

```text
Witnessed Predecessor Evidence != Self-Witnessing Successor Claim
```

## Experimental witness policy

The policy object in this package is UU-AAP-owned experimental evidence. It is
not a cryptovalid feature and is not a C2PA-standard policy object. The bundle
hash binds the exact policy bytes, but relying-party trust remains external.

```text
Policy Binding != Policy Trust
Witness Quorum != Witness Independence
```

## Completeness and time boundaries

```text
Witnessed Submitted View != Submission Completeness
Manifest Never Submitted -> No Transparency Evidence
Witness Policy != Producer Submission Policy
Witness Timestamp != Trusted Universal Time
No Single TSA Dependency != No Time-Trust Assumptions
```

## Strongest allowed result

`PREDECESSOR_C2PA_EVIDENCE_WITNESSED_AND_BOUND_BY_SUCCESSOR_UPDATE_MANIFEST`

This result is limited to the exact fixed predecessor, exact subject
commitment, local deterministic transparency fixture, exact experimental
policy, standard external-reference binding and successfully validated
successor Update Manifest.

It is not C2PA specification conformance, global non-equivocation, completeness,
truth, authority, identity, canonicality or remediation.
