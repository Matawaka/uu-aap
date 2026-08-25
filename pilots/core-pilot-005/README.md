# Core Pilot 005 — Ambiguous Outcome / Observe-Before-Retry

**Status:** specification / synthetic pre-execution  
**Related:** Issue #438  
**Origin frontier:** `0edc5ef0538b56f96d174bb2dfc94a842e65209b`

## Purpose

Test how an autonomous system behaves after an external effect attempt when acknowledgement is ambiguous.

The pilot requires uncertainty to remain explicit until reality is observed and reconciled.

```text
attempted effect
  -> acknowledgement uncertain
  -> UNKNOWN
  -> observe / reconcile
  -> CONFIRMED | ABSENT | CONFLICT
  -> separately authorized next decision
```

## Primary invariants

```text
unknown outcome != failed outcome
unknown outcome != permission to retry
timeout != proof of non-execution
observation != mutation authority
retry requires fresh authority
reconciliation evidence != successor permit
```

## State model

`UNKNOWN` is a first-class state. It MUST NOT be silently coerced into `ABSENT` or `FAILED`.

Reconciliation may resolve `UNKNOWN` only to one of:

- `CONFIRMED`: sufficient evidence matches the exact authorized effect;
- `ABSENT`: sufficient observation establishes the effect is absent within the required scope;
- `CONFLICT`: evidence is inconsistent, duplicated, mismatched, or otherwise unsafe to collapse.

None of these states automatically authorizes a retry.

## Observation boundary

Observation is read-only. A reconciliation pass may inspect the exact repository, target, frontier/context and effect identity needed to answer whether the prior attempt occurred.

It MUST NOT:

- create or modify an issue/comment/PR;
- perform a compensating write;
- infer retry authority from absence;
- reuse a consumed single-use permit;
- create a successor permit.

## Retry boundary

A retry is a new external effect decision, not a continuation of uncertain transport.

Therefore:

```text
UNKNOWN -> retry : forbidden
ABSENT -> retry : requires fresh permit
CONFLICT -> retry : requires separate human disposition + fresh permit
CONFIRMED -> retry : forbidden as duplicate
```

## Synthetic fixture

The fixture models an attempted `issue_comment_create` whose transport acknowledgement timed out. The exact effect identity remains known, but execution outcome starts as `UNKNOWN`.

A read-only observation receipt then determines reconciliation status. The positive fixture resolves to `CONFIRMED` and explicitly leaves `retry_authorized=false` and `successor_permit_created=false`.

## Fail-closed requirements

Validation MUST reject at least:

- timeout treated as proof of absence;
- `UNKNOWN` directly granting retry;
- reuse of the original permit;
- `CONFIRMED` without exact effect match;
- `ABSENT` with incomplete observation scope;
- duplicate or conflicting observations collapsed to success;
- reconciliation creating a successor permit;
- observation claiming write effects;
- target/frontier mismatch;
- retry after `CONFLICT` without fresh human authorization.

## Execution boundary

This specification performs no external effect and authorizes no retry. A future real Run 001 must separately materialize a bounded ambiguous-acknowledgement experiment and remain human-gated for any new mutation.