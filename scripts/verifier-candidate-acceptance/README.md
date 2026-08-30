# P1.5 Candidate Acceptance & Materialization Gate v0.1

Issue: #805.

P1.5 is the explicit transition between P1.4 candidate claims and P1.3 verifier claims.

```text
P1.4 candidate set
      |
      v
explicit acceptance event
ACCEPT | REJECT | DEFER
      |
      v
P1.5 materialization receipt
      |
      v
P1.3 explicit verifier input
```

The primary invariants are:

```text
candidate claim != accepted claim
explicit disposition != authority proof
acceptance != semantic strengthening
```

Every candidate in the reviewed P1.4 result must receive exactly one disposition. At most one candidate may be accepted per verifier dimension. A conflicting candidate must remain explicit as `REJECT` or `DEFER`; P1.5 does not rank, average, merge or silently choose between candidates.

## Materialization semantics

For an `ACCEPT` disposition, P1.5 copies the candidate claim without changing:

- `value`;
- `evaluation`;
- `source_layer`;
- `explanation`;
- `does_not_establish`.

The only addition to the accepted claim is an evidence reference to the explicit P1.5 acceptance receipt.

A dimension with no accepted candidate is materialized as `NOT_EVALUATED` with no evidence refs. `REJECT` and `DEFER` therefore do not create a negative or positive semantic claim by themselves.

## Actor reference boundary

`acceptance_event.actor_ref` identifies only the declared reference used in this selection event. P1.5 does not verify that reference and does not infer identity, authority, authorship, responsibility, legal validity or publication/action authority from it.

The acceptance scope is fixed to:

```text
verifier_candidate_materialization
```

It cannot be expanded to publication or action authority by changing the input field.

## Browser-local surface

`/verifier/accept/` reuses the deployed P1.4 adapter-result validator and P1.3 interactive-input validator. The page itself implements only the new acceptance/disposition semantics.

It accepts a local JSON file or pasted JSON, produces the P1.5 acceptance result and exposes the materialized P1.3 input JSON. No server upload, model call, analytics, external script/CDN or network request is used.

## Non-effects

P1.5 does not establish factual truth, identify the acceptance actor, prove acceptor authority, create publication/action authority, assign new responsibility, reinterpret rejected/deferred candidates as false, calculate a scalar score, or emit an umbrella verified verdict.
