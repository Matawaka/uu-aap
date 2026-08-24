# KONTUR targeted re-audit — main `cf4abd3932048bbcfa30c157fa887cf434b2be5e`

Date: 2026-08-24

## Canonical frontier

- main: `cf4abd3932048bbcfa30c157fa887cf434b2be5e`
- tree: `3326bec09d53553a87f54d18899719a9a7df8473`
- direct parent: `c47ce529a773006292e920a7cac537de85222d03`
- GitHub commit signature: verified, reason `valid`
- revision gate: PASS

The preserved historical checkout remained unchanged at `9894f6be4be663863696c5981d3d68c3c6777525`. The separate temporary checkout was clean.

## Scope

Targeted independent re-audit of PR #294 Human Activation Review remediation only. No Activation Executor, Activation Preflight, Responsibility Kernel, Durable Ledger, permission model, or canonical-origin implementation was changed by PR #294.

## HAR-M1

**VERIFIED / may be closed.**

Complete predecessor-contract validation failed closed for malformed or incomplete Project Readiness Checkpoint and current-main verification receipts. The historical inconsistent-join attack is no longer reproducible:

- checkpoint bound to receipt A + supplied receipt B with a different ref -> rejected;
- checkpoint bound to receipt A + supplied same-ID but different-content receipt B -> rejected by digest mismatch.

Decision-time reconstruction also rejects packet tamper and predecessor substitution.

## HAR-M2

**VERIFIED / may be closed.**

Independent schema-only validation accepted all 3 valid decision outcomes and rejected all 13 required contradictory objects. Outcome, declaration, typed token, confirmations, safe effect, and positive claim are coupled by schema.

## HAR-M3

**PARTIAL / MEDIUM remains open.**

Verified:

- packet TTL exactly 24 hours;
- observed-current revision required and drift rejected;
- reviewed/observed/prepared/expiry ordering enforced;
- malformed timestamps rejected;
- decision-time predecessor reconstruction required;
- omitted or incomplete prior-decision history rejected;
- nonce replay rejected;
- same packet with a different nonce rejected;
- changed current main rejected.

Remaining defect:

```text
malformed prior decision entry
-> ACCEPTED
```

`assertPriorDecisionEntry()` validates only a small subset of a prior `KONTURHumanActivationReviewDecision v0.1`. A materially incomplete entry lacking required decision fields can therefore enter complete-history replay evaluation.

Minimal required correction: fully validate every prior decision entry against the complete bounded decision contract before reading nonce or packet binding, and retain the reproduced malformed-entry attack as a permanent negative regression vector.

## Workflow evidence

Exact-main push workflows used as evidence, all bound to head SHA `cf4abd3932048bbcfa30c157fa887cf434b2be5e` and successful:

- Human Activation Review v0.1 — run `32688340556`
- Independent Audit Hardening v0.1 — run `32688340597`
- Project Readiness Checkpoint v0.1 — run `32688340566`
- KONTUR Readiness Aggregator — run `32688340611`
- Activation Preflight — run `32688340573`
- Activation Executor TEST-ONLY — run `32688340577`
- Responsibility Kernel — run `32688340598`
- Durable Responsibility Ledger — run `32688340621`

The Human Activation Review workflow reported no human decision or activation emitted.

`EVIDENCE_ACCESS_GAP`: artifact metadata and job logs were accessible; inner archive bytes were not independently downloaded through the available read-only interface.

## Remaining findings

### Medium

One:

- HAR-M3 replay-history validation accepts materially incomplete/malformed prior-decision entries rather than validating the complete `KONTURHumanActivationReviewDecision v0.1` contract fail-closed.

### Low

- `reviewer_ref` is declared identity, not cryptographically authenticated identity.
- Relative timestamp ordering is enforced by the builder but is not independently expressible/enforced by JSON Schema.
- Relevant evidence artifacts retain a 30-day lifetime, limiting long-term independent availability.

The previous generic predecessor binding-type finding is closed as part of remediation.

### High/Critical

None found in targeted scope.

## KONTUR state

KONTUR remains inactive. No real Human Activation Review Decision, activation intent, live preflight, execute command, live executor invocation, responsibility acceptance, authority grant, permission expansion/bypass, repository mutation, or canonical-origin mutation occurred.

## Historical provenance

The earlier audit remains historical and unchanged:

- audited frontier `2a0fbd4d67e9db4913658da825336d2c4a8c2888`;
- conclusion `READY_FOR_MORE_TESTING`;
- full-report SHA-256 `d25dff2ce7ace5936976f453123528dbc11de22f0e7e6ea0ad5d84e2659f74e7`.

The PR #294 remediation record remains a pre-re-audit candidate and is not retroactively rewritten by this record.

## Bounded conclusion

`HAR_REMEDIATION_NEEDS_MORE_TESTING`

Therefore:

```text
HAR-M1 closed
+ HAR-M2 closed
+ HAR-M3 still Medium
!= Formal Human Activation Review allowed
!= activation approval
!= activation intent
!= KONTUR activation
```
