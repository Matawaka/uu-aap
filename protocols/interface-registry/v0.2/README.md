# Reusable Protocol Interface Registry v0.2 delta

v0.2 is an additive successor over the exact v0.1 registry blob. It does not rewrite v0.1.

It adds three experimental provider-neutral entries: `EventResponsiveDormancy`, `RERC`, and
`RecoverableStateInfrastructureCandidate`. The candidate depends on the two accepted independent components.

`Registry Delta != Historical Registry Rewrite`

`Experimental Registry Entry != Published Release`

`Formal Reusable-Infrastructure Candidate != Stable Core`

The validator runs the v0.1 validator unchanged, verifies the exact v0.1 blob, rejects duplicate/unresolved
interfaces and typed-contract drift, and builds only an in-memory or temporary effective view.
