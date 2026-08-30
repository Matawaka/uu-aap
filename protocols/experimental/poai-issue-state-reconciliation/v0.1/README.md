# Legacy PoAI issue-state reconciliation v0.1

This slice provides a dedicated, fail-closed authorization surface for closing exactly four historical PoAI discovery issues after their previously unresolved successor families were resolved by the append-only reconciliation overlay v0.2.

Candidates:

- `#84` — `PERSISTENT_KEY_CONTINUITY`;
- `#88` — `IDENTITY_EVIDENCE`;
- `#93` — `SCOPED_AUTHORITY_EVIDENCE`;
- `#104` — `MATERIALIZATION_AND_POLICY_RELATIVE_CANONICALITY`.

The historical v0.1 map remains unchanged and still records these families as `NEEDS_SUCCESSOR`. The v0.2 overlay remains unchanged and resolves those exact families as `SUPERSEDED_BY`. This v0.1 issue-state layer does not reinterpret either source; it only determines whether GitHub issue-state closure is now evidence-backed.

Closure is authorized only after the reconciliation PR is merged with green required checks. Until then, all four issues remain open.

`Resolved successor != historical rewrite`

`Issue closure != semantic deletion`

`Closed discovery issue != PoAI/V conformance`

The validator byte-binds the v0.1 source map and v0.2 resolution overlay, verifies the exact candidate set, rechecks each family relation and successor path, and rejects any stronger identity, authority, canonicality, release, execution, external-effect, or unlisted-issue closure claim.

No external observation, transport, live effect, KONTUR activation, ActionPermit, release, certification or universal canonicality is created by this slice.
