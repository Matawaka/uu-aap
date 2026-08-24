# AI Gateway live acceptance audit v0.1

This directory is an append-only evidence archive for bounded AI Gateway live acceptance events.

It deliberately keeps two different historical outcomes:

- `acceptance-audit.record.json` — first live event, preserved as `partial_acceptance`;
- `full-acceptance.record.json` — second live event, classified as `full_acceptance` because the typed pre-action bundle existed durably before execution and the exact one-shot action was observed afterward.

The first record MUST NOT be rewritten as successful full acceptance. Its evidentiary gap is part of the provenance history.

## Reusable audit profile

`live-acceptance-audit.schema.json` defines the common record envelope.

`validate-audit.js` validates every `*.record.json` in this directory and applies status-specific rules rather than hard-coding a single PR.

A full acceptance requires, at minimum:

1. exact repository / PR / head / base / merge method;
2. action-specific approval with no generalized or future authority;
3. durable typed pre-action evidence;
4. persisted Core `ActionPermit` and admissible Gateway decision before execution;
5. expected-head fail-closed execution;
6. one-shot permit unconsumed before execution and consumed afterward;
7. verified direct successor and bounded observed effect;
8. Core post-action receipts;
9. Gateway observation whose frontier roles match Core.

## Frontier invariant

The post-action boundary is asymmetric by design:

```text
ActionReceipt frontier = predecessor / ActionPermit frontier
OutcomeReceipt frontier = observed successor frontier
SuccessorStateReceipt frontier = observed successor frontier
```

A later observation MUST NOT relabel the Core `ActionReceipt` onto the successor frontier.

## Evidence semantics

```text
successful actuator call != full protocol acceptance
post-hoc receipt != pre-action permit
partial acceptance != failed experiment
effect observed != causality proven
full acceptance != generalized future authority
```

No audit record grants authority, creates intent, authorizes future actions, proves causality, certifies truth, or establishes liability.
