# KONTUR HAR-M3 targeted re-audit — main `7a085ffa8c724777ef2c0b38e60350bdfb8c11cf`

Date: 2026-08-24

## A. Exact main SHA/tree/parent

- Remote `refs/heads/main`: `7a085ffa8c724777ef2c0b38e60350bdfb8c11cf`
- Tree: `c8637976f45ce4677b08afaff67a0800f4074768`
- Direct parent: `ab0be5e4993189340053f2b42f3623788b6a9485`
- GitHub commit signature: verified, reason `valid`
- Final remote recheck remained exact; `main` was protected.

## B. Revision gate

PASS.

```text
remote main
== temporary HEAD
== 7a085ffa8c724777ef2c0b38e60350bdfb8c11cf

HEAD^{tree}
== c8637976f45ce4677b08afaff67a0800f4074768

HEAD^
== ab0be5e4993189340053f2b42f3623788b6a9485
```

The separate temporary checkout was clean before and after testing. No readiness was inherited from older evidence.

## C. PR #300 remediation surface

The squash merge over the canonical direct parent changed exactly four files:

- `server/kontur/v0.1/human-activation-review.js`
- `server/kontur/v0.1/test-human-activation-review.js`
- `server/kontur/v0.1/HAR_M3_REPLAY_HISTORY_HARDENING.md`
- `audits/kontur/2026-08-24-main-cf4abd4d/har-m3-replay-history-remediation-v0.1.json`

No Activation Executor, Activation Preflight, Responsibility Kernel, Durable Ledger, permission-model, workflow, or canonical-origin implementation changed.

## D. Historical malformed-entry reproduction result

`REJECTED_FAIL_CLOSED`.

The reproduced partial entry containing only type/version, partial packet digest, and partial nonce was rejected before its nonce or digest participated in replay comparison:

```text
Human Activation Review: prior decision: exact contract keys required
```

The historical `materially incomplete prior entry -> ACCEPTED` defect is fixed.

## E. Complete prior-decision validation result

VERIFIED for all required structural and semantic vectors.

All 42 Section 4 vectors rejected, including missing/malformed/unexpected fields, schema/type/ID/timestamp failures, incomplete or malformed packet binding, missing reviewer, unsupported outcome, confirmation-set failures, outcome/declaration/token/effect/claim contradictions, non-explicit or malformed declaration, incomplete review context and replay guard, invalid timestamp ordering or expiry, incomplete claims, and each of the 14 activation/responsibility/authority/permission/ownership/legal/truth/consensus false claims independently changed to `true`.

Complete validation occurs before replay nonce/digest comparison.

## F. Valid-prior-history acceptance result

VERIFIED.

Complete valid synthetic prior decisions were accepted for:

- `approve_intent_preparation`
- `defer`
- `reject`

The fix therefore does not indiscriminately reject all historical entries.

## G. Replay nonce/packet result

VERIFIED.

```text
same nonce
-> rejected: decision nonce replay detected

same packet + different nonce
-> rejected: review packet already has a recorded decision

different valid packet + different nonce
-> accepted and proceeded through normal decision validation
```

Omitted `priorDecisions` and `priorDecisionsComplete=false` were rejected.

The claim remains bounded to complete supplied local history and does not claim global history completeness or distributed nonce uniqueness.

## H. Decision-ID binding result

INCOMPLETE — FAILING REQUIRED VECTOR.

Rejected with the old `decision_id` preserved:

- `reviewer_ref` tamper
- coherent outcome tamper
- nonce tamper
- `reviewed_at` tamper
- observed-revision tamper
- packet-digest tamper

Accepted unexpectedly:

```text
syntactically valid review_packet_binding.artifact_ref changed
+ old packet digest retained
+ old decision_id retained
-> ACCEPTED
```

The deterministic ID seed includes `review_packet_binding.digest.value` but omits `review_packet_binding.artifact_ref`. Consequently, the prior decision can name a different packet while retaining its previous ID and digest.

This is not an identity-authentication finding; `reviewer_ref` remains declared identity only.

## I. Direct tests

- `node --check human-activation-review.js`: PASS, exit `0`
- `node --check test-human-activation-review.js`: PASS, exit `0`
- `node test-human-activation-review.js`: PASS, exit `0`
- Python AST and JSON-schema parsing: PASS, exit `0`
- Full adversarial HAR-M3 probe: 53 expected rejections passed, 4 valid cases accepted, 1 required packet-reference tamper accepted; exit `2`
- Python schema suite locally: exit `1`, `ModuleNotFoundError: jsonschema`

The missing local Python dependency is classified as `ENVIRONMENT_LIMITATION`. The exact-main Human Review workflow installed the pinned validator and completed its schema suite successfully.

No test was weakened or skipped.

## J. Exact-main workflow evidence

Every run was a successful attempt-1 `push` run on `main` with exact `head_sha = 7a085ffa8c724777ef2c0b38e60350bdfb8c11cf`.

- Human Activation Review v0.1 — run `32692271321` — success
- KONTUR Readiness Aggregator — run `32692271320` — success
- Activation Preflight — run `32692271322` — success
- Activation Executor TEST-ONLY — run `32692271298` — success
- Responsibility Kernel — run `32692271301` — success
- Durable Responsibility Ledger — run `32692271363` — success
- Project Readiness Checkpoint — run `32692271309` — success
- Independent Audit Hardening — run `32692271343` — success

Human Review logs state that no human decision or activation was emitted and that the workflow remained read-only.

Exact-SHA artifact metadata was accessible and unexpired.

`EVIDENCE_ACCESS_GAP`: inner archive bytes were not independently downloaded through the available read-only interface.

Workflow success did not cover the newly reproduced packet-`artifact_ref` decision-ID vector.

## K. Remaining Low findings

- `reviewer_ref` is declared identity and is not cryptographically authenticated.
- Relative timestamp ordering is builder-enforced but not independently schema-enforced.
- Thirty-day evidence retention limits long-term independent availability.

## L. Remaining Medium findings

One Medium finding remains within HAR-M3:

- Prior decision-ID binding includes the packet digest but not the packet `artifact_ref`; a syntactically valid reference substitution is accepted while preserving the old decision ID.

Minimal remediation: include the complete typed packet binding—or its canonical digest—in decision-ID derivation and add independent artifact-reference and digest tamper regressions.

## M. Remaining High/Critical findings

None found within the targeted scope.

## N. KONTUR current state

KONTUR remains inactive.

- No real Human Activation Review Decision
- No activation intent
- No live preflight
- No execute command
- No live executor
- No real responsibility state
- No responsibility acceptance
- No execution-authority grant
- No permission expansion or bypass
- No GitHub or canonical-origin mutation

All constructed decisions existed only as isolated synthetic test data.

## O. Historical provenance status

The source targeted audit remains unchanged:

- Frontier: `cf4abd3932048bbcfa30c157fa887cf434b2be5e`
- HAR-M1: `closed_verified`
- HAR-M2: `closed_verified`
- HAR-M3: `open_partial`, Medium
- Conclusion: `HAR_REMEDIATION_NEEDS_MORE_TESTING`
- Report SHA-256: `a2eb9bb1cb9462d82ad842a410eb29162aa1b754a74eb23f0231f7699276e7da`

The PR #300 remediation artifact remains correctly pre-closure:

- `finding_closed = false`
- `targeted_reaudit_still_required = true`
- `formal_human_activation_review_allowed = false`

Neither historical artifact was rewritten.

## P. Whether HAR-M3 may now be closed

No. The historical malformed-entry defect is fixed, but packet-reference decision-ID binding remains incomplete.

## Q. Whether all three original Medium findings are now closed

No.

HAR-M1 and HAR-M2 remain closed. HAR-M3 remains open.

## R. Whether Formal Human Activation Review may proceed

No. A further bounded correction and regression for packet `artifact_ref` decision-ID binding is required first.

## S. Final bounded conclusion

`HAR_M3_REPLAY_HISTORY_NEEDS_MORE_TESTING`

Therefore:

```text
historical malformed prior-entry defect fixed
+ complete prior-decision validation verified
+ replay nonce/packet semantics verified
+ packet artifact_ref not bound into prior decision_id
!= HAR-M3 closed
!= all Medium findings closed
!= Formal Human Activation Review allowed
!= activation approval
!= activation intent
!= KONTUR activation
```
