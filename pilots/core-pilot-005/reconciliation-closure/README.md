# Core Pilot 005 — Reconciliation Closure for ABSENT and CONFLICT

**Status:** synthetic / non-executing extension  
**Related:** Issue #443  
**Origin frontier:** `098baf9ec9ed8a2db5aec52281c880505182415b`

Run 001 established the observed branch:

`UNKNOWN → CONFIRMED → STOP`

This extension closes the remaining reconciliation branches without performing another external effect.

## Run 002 — ABSENT

A reconciliation may classify an attempted effect as `ABSENT` only after sufficient read-only observation over the exact authorized target/frontier context finds no matching effect evidence.

The classification does **not** authorize a retry.

```text
UNKNOWN
  → sufficient read-only observation
  → ABSENT
  → human decision required
  → STOP
```

Required invariants:

`ABSENT != retry authority`

`absence evidence != permission to repeat`

`observation != mutation authority`

`original permit consumed != reusable permit`

`fresh authority required for any later effect`

## Run 003 — CONFLICT

A reconciliation classifies as `CONFLICT` when the observation set contains materially inconsistent, duplicate, or non-matching evidence such that the system cannot safely collapse the state to `CONFIRMED` or `ABSENT`.

Conflict evidence must remain plural and contestable. The system must not automatically select a preferred observation or infer a new external action.

```text
UNKNOWN
  → read-only observation
  → conflicting evidence
  → CONFLICT
  → human disposition required
  → STOP
```

Required invariants:

`CONFLICT != retry authority`

`conflict evidence != permission to choose a winner`

`reconciliation != successor permit`

`human disposition != automatic external mutation`

## Shared boundary

All reconciliation is read-only. Neither `ABSENT` nor `CONFLICT` can create mutation authority, retry authority, a successor permit, or reuse the original single-use permit.

The synthetic fixtures intentionally model these two branches only. Merging them does not authorize any real GitHub write, retry, KONTUR effect, push/merge, release/tag, permission/secret/protection change, or successor action.
