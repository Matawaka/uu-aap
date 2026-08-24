# UU-AAP Continuity Custodian Handoff v0.1

**Status:** experimental prepare-and-review continuity layer  
**Scope:** prepare a hash-bound backup handoff envelope for a human custodian and assess a separately supplied human custody receipt.

This layer exists to distribute continuity without distributing repository authority.

## Core boundary

```text
custodian != successor
holding a copy != repository authority
holding a copy != canonical succession
custody receipt != physical possession proven
custody receipt != rescue authorization
custody receipt != failover authorization
custody receipt != KONTUR activation
```

A custodian may preserve bytes and evidence while having no right to reinterpret canon, mutate the canonical repository, activate KONTUR, recover owner credentials, or initiate succession.

## Handoff envelope

`custodian_handoff.py envelope` creates a deterministic envelope bound to:

- exact source `main` SHA;
- exact source tree SHA;
- one abstract copy slot;
- one abstract custodian-role ID;
- bundle SHA-256;
- continuity capture-manifest SHA-256;
- metadata-manifest SHA-256;
- verification-evidence SHA-256.

The envelope contains digests and instructions only. It MUST NOT contain:

- passwords;
- PATs or API tokens;
- recovery codes;
- private SSH or signing keys;
- TOTP seeds;
- passkeys;
- session cookies;
- account recovery material;
- encryption keys.

The generated envelope requires encrypted storage and marks whether the selected slot must be offline.

## Human custody receipt

A human custodian may later create a separate receipt conforming to `custody-receipt.schema.json`.

The receipt binds to the exact envelope digest and records only opaque domain identifiers plus an evidence SHA-256. It is an attestation suitable for review, not a machine-verifiable proof of physical custody.

`custodian_handoff.py assess-receipt` checks:

- envelope digest binding;
- exact copy-slot and custodian-role binding;
- copy bytes declared verified;
- human attestation required;
- offline confirmation when the envelope requires offline custody;
- all authority/rescue/failover/canonical/KONTUR claims remain false.

The strongest positive result is `custody_receipt_review_eligible`.

## Why no credentials are transferred

Continuity of evidence must not collapse into continuity of a single identity.

```text
copy transfer != account sharing
copy custody != shared identity
credential sharing != redundancy
```

If an operator later chooses to create a separate account or collaborator relationship, that is a different provider-level action governed by its own authorization and must not be smuggled through this custody protocol.

## Local-only behavior

The tool performs no network access, Git operations, subprocess execution, provider writes, account changes, secret retrieval, CHSP action, Rescue action, or KONTUR call.

The envelope is written to stdout only. Receipt assessment reads local JSON paths supplied by the operator.

## Example

Prepare an envelope:

```bash
python3 protection/continuity/custody/v0.1/custodian_handoff.py envelope \
  --main-sha <40-hex> \
  --tree-sha <40-hex> \
  --copy-slot sealed-offline-copy \
  --custodian-role custodian-role-b \
  --bundle-sha256 <64-hex> \
  --capture-manifest-sha256 <64-hex> \
  --metadata-manifest-sha256 <64-hex> \
  --verification-evidence-sha256 <64-hex>
```

A separate human-created custody receipt can then be assessed against the saved envelope. Neither operation sends anything to the custodian automatically.
