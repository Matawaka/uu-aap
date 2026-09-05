# Temporal distinct-checkpoint witness activity v0.1

This additive successor to merged #947 asks a narrower temporal question: can the exact pinned witness set be cryptographically observed on a **distinct successor checkpoint** that is independently verified append-only from the frozen #947 checkpoint?

A repeated fetch of the same checkpoint is deliberately non-qualifying. A later/larger checkpoint is also non-qualifying until its log signature, exact witness cosignatures, and the accepted #934 consistency verifier all succeed.

The classifier and repository CI have deliberately different responsibilities. The classifier keeps non-strong evidence fail-closed: `NO_DISTINCT_SUCCESSOR_CHECKPOINT_OBSERVED` exits non-zero just like partial or failed evidence. The CI wrapper may nevertheless accept that one exact verdict as a **valid pending observation**, because no external state transition occurred. It does not accept external-unavailable, quorum-only, authentication failure, consistency failure, or insufficient witness activity as a healthy observation. This separates implementation correctness from a future external event without promoting waiting into evidence.

Consistency proofs use the log's published `GET /consistency?old=&new=` surface and are requested only after a checkpoint with `tree_size > 7838` is observed.

The first corrected GREEN qualification observed the real successor state `7838 -> 7840`, verified the 10-node append-only consistency proof through the accepted #934 primitive, and cryptographically verified all 7 exact pinned witness cosignatures on the successor state. Its exact artifact receipt is frozen as `qualification-receipt.json` with Git blob `18342a27d884918bd99eca3d8018c273bf4444c0`, file SHA-256 `667049e37b5290df4f8cec3ec9bd35e73a7260b88d5e9db6e5a7b1040199a85b`, and receipt fingerprint `bb7209f25d1516e4ea7da48c468519c64a95ccd3d5fdc854dc09bc3a46e0eb4b`.

Subsequent qualification runs validate the frozen receipt exactly and require live **strong semantic parity**. They do not require the live successor checkpoint bytes to remain exactly at 7840: a later state may qualify if it remains a cryptographically authenticated append-only successor of 7838 with the same exact 7 pinned witness keys verified. This preserves the evidence class without rewriting the historical frozen receipt.

Positive evidence is limited to repeated activity across at least two cryptographically ordered checkpoint states. It does **not** establish continuous liveness, continuous availability, trusted universal time, witness/operator identity or independence, global non-equivocation, complete history, C2PA completeness, truth, authority, canonicality, maliciousness, or remediation.

The workflow is read-only (`contents: read`) and performs bounded HTTPS GETs only. `Trigger != Authorization` remains unchanged.
