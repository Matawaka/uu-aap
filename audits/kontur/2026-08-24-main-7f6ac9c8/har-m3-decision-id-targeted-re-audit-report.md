# KONTUR HAR-M3 decision-ID targeted re-audit — main `7f6ac9c8ac007c14449c31383f5e70d5a4093881`

Date: 2026-08-24

## A. Exact canonical main SHA/tree/parent

- Remote `refs/heads/main`: `7f6ac9c8ac007c14449c31383f5e70d5a4093881`
- Tree: `7e9630b271578cb061cd88b28fea37ca3741ca38`
- Direct parent: `db689e49e2bc4fadf3dfdb22e0d61859f40d2667`
- GitHub signature: verified, reason `valid`, verified at `2026-08-24T05:52:42Z`
- Final remote recheck remained unchanged.

## B. Revision gate

PASS.

```text
remote main
= temporary checkout HEAD
= 7f6ac9c8ac007c14449c31383f5e70d5a4093881

HEAD^{tree}
= 7e9630b271578cb061cd88b28fea37ca3741ca38

HEAD^
= db689e49e2bc4fadf3dfdb22e0d61859f40d2667
```

The preserved checkout remained at `9894f6be4be663863696c5981d3d68c3c6777525`, clean and unchanged.

## C. PR #302 remediation surface

PASS. Exact diff: five paths, 405 insertions, two deletions.

- `.github/workflows/kontur-har-m3-decision-id-binding-v0.1-validation.yml`
- `audits/kontur/2026-08-24-main-7a085ffa/har-m3-decision-id-packet-binding-remediation-v0.1.json`
- `server/kontur/v0.1/HAR_M3_DECISION_ID_PACKET_BINDING_HARDENING.md`
- `server/kontur/v0.1/human-activation-review.js`
- `server/kontur/v0.1/test-human-activation-review-decision-id-binding.js`

No Activation Executor, Activation Preflight, Responsibility Kernel, Durable Ledger, permission-model, or canonical-origin implementation changed.

## D. Historical artifact_ref substitution reproduction

PASS: `REJECTED_FAIL_CLOSED`.

Changing only `review_packet_binding.artifact_ref`, while retaining the original digest and `decision_id`, produced:

```text
Human Activation Review: prior decision: decision_id binding mismatch
```

The historical packet-reference attack is fixed.

## E. Complete typed packet-binding result

PASS.

Both construction and prior-decision verification now compute:

```text
SHA-256(
  RFC8785/JCS(
    complete review_packet_binding
  )
)
```

The committed binding contains `artifact_type`, `artifact_ref`, `digest.canonicalization`, `digest.digest_algorithm`, `digest.digest_encoding`, and `digest.value`.

Property-order independence and independent SHA-256 reproduction passed. The implementation no longer relies solely on `digest.value`.

## F. Independent tamper matrix

| Vector | Result |
| --- | --- |
| A. `artifact_ref` | Rejected: `decision_id binding mismatch` |
| B. digest value | Rejected: `decision_id binding mismatch` |
| C. `artifact_type` | Rejected at binding type validation |
| D. canonicalization | Rejected at canonicalization validation |
| E. digest algorithm | Rejected at algorithm validation |
| F. digest encoding | Rejected at algorithm/encoding validation |

All six changed the independently calculated complete-binding identity. All failed closed.

## G. Coherent rebinding / deterministic-ID result

The intended checks passed:

- Coherent changed packet binding produced a different ID:
  - old: `urn:uu-aap:kontur:human-activation-review-decision:7712e00ef6cbae5e2d18f836`
  - new: `urn:uu-aap:kontur:human-activation-review-decision:b8b09a8175961fe1253eb5f1`
- Identical inputs reproduced the same ID.
- Independently changing packet binding, reviewer reference, outcome, nonce, `reviewed_at`, observed revision, or `observed_at` changed the ID.

However, a new Medium defect was reproduced. The final seed remains a raw `|`-joined tuple, while `reviewer_ref` and nonce permit `|`. Coordinated, contract-permitted changes to declared reviewer, outcome (`approve_intent_preparation` versus `reject`), and nonce produced the same ID:

```text
urn:uu-aap:kontur:human-activation-review-decision:a130ec1d111f0903bbbb0357
```

The altered prior entry was accepted, and the original nonce could subsequently be reused. Thus individual-field tests pass, but the tuple encoding is not unambiguous.

This defect was not introduced by PR #302; PR #302 retained the pre-existing joined-seed framing.

## H. Valid distinct-packet history result

PASS.

Packet A and packet B had different references, complete packet digests, and nonces. A valid decision for A followed by processing B was accepted. Coherent packet rebinding does not collapse distinct packets into one replay identity.

## I. Previous HAR-M3 replay regression result

Expected rejection passed for materially incomplete prior entry, unexpected prior field, semantic contradiction, same nonce, same packet with different nonce, omitted `priorDecisions`, and `priorDecisionsComplete != true`.

Complete prior decisions for all three outcomes were accepted: `approve_intent_preparation`, `defer`, and `reject`.

Nevertheless, the coordinated delimiter collision in section G provides a separate nonce-history bypass, so HAR-M3 replay integrity is not fully closed.

## J. Direct tests

- `node --check human-activation-review.js`: exit 0
- `node --check test-human-activation-review.js`: exit 0
- `node --check test-human-activation-review-decision-id-binding.js`: exit 0
- `node test-human-activation-review.js`: exit 0, `KONTUR Human Activation Review v0.1 audit remediation: PASS`
- `node test-human-activation-review-decision-id-binding.js`: exit 0, packet-binding hardening `PASS`
- Independent tamper/determinism/replay harness: exit 0; all requested vectors behaved as asserted, and the delimiter collision was reproduced
- Relevant JSON and schema files: JSON parse PASS
- Python schema-test source: AST parse PASS
- Local `jsonschema` dependency: unavailable (`ENVIRONMENT_LIMITATION`); it was not installed or bypassed
- Exact-main Actions independently ran `jsonschema==4.25.1`; both Draft 2020-12 schemas were valid and schema-coupling tests passed.

## K. Exact-main workflow evidence

Exact `push`/`main`/SHA-bound successful runs:

- HAR-M3 Decision ID Binding — `32695091289`
- Human Activation Review — `32695091274`
- Readiness Aggregator — `32695091275`
- Activation Preflight — `32695091254`
- Activation Executor test-only — `32695091280`
- Responsibility Kernel — `32695091292`
- Durable Responsibility Ledger — `32695091262`
- Independent Audit Hardening — `32695091267`
- Project Readiness Checkpoint — `32695091279`

All jobs and steps concluded `success`. The HAR-M3 log explicitly reported both regression suites, bounded-record checks, mutation guards, and clean-checkout verification as passing.

PoAI Genesis, PoAI Authority Root, CCRP, and CCRP pre-materialization had no run for this SHA. Their push workflows are path-filtered to PoAI/CCRP files, none of which PR #302 changed. No older run was treated as exact-main evidence.

Workflow success remains test evidence only, not activation.

## L. Remaining Low findings

Unchanged:

- `reviewer_ref` is declared identity, not cryptographic authentication.
- Relative timestamp ordering is builder-enforced rather than independently schema-enforced.
- Thirty-day Actions evidence availability limits long-term independent verification.

## M. Remaining Medium findings

One new Medium finding:

The deterministic decision-ID seed is delimiter-joined rather than a canonically encoded typed tuple. Permitted delimiter characters enable coordinated reviewer/outcome/nonce substitution while retaining the old ID and bypassing nonce-history detection.

Minimal remediation:

1. Derive the ID from an RFC8785/JCS canonical object containing every identity field, rather than `Array.join('|')`.
2. Add permanent coordinated-delimiter collision and nonce-reuse regressions.
3. Perform another bounded HAR-M3 deterministic-ID re-audit.

## N. Remaining High/Critical findings

None observed.

## O. KONTUR current state

KONTUR remains inactive.

- No real Human Activation Review Decision
- No activation intent
- No live preflight
- No execute command
- No live executor invocation
- `kernel_activated = false`
- No responsibility state
- No responsibility acceptance
- No execution authority
- No repository ownership or canonical-origin change
- No GitHub mutation

All generated decisions were synthetic, in-memory test objects. The temporary checkout and preserved checkouts finished clean.

## P. Historical provenance status

PASS.

The #301 record remains unchanged and records frontier `7a085ffa8c724777ef2c0b38e60350bdfb8c11cf`, conclusion `HAR_M3_REPLAY_HISTORY_NEEDS_MORE_TESTING`, packet-reference issue as `open_medium`, and report blob `4929ba2b91ef1faa4664aacb805e351c13892471`, matching the checked file.

The #302 remediation candidate remains unchanged with `finding_closed = false`, `all_original_medium_findings_closed = false`, `targeted_reaudit_still_required = true`, `formal_human_activation_review_allowed = false`, and `kontur_activated = false`.

## Q. Whether packet-ref decision-ID finding may be closed

YES. The specific complete packet-reference/digest binding finding is independently verified fixed and may be recorded closed.

## R. Whether HAR-M3 as a whole may be closed

NO. The coordinated delimiter collision leaves deterministic-ID and nonce-replay integrity open at Medium severity.

## S. Whether HAR-M1/HAR-M2/HAR-M3 are all closed

NO. HAR-M1 and HAR-M2 remain closed; HAR-M3 remains open.

## T. Whether closure evidence may now be created

NO aggregate all-findings closure evidence. A bounded record may document the packet-reference finding as closed and the newly discovered Medium as open.

## U. Whether Formal Human Activation Review may proceed

NO.

## V. Final bounded conclusion

`HAR_M3_DECISION_ID_BINDING_NEEDS_MORE_TESTING`
