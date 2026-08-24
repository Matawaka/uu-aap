# First live AI Gateway acceptance audit

This directory records the post-action audit of the first bounded live merge performed for Issue #332.

The actuator/frontier boundary succeeded:

- one exact repository and PR;
- exact head and base SHA;
- `squash` only;
- explicit action-specific human approval;
- GitHub `expected_head_sha` fail-closed guard;
- observed successor and marker;
- no second actuator mutation.

The experiment is **not** classified as full protocol acceptance.

The reason is evidentiary, not actuator failure: before the write, a reconstructible typed
`GatewayDecisionReceipt` and Core `ActionPermit` were not durably materialized. Creating them
after the merge would misrepresent post-action reconstruction as pre-action authorization.

Therefore:

`successful actuator call != full protocol acceptance`

`post-hoc receipt != pre-action permit`

`partial acceptance != failed experiment`

Issue #339 tracks the repeat experiment with durable pre-action receipts.
