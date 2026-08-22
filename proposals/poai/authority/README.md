# PoAI Authority Root Machine Layer v0.1

**Status:** experimental implementation of [`../AUTHORITY_ROOTS.md`](../AUTHORITY_ROOTS.md).  
**Conformance effect:** none; this layer does not establish PoAI/V, legal identity, legal authority, or universal legitimacy.

This directory contains the first machine-testable implementation of the PoAI Authority Root / Issuer Entitlement Boundary.

## Core model

```text
root evidence
  -> Authority Root
  -> policy Root Acceptance Rule
  -> issuer entitlement
  -> Authority Grant provenance
  -> scoped authority verification result
  -> Materialization Policy consumer
```

The stopping point is explicit:

`authority chain -> declared root -> policy acceptance`

A verifier can prove consistency from an accepted root downward. It does not prove that every institution or person ought to accept that root.

## Artifacts

- `PoAIAuthorityRoot` — a versioned, scope-bounded governance anchor;
- `PoAIAuthorityGrant` — an append-only constrained grant from an entitled issuer to a subject;
- `PoAIAuthorityVerificationResult` — the machine result of evaluating one authority provenance path under one exact policy.

All three remain outside the Genesis PoAI decision-record schema.

## First pilot mode

The first positive vector uses:

`root_mode = self_governed_resource`

for:

`github:Matawaka/uu-aap`

The root may be accepted only by a policy that explicitly recognizes the exact root, mode, evidence type, target and governance scope.

For this experimental mode:

```text
repository-control evidence + exact policy acceptance
  -> repository-scoped governance anchor
```

but NOT:

```text
legal identity
universal ownership
external institutional authority
truth certification
PoAI/V
```

The machine fixture uses synthetic observed repository-control evidence. Live repository publication is tracked separately in Issue #110.

## Authority graph

Simple delegation is a chain. The verifier treats the structure as an acyclic provenance graph so later `all_of`, `any_of`, and `threshold`/quorum roots can be added without a scalar trust score.

A child grant MUST NOT broaden its parent in:

- action scope;
- target;
- governance scope;
- validity interval;
- delegation depth;
- policy-control privileges.

`non_delegable` is terminal.

## Policy-control separation

The current vocabulary keeps these scopes distinct:

```text
poai.successor.materialization.execute
poai.materialization.policy.control
```

Possession of the first does not imply the second.

## Machine files

- `schema/authority-root.schema.json`
- `schema/authority-grant.schema.json`
- `schema/authority-verification-result.schema.json`
- `tools/authority-core.js`
- `examples/self-governed-uu-aap.authority-root.json`
- `test-authority.js`

## Negative vectors

The test suite rejects at least:

1. `unaccepted_root`;
2. `root_scope_escape`;
3. `authority_cycle`;
4. `child_scope_inflation`;
5. `child_target_inflation`;
6. `child_validity_inflation`;
7. `non_delegable_parent_redelegated`;
8. `execute_scope_used_as_policy_control`;
9. `root_replacement_without_previous_controller_authorization`;
10. `repository_root_claims_external_target`;
11. `account_control_claimed_as_legal_identity`;
12. `authority_verification_claims_truth`.

## Materialization integration

The Materialization positive vector consumes a `PoAIAuthorityVerificationResult`. It no longer hard-codes issuer entitlement or materialization authority as synthetic booleans.

A successful authority result may establish only the declared action/target/time/policy scope. It MUST keep stronger claims false, including legal identity, universal authority, truth, causality, responsibility, moral correctness, legal effect and PoAI/V.
