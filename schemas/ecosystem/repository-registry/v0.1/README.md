# Matawaka Repository & Disclosure Registry v0.1

This additive ecosystem layer separates **where artifacts live** from **what they mean** and from **whether they should be public**.

```text
Repository != Product
Repository Visibility != Disclosure Authorization
Private Repository Existence != Authorization to Publish Its Name
Open Source != Zero Monetization
Development Priority != Monetization Priority
Public Disclosure != Runtime Deployment
```

The first public snapshot intentionally contains only repositories that are already public and whose current frontiers are observable. It does **not** enumerate private repository names, counts, content or disclosure recommendations.

## Files

- `repository-disclosure-registry.schema.json` — machine-readable public-safe registry contract.
- `examples/public-repository-disclosure-registry.json` — exact observed public repository snapshot.
- `validate_registry.py` — schema, frontier, disclosure, monetization-separation and fail-closed validation.

## Coverage boundary

The public snapshot fixes:

```text
public_inventory_observed = true
private_inventory_complete = false
private_repository_details_disclosed = false
full_ecosystem_disclosure_decision_complete = false
connector_private_scope_complete = false
```

Therefore the snapshot is useful for portfolio decisions without pretending that the private portfolio has been audited.

## Priority semantics

Three priority dimensions are deliberately independent:

- `strategic_priority` — importance to the ecosystem architecture;
- `development_wip_priority` — where scarce implementation attention should go next;
- `monetization_priority` — where near-term commercial validation is most valuable.

For example, UU-AAP remains `P0` strategically while MarketCloser is `P0` for current product WIP and direct monetization validation.

## Monetization boundary

Public/open components are not treated as economically valueless. The registry distinguishes protocol access from commercial surfaces such as managed hosting, integrations, conformance tooling, verification, support, training and bounded paid pilots.

No price, deployment, sale or license change is authorized by the registry.

## Private disclosure gate

A private project may become a candidate for full public disclosure only after connector-verified inventory and the explicit checks listed in the snapshot. Until then the public default is:

```text
KEEP_PRIVATE_AND_UNASSESSED
```

The next safe action is `EXPAND_GITHUB_REPOSITORY_SCOPE_AND_RESCAN_PRIVATE_PORTFOLIO`.
