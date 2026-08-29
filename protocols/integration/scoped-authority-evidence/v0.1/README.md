# Scoped Authority Evidence v0.1

Read-only evidence profile for bounded authority claims with explicit issuer entitlement, subject, action scope, target scope, validity window, delegation boundary and revocation/dispute evidence.

Result vocabulary:

- `SUPPORTED`
- `DISPUTED`
- `EXPIRED`
- `REVOKED`
- `INSUFFICIENT_EVIDENCE`
- `OUT_OF_SCOPE`

`SUPPORTED` means only that the supplied issuer-entitlement evidence supports the bounded authority claim for the declared scope at the declared evaluation time. It does not create execution authority, materialization authority, ActionPermit, external-effect authority, legal status or universal trust.

Delegation is fail-closed: a child scope may not widen the parent's action or target scope.

`Identity Evidence != Authority Evidence`

`Authority Claim != Verified Authority`

`Valid Signature != Issuer Entitlement`

`Scope Match != Execution Authority`

`Authority Evidence != Materialization Authority`

`Supported Evidence != ActionPermit`

No permission change, runtime activation, materialization, release, external effect or authority transfer is performed.