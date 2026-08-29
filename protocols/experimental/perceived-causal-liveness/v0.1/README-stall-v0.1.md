# Perceived Causal Liveness — Stall Detector v0.1

This slice binds meaningful-progress age to explicit liveness transitions and authority suspension.

`RUNNING -> SUSPECTED_STALL -> TIMED_OUT_CLOSED`

Rules:
- suspected stall suspends external-effect authority immediately;
- heartbeat does not count as meaningful progress;
- meaningful progress can restore `RUNNING` liveness but not authority;
- authority restoration requires fresh revalidation;
- timeout closes the run irreversibly;
- closed runs cannot emit authoritative late effects.

This layer changes no production timeout values and executes no external action.
