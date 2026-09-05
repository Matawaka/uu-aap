# Witness Operator Attribution Topology v0.1

Tracking issue: #941.

This additive probe starts from exact merged #940 and binds seven exact #934 witness pins to six **public operator labels** without promoting those labels into legal identity, control, or independence.

The first live qualification attempt on head `855e79d8...` was intentionally preserved fail-closed. It exposed two distinct modeling facts: root-URL canonicalization for Remora, and a Geomys separation between the Witness Network attribution page and the page that publishes verifier key material. The current model therefore keeps these surfaces explicit instead of weakening the evidence gate.

## Topology

For each public operator label the profile now binds:

`Witness Network row → attribution URL → key-material URL → exact pinned vkey(s)`

Five operators use the same attribution/key-material surface. Geomys is deliberately different:

`Geomys → https://geomys.org/witness/navigli → https://navigli.sunlight.geomys.org/ → exact Navigli vkey`

The operator attribution page must itself link to the separate key-material homepage. This is checked in addition to the Witness Network row relation and the exact key observation.

Expected bounded result:

```text
7 exact pins
→ 6 key-material surfaces
→ 6 attribution surfaces
→ 6 public operator labels
```

TrustFabric remains one public label for two exact pins.

## Strongest permitted verdict

`ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED`

Mandatory distinctions remain:

```text
public label != legal identity
public label != cryptographic identity binding
operator-published URL relation != legal control
network-curated attribution != operator self-attestation
6 labels != 6 independent organizations
operator attribution != current key activity
operator attribution != non-equivocation
operator attribution != C2PA completeness
provenance/attribution != truth
provenance/attribution != authority
Trigger != Authorization
```

The workflow is `contents: read` and HTTPS GET only. It never calls witness `POST /add-checkpoint` and performs no witness/log mutation, key rotation, OTS/Bitcoin action, upstream write, Core/SPEC/Registry mutation, release/tag, automatic action, or remediation.
