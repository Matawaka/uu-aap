# Component Manifest v0.1 architecture boundary

This tooling slice sits beside, not inside, the reusable semantic Core.

```text
Products / Applications
        ↓ consume
Profiles / Transport / Adapters
        ↓ implement and compose
Reusable Runtime / Tooling
        ↓ describe and validate
Core + Registry + Negotiation + Attestation + Evolution
```

The direction above is descriptive and compositional, not an authority direction.

## Existing metadata sources preserved

- Protocol Registry remains the exact immutable release resolver.
- Interface Registry remains the reusable interface index.
- Product Contract remains the domain product boundary.
- Stack Evolution remains the protocol successor/compatibility policy.
- Capability Attestation remains reproducible implementation conformance evidence.

Component Manifest references or complements these surfaces. It does not absorb their semantics.

## First extraction rule

A reusable tooling abstraction should be extracted only from behavior already repeated across at least two independent existing components. Component Manifest satisfies that rule by describing both Core and AI Transport without requiring either one to change.

## Future dependency graph rule

A successor Impact Graph must distinguish at least:

- runtime imports;
- schema dependencies;
- evidence carriage;
- conformance dependencies;
- transport composition;
- optional adapters;
- test-only dependencies.

It must not infer authority, responsibility, compatibility or runtime activation from graph reachability.
