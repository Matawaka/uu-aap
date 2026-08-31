# Public Review Disposition Ledger v0.1

This directory is an additive machine-readable index over already accepted Public Review evidence and disposition layers.

It does **not** re-interpret the external submission, create a new disposition, or replace the future editorial issue-disposition table described in `PUBLIC_REVIEW.md`.

## v0.1 scope

The first ledger contains exactly one completed external-source review cycle because that is the only accepted Public Review cycle currently carrying a machine disposition:

```text
Issue #422 comment 5471862585
  -> Core Pilot 002 Run 001
  -> source disposition = accept_for_followup
  -> human design gate #852 = PHASED_B_PLUS_C
  -> Stage B accepted
  -> Stage C / UU-AAP/RA1 accepted
```

The ledger keeps the original machine disposition exact. It does not translate `accept_for_followup` into `accepted_as_truth`, `accepted_normative_change`, or any other editorial category.

`editorial_bucket = null` in v0.1 is intentional. A later editorial disposition table may classify accepted/rejected/deferred/unresolved changes, but that classification must be separately evidenced rather than inferred by this index.

## Files

- `ledger.json` — the bounded index.
- `ledger.schema.json` — closed machine contract.
- `implementation-receipt.json` — exact source/commit/blob bindings and non-effects.
- `validate_ledger.py` — deterministic repository-local validator.
- `test_ledger.py` — hostile mutations against source, disposition, decision and authority boundaries.

## Boundaries

`indexed disposition != new disposition`

`accept_for_followup != accepted as truth`

`follow-up implemented != objection erased`

`repository-owner decision record != verified natural-person identity`

`Stage B evidence binding != authority proof`

`RA1 != certification != liability`

`ledger != release/tag/publication/action authority`

The broader Public Review remains open. Empty review surfaces and observation-only receipts are not disposition entries.