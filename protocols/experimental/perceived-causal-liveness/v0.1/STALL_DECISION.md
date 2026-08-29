# Selected Stall Authority Policy

Decision: Variant 1.

On entry to `SUSPECTED_STALL`, external-effect authority is suspended immediately.

A later meaningful progress receipt may restore liveness state to `RUNNING`, but authority remains suspended until a fresh revalidation succeeds against the current target/frontier and permit state.

This decision is normative for Perceived Causal Liveness v0.1 and is not an authorization to modify production timeout values or execute external effects.
