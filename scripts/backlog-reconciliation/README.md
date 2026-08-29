# Backlog Reconciliation

Backlog reconciliation separates historical implementation completion from present roadmap relevance.

## Independent axes

- `implementation_state`: `COMPLETED | PARTIAL | STILL_OPEN | INSUFFICIENT_EVIDENCE`
- `roadmap_state`: `CURRENT | SUPERSEDED | STILL_OPEN | INSUFFICIENT_EVIDENCE`

A historically completed issue may therefore be `implementation_state=COMPLETED` and `roadmap_state=SUPERSEDED` without contradiction.

`roadmap_state` is not inferred from implementation completion. It requires explicit roadmap evidence such as `roadmap_current=true`, `explicitly_still_open=true`, or `superseded_by`.

Classification remains read-only: it does not close issues and never creates automatic closure authority.
