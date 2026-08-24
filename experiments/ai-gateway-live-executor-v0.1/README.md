# AI Gateway live-executor acceptance experiment v0.1

Tracked by Issue #332. This directory prepares the **arming boundary** only.

The experiment is deliberately split:

1. preparation / conformance;
2. arming a single exact target;
3. separately authorized live execution;
4. post-action observation and Core successor receipts.

This PR implements step 1 only.

## Gate invariant

`preparation != arming != execution != observation`

A candidate can be considered armable only when all of the following are exact and explicit:

- repository;
- PR number;
- expected head SHA;
- expected base SHA;
- merge method;
- admissible GatewayDecisionReceipt hash;
- Core ActionPermit hash;
- action-specific approval hash;
- `live_execution_requested = true`;
- `ci_execution = false`;
- no credential material in the artifact.

Even an `armable` result performs no network request and no GitHub mutation.

CI MUST use a fixture where live execution is not armed.

Actual execution remains a future, separately authorized event under #332.
