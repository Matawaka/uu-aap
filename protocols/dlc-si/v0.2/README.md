# DLC-SI v0.2 — continuity-preserving successor

DLC-SI v0.2 is a successor to canonical `protocols/dlc-si/v0.1`.

## Version boundary

v0.1 remains immutable historical semantics. Existing v0.1 contentions and `ContestedActionReceipt` fingerprints MUST remain reproducible without reinterpretation.

v0.2 therefore composes a successor envelope around a v0.1 receipt rather than mutating that receipt.

`v0.1 receipt -> compatibility boundary -> v0.2 successor envelope`

The envelope records the predecessor fingerprint and asserts:

- `predecessor_fingerprint_preserved = true`;
- `v01_semantics_rewritten = false`;
- `external_effect_authority_created = false`.

## New v0.2 semantics

The successor layer may add the already accepted bounded extensions developed after v0.1:

- causal-value preserving decomposition assessment;
- explicit claim relation and incomparability projection;
- reversible/non-conflicting safe-work gate;
- post-execution contest visibility;
- bounded-policy eligibility remains distinct from authority.

No v0.2 extension may reinterpret a historical v0.1 fingerprint as evidence for a different normative result.

## Invariants

- Version Upgrade != Historical Rewrite.
- Compatibility Adapter != Authority Grant.
- v0.1 Fingerprint != v0.2 Fingerprint Replacement.
- Successor Semantics Preserve Predecessor Provenance.
- Execution Outcome != Normative Victory.
- Eligibility != Authority.

This slice creates no production resolver, no external effect authority, and no action permit.
