# KONTUR targeted re-audit — main `cf4abd3932048bbcfa30c157fa887cf434b2be5e`

## A. Observed canonical main SHA/tree/parent

- Remote `refs/heads/main`: `cf4abd3932048bbcfa30c157fa887cf434b2be5e`
- Tree: `3326bec09d53553a87f54d18899719a9a7df8473`
- Direct parent: `c47ce529a773006292e920a7cac537de85222d03`
- Remote commit signature: verified by GitHub, reason `valid`.
- Final remote recheck remained exact; `main` was protected.

## B. Revision gate

PASS.

```text
remote main
== temporary checkout HEAD
== cf4abd3932048bbcfa30c157fa887cf434b2be5e

temporary HEAD^{tree}
== 3326bec09d53553a87f54d18899719a9a7df8473

temporary HEAD^
== c47ce529a773006292e920a7cac537de85222d03
```

The separate temporary Git checkout was clean. The preserved original checkout remained clean and unchanged at historical revision `9894f6be4be663863696c5981d3d68c3c6777525`.

## C. PR #294 remediation surface

PR #294 was a one-commit squash merge over the required parent, with exactly eight changed files:

- `.github/workflows/kontur-human-activation-review-v0.1-validation.yml`
- `audits/kontur/2026-08-24-main-2a0fbd4d/human-activation-review-remediation-v0.1.json`
- `server/kontur/v0.1/HUMAN_ACTIVATION_REVIEW.md`
- `server/kontur/v0.1/human-activation-review.js`
- `server/kontur/v0.1/kontur-human-activation-review-decision.schema.json`
- `server/kontur/v0.1/kontur-human-activation-review-packet.schema.json`
- `server/kontur/v0.1/test-human-activation-review-schema.py`
- `server/kontur/v0.1/test-human-activation-review.js`

No Activation Executor, Activation Preflight, Responsibility Kernel, Durable Ledger, permission-model, or canonical-origin implementation was changed.

The Human Review workflow retains `permissions: contents: read`, builds only a review packet, forbids `buildReviewDecision`, preflight/executor imports, and `git push`, and does not establish execution authority.

## D. HAR-M1 predecessor-contract result

VERIFIED.

All required Project Readiness Checkpoint attacks failed closed:

- Missing/unexpected top-level fields
- Missing, wrong-positive, and unsafe-true claims
- Malformed convergence and current-main bindings
- Wrong project, revision, or status

All required current-main receipt attacks failed closed:

- Missing/unexpected top-level fields
- Missing claims
- Wrong event/ref
- GitHub/checkout SHA mismatch
- Revision drift
- Malformed frontier binding
- Unexpected workflow-context fields
- Unsafe activation claim

Decision-time reconstruction also rejected packet tampering, checkpoint substitution, verification substitution, and predecessor-digest substitution.

The checkpoint binding is compared against the supplied receipt by exact artifact type, receipt ID, and RFC8785/JCS SHA-256 digest.

## E. Historical inconsistent-join attack result

`REJECTED_FAIL_CLOSED`.

Both reproduced variants were rejected:

```text
checkpoint binds receipt A + supplied receipt B with different ref
-> artifact_ref mismatch

checkpoint binds receipt A + supplied same-ID but different-content receipt B
-> digest mismatch
```

The historical `ACCEPTED_INCONSISTENT_JOIN` behavior is no longer reproducible.

## F. HAR-M2 schema-coupling result

VERIFIED.

Independent schema-only validation produced:

- 3/3 valid approve/defer/reject objects accepted.
- 13/13 required contradictory objects rejected.

This included all specified declaration, token, safe-effect, positive-claim, and approval-confirmation contradictions.

The exact-main GitHub Actions run also executed `jsonschema==4.25.1`, accepted the three valid outcomes, and rejected its committed negative schema vectors.

## G. HAR-M3 freshness/expiry/revalidation result

The freshness, expiry, time-ordering, and reconstruction portions are VERIFIED:

- TTL is exactly `86,400,000` ms, or 24 hours.
- Missing or changed observed-current revision is rejected.
- `reviewed_at < prepared_at` is rejected.
- `observed_at < reviewed_at` is rejected.
- `reviewed_at > expires_at` is rejected.
- `observed_at > expires_at` is rejected.
- Malformed timestamps are rejected.
- Decision-time predecessors must reconstruct the identical packet digest.

HAR-M3 as a whole cannot close because of the replay-history defect in section H.

## H. Replay-guard result

PARTIAL — MEDIUM FINDING REMAINS.

Correctly rejected:

- Omitted `priorDecisions`
- `priorDecisionsComplete != true`
- Reused nonce
- Different nonce for an already-decided packet
- Changed current main

Failed required vector:

```text
malformed prior decision entry
-> ACCEPTED
```

`assertPriorDecisionEntry()` checks only artifact type/version, packet-binding artifact type/digest shape, and nonce prefix. A synthetic entry missing `decision_id`, timestamps, decision outcome, confirmations, claims, `review_packet_binding.artifact_ref`, and other required decision fields was accepted.

The implementation correctly describes its protection as local complete-history protection, not universal distributed nonce prevention. That distinction remains intact, but malformed supplied history is not fail-closed.

## I. Direct tests executed

- JavaScript syntax checks: PASS, exit `0`.
- Python schema-test AST parse: PASS, exit `0`.
- Packet and decision schema JSON parsing: PASS, exit `0`.
- `node test-human-activation-review.js`: PASS, exit `0`.
- Independent schema probe: 16/16 checks passed—3 valid and 13 contradictory.
- Adversarial HAR-M1/M3 probe: 38 attacks rejected; 1 malformed-history attack accepted; exit `2`.
- Audit revision gate: PASS, exit `0`.
- Project Readiness Checkpoint: PASS, exit `0`.
- Current-main frontier verification: PASS, exit `0`.
- Responsibility Kernel: PASS, exit `0`, including 20 negative vectors and test-only state ending `retired`.
- Local Python schema suite: exit `1`, `ModuleNotFoundError: jsonschema`. This was an environment dependency gap; the exact-main Actions execution passed with pinned `jsonschema==4.25.1`.
- Local Readiness Aggregator: exit `1`; external published-authority check was blocked by `EACCES`.
- Local Preflight, Executor TEST-ONLY, and Durable Ledger suites: exit `1` at the same upstream network-bound authority prerequisite. No test was weakened or bypassed.
- Their exact-main GitHub Actions executions completed successfully.

## J. Exact-main workflow evidence used

All runs were `push` events on `main`, attempt 1, with exact `head_sha = cf4abd3932048bbcfa30c157fa887cf434b2be5e`.

| Workflow | Run | Result |
| --- | ---: | --- |
| Human Activation Review v0.1 | 32688340556 | success |
| Independent Audit Hardening v0.1 | 32688340597 | success |
| Project Readiness Checkpoint v0.1 | 32688340566 | success |
| KONTUR Readiness Aggregator | 32688340611 | success |
| Activation Preflight | 32688340573 | success |
| Activation Executor TEST-ONLY | 32688340577 | success |
| Responsibility Kernel | 32688340598 | success |
| Durable Responsibility Ledger | 32688340621 | success |

Human Review logs explicitly report schema coupling PASS and “no human decision or activation emitted.” Exact-SHA artifacts were enumerated and remained unexpired.

`EVIDENCE_ACCESS_GAP`: artifact metadata and job logs were accessible, but inner archive bytes were not independently downloaded through the available read-only interface.

## K. Remaining Low findings

- The previous generic binding-type finding is `CLOSED_AS_PART_OF_REMEDIATION`; packet and decision schemas now use exact artifact-type constants.
- `reviewer_ref` remains declared identity rather than cryptographically authenticated identity.
- Relative timestamp ordering is enforced by the builder but is not independently expressible/enforced by the JSON Schema.
- Relevant evidence artifacts retain a 30-day lifetime, limiting long-term independent availability.

## L. Remaining Medium findings

One:

- HAR-M3 replay-history validation accepts materially incomplete/malformed prior-decision entries instead of validating the complete `KONTURHumanActivationReviewDecision v0.1` contract fail-closed.

Minimal correction: fully validate every prior entry’s exact decision contract before using its nonce or packet binding, and add the reproduced malformed-entry vector as a permanent negative test.

## M. Remaining High/Critical findings

None found within the targeted re-audit scope.

## N. Current KONTUR state

KONTUR remains inactive.

- No real Human Activation Review Decision
- No activation intent
- No live preflight
- No execute command
- No live executor invocation
- No real responsibility state
- No responsibility acceptance
- No execution-authority grant
- No permission expansion or bypass
- No repository or canonical-origin mutation

All generated objects and state-machine transitions were synthetic test-only data isolated outside the repository.

## O. Historical audit/remediation provenance status

The historical record remains unchanged:

- Audited frontier: `2a0fbd4d67e9db4913658da825336d2c4a8c2888`
- Conclusion: `READY_FOR_MORE_TESTING`
- Full-report Git-blob SHA-256: `d25dff2ce7ace5936976f453123528dbc11de22f0e7e6ea0ad5d84e2659f74e7`

The remediation record remains correctly pre-re-audit:

- `status = candidate_for_targeted_reaudit`
- `medium_findings_closed = false`
- `targeted_reaudit_still_required = true`
- `formal_human_activation_review_allowed = false`

PR #294 did not rewrite the historical audit record or full report.

## P. Whether the three recorded Medium findings may now be closed

No.

HAR-M1 and HAR-M2 may be closed. HAR-M3 remains open because malformed prior-decision history entries are accepted.

## Q. Whether Formal Human Activation Review may now proceed

No. The targeted remediation requires one further fail-closed replay-history correction and regression test before Formal Human Activation Review.

## R. Final bounded conclusion

`HAR_REMEDIATION_NEEDS_MORE_TESTING`
