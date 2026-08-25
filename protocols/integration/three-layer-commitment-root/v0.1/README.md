# Three-Layer Commitment Root v0.1

This profile defines a provider-neutral, non-actuating cryptographic commitment surface for three independently meaningful planes:

1. `knowledge`
2. `authority`
3. `legitimacy`

The profile binds the three plane commitments into one deterministic root while preserving their separation.

## Canonical boundary

```text
Knowledge Commitment + Authority Commitment + Legitimacy Commitment
  -> deterministic root commitment
  -> optional explicit successor root
```

The v0.1 root input is the UTF-8 string:

```text
knowledge:<knowledge-digest>|authority:<authority-digest>|legitimacy:<legitimacy-digest>
```

where every layer digest is lowercase SHA-256 hex. The root is SHA-256 over that exact string.

## Invariants

- `Knowledge State != Authority State != Legitimacy State`
- `Change in One Layer != Silent Rewrite of Other Layers`
- `Root Commitment != Permission to Mutate Any Layer`
- `Successor Root != Erasure of Predecessor Root`
- `Deprecation != Deletion`
- `Absorption != Historical Rewrite`
- `Commitment Integrity != Truth, Legality, Intent, Liability or Universal Legitimacy`

A conforming v0.1 artifact contains exactly the three required layer identities. New planes require a future versioned extension profile and MUST NOT be inserted into this root silently.

## Evolution

A layer may be `active`, `deprecated`, or `absorbed`. Deprecation/absorption is evidence about lifecycle status, not deletion. A non-active layer MUST retain its historical commitment and MUST carry a non-empty transition reason and successor reference.

A successor root, when declared, MUST explicitly bind the predecessor root. The predecessor remains auditable and MUST NOT be rewritten or removed by the successor.

## Non-effects

Validation of this profile does not establish semantic truth, legal validity, human intent, responsibility, liability, universal legitimacy, execution authority, publication status, or permission to mutate any plane.

No KONTUR mutation, actuator invocation, authority transfer, release/tag, permission/protection change, external lookup, canonical-origin mutation, force-push, or history rewrite is performed by this profile.
