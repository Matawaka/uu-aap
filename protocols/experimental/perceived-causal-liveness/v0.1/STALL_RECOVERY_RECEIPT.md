# Stall Recovery Receipt Boundary v0.1

A run recovering from `SUSPECTED_STALL` emits two logically separate facts:

1. liveness recovery: meaningful progress was observed and the run may return to `RUNNING`;
2. authority recovery: external-effect authority remains suspended until fresh revalidation succeeds.

The recovery boundary therefore preserves:

`Meaningful Progress -> RUNNING`

but not:

`Meaningful Progress -> External Effect Authority`

Fresh revalidation must bind the current target/frontier, prior authority validity, permit freshness, and unconsumed state.

A failed revalidation leaves the run computationally live but externally non-actuating.
