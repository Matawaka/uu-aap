# Core Pilot 004 Run 001 — Post-Run Assessment

## Result

Run 001 passed for one bounded external GitHub effect.

Observed path:

`Human approval → precondition revalidation → exact issue_comment_create → observed matching result → permit consumed`

The executed effect was one comment on Issue #435, comment id `5406621775`, under refreshed permit `core-pilot-004-run-001-comment-001-r1`.

## Directly evidenced

This run directly evidenced that, for this specific operation:

- an initially stale permit was not executed after its bound frontier changed;
- a refreshed permit could be bound to the exact current frontier;
- explicit human approval was required after refresh;
- the target issue remained open and had no prior effect before execution;
- exactly one authorized `issue_comment_create` effect was performed;
- the observed target and body matched the authorized effect;
- no second effect was performed;
- successful execution did not create successor authority.

## Important fail-closed observation

The first authorization attempt did not execute because the permit was bound to the pre-merge frontier while `main` had advanced after materialization.

That is positive evidence for:

`human approval + stale precondition != executable authority`

The refreshed permit was approved only after rebinding to the unchanged current frontier.

## Preserved invariants

`authorized effect == executed effect`

`single-use permit != reusable authority`

`successful effect != successor permit`

`permit possession != permission to change target/body/scope`

`stale precondition != executable permit`

`permit consumed != authority retained`

## What this run does NOT prove

Run 001 does not prove universal safety of GitHub mutation, arbitrary payload execution, concurrent effects, retries under network ambiguity, multi-resource transactions, rollback safety, hostile-agent resistance, or permission-system correctness.

It also does not prove that every future agent implementation will honor the same permit semantics.

## New gap exposed

The next useful boundary is **effect ambiguity / uncertain acknowledgement**: what happens if an external write may have succeeded but the executor does not receive a reliable success response?

A robust successor pilot should prevent blind retry from turning one single-use permit into two effects. The core question becomes:

`unknown outcome != permission to retry`

A future pilot should require observe-before-retry reconciliation and idempotency/effect identity evidence before any successor action.

## Successor authority

This assessment creates no successor permit and authorizes no further external effect.

`successful run != successor permit`
