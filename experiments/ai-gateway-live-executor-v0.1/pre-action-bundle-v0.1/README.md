# AI Gateway live pre-action bundle v0.1

**Status:** preparatory / non-actuating  
**Issue:** #339  
**Base frontier:** `c60dba1a0d954c20ade8d547b82c1cc7bd8c497f`

## Purpose

Define and validate the durable typed evidence package that must exist **before** the second bounded live AI Gateway actuator event.

This profile repairs the evidentiary gap found by the first live acceptance audit without rewriting that history.

```text
post-hoc receipt != pre-action permit
successful actuator call != full protocol acceptance
reconstructible approval != reconstructible ActionPermit
prepared profile != live authorization
synthetic fixture != observed pre-action evidence
```

## Required live bundle

A live `observed_pre_action` bundle must bind one exact frontier and one exact GitHub merge target and embed:

1. Core `StateReceipt`;
2. Core `IntentReceipt`;
3. Core `AuthorityReceipt` or `ResponsibilityReceipt`;
4. Core `CoordinationReceipt` carrying the action-specific human approval evidence;
5. Core `ActionPermit`;
6. AI Gateway `GatewayRequest`;
7. admissible `GatewayDecisionReceipt`;
8. the SHA-256 of the exact human approval text;
9. exact repository / PR / head SHA / base SHA / merge method;
10. expiry and one-shot semantics.

The `ActionPermit` must already exist before an admissible gateway decision. The gateway never creates the permit.

## Durable evidence rule

For the second live experiment, the final `observed_pre_action` bundle must be durably persisted in repository/issue evidence **before the separately authorized actuator call**.

The conformance fixture in this directory is deliberately `synthetic_conformance`; it cannot authorize execution and must never be counted as observed live evidence.

## One-shot rule

A live permit is valid only for the exact target encoded in the bundle, before expiry, while `consumed = false`. Any target/frontier drift invalidates it. A successor action requires a new bundle and a new human approval.

## Non-effects

This preparatory profile does not:

- call an actuator;
- merge a PR;
- arm a live executor;
- create general authority;
- authorize future actions;
- create truth, causality, legality or liability;
- modify Core or AI Gateway semantics.

No auto-merge.
