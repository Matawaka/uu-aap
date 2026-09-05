# Temporal distinct-checkpoint witness activity v0.1

This additive successor to merged #947 asks a narrower temporal question: can the exact pinned witness set be cryptographically observed on a **distinct successor checkpoint** that is independently verified append-only from the frozen #947 checkpoint?

A repeated fetch of the same checkpoint is deliberately non-qualifying. A later/larger checkpoint is also non-qualifying until its log signature, exact witness cosignatures, and the accepted #934 consistency verifier all succeed.

The classifier and the repository CI have deliberately different responsibilities. The classifier keeps non-strong evidence fail-closed: `NO_DISTINCT_SUCCESSOR_CHECKPOINT_OBSERVED` exits non-zero just like partial or failed evidence. The CI wrapper may nevertheless accept that one exact verdict as a **valid pending observation**, because no external state transition occurred. It does not accept external-unavailable, quorum-only, authentication failure, consistency failure, or insufficient witness activity as a healthy observation. This separates implementation correctness from a future external event without promoting waiting into evidence.

Consistency proofs use the log's published `GET /consistency?old=&new=` surface. The proof is requested only after a checkpoint with `tree_size > 7838` is observed.

Positive evidence is limited to repeated activity across two cryptographically ordered checkpoint states. It does **not** establish continuous liveness, continuous availability, trusted universal time, witness/operator identity or independence, global non-equivocation, complete history, C2PA completeness, truth, authority, canonicality, maliciousness, or remediation.

The workflow is read-only (`contents: read`) and performs bounded HTTPS GETs only. `Trigger != Authorization` remains unchanged.
