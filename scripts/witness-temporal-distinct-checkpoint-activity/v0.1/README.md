# Temporal distinct-checkpoint witness activity v0.1

This additive successor to merged #947 asks a narrower temporal question: can the exact pinned witness set be cryptographically observed on a **distinct successor checkpoint** that is independently verified append-only from the frozen #947 checkpoint?

A repeated fetch of the same checkpoint is deliberately non-qualifying. A later/larger checkpoint is also non-qualifying until its log signature, exact witness cosignatures, and the accepted #934 consistency verifier all succeed.

Positive evidence is limited to repeated activity across two cryptographically ordered checkpoint states. It does **not** establish continuous liveness, continuous availability, trusted universal time, witness/operator identity or independence, global non-equivocation, complete history, C2PA completeness, truth, authority, canonicality, maliciousness, or remediation.

The workflow is read-only (`contents: read`) and performs bounded HTTPS GETs only. `Trigger != Authorization` remains unchanged.
