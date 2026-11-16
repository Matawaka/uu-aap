# Stateful response lifecycle experiment v0.1

Issue #1045; additive successor of merged #1044. Origin main:
`7ff2a7c3e46211f57ee038e626c1a6d1e24e1940`.

[Русская версия](README.ru.md) · [Parent trial matrix](../README.md)

## What was executed

A deterministic event-tape driver retains pending synthetic requests while a
monotonic **model** clock and synthetic authority source change. At completion it
calls the existing pinned Execute Revalidation validator. There is no live clock,
identity provider, PCC question generator, person, biometric model or actuator.

Two arms receive identical event tapes:

- `fresh_boundary`: observe the current model time, context and admission;
- `cached_boundary`: deliberately reuse the first-phase boundary snapshot.

The second arm is an authored unsafe comparison, not a claim that deployed
UU-AAP or Vault executes this implementation. In both arms all outputs remain
non-authorizing evidence.

```bash
node schemas/ecosystem/uu-society/v0.1/personal_anchor_trials/lifecycle-v0.1/run-lifecycle-trials.js --check-reference
node --test schemas/ecosystem/uu-society/v0.1/personal_anchor_trials/lifecycle-v0.1/test-lifecycle-trials.js
```

No dependencies beyond Node built-ins. `source-pins.json` checks three exact
predecessor files. `scenarios.json` contains independently authored expectations
for both arms. `reference-results.json` retains actual deterministic output,
code/input hashes and minimized response receipts. `--check-reference` checks
exact reproduction and never rewrites the reference. `--write-reference` is an
explicit authoring operation and only writes after expectations pass.

## Recorded result

16 tapes / 32 arms conform to their fixed expectations. There are **11 declared
differences**, including related variants of one caching failure class; these
are not eleven newly discovered product vulnerabilities. The 24 Node test
entries include five response-binding subtests and four authored source-mutation
subtests. All four mutations are detected by fixed fresh-arm expectations:
cached boundary substitution, frozen completion clock, disabled local replay
guard and confidence promoted to identity.
An additional metamorphic check keeps expected outcomes and prose out of the
lifecycle's decision inputs.

| Cases | Observation |
| --- | --- |
| L00 | Timely response and current admission remain a positive control |
| L01/L07/L09/L15 | Retention, delayed cleanup and client timestamps cannot renew a response or source deadline in the fresh arm; the cached arm preserves acceptance |
| L02/L04 | Current denial and unavailable current admission cannot be replaced by earlier success |
| L03/L05/L06/L13 | Changed control epoch, approval/permit, target or intent affect the pending response; a new current request remains usable in L13 |
| L08 | Wrong nonce does not consume the legitimate request; replay after a recorded response is locally rejected |
| L10/L11/L14 | Public-history metadata and high synthetic confidence do not establish person/control or create authority |
| L12 | An inconsistent response remains evidence without a guilt verdict; a new request remains possible |

## Architectural consequences of this experiment

1. A validator cannot prove that its caller supplied current time/admission.
   Completion must obtain them at the actual boundary, independently of the
   client timestamp and cached first-phase record. The unsafe arm demonstrates
   what the same real validator accepts with stale, self-consistent inputs.
2. Response binding and action-contract readiness are separate fields. L07/L15
   have an expired response while the action contract is still READY;
   READY is neither fresh continuity proof nor an ActionPermit.
3. A fresh audit cites the current source digest but keeps old inner
   approval/permit/target bindings. Rehashing does not repair mismatches. The
   retained first-phase record is unchanged.
4. Wrong or mismatched responses cannot poison a valid pending request. A
   completed request has a local tombstone; a new request remains possible.
   This is not distributed one-shot consumption.

## Limits and next evidence gate

The queue holds at most 64 requests and 256 minimized receipts. Tests retain a
full queue across expiry; they do not perform real concurrent queue-load tests.
No polling/daemon is introduced. Synthetic response TTLs are half-open
(`now < expires`); unchanged predecessor source-bound comparisons remain
inclusive. These conventions do not establish production clock policy.

The nonce is a deterministic public label and control epochs are synthetic
integers. There is no signature, unpredictable nonce, key possession, live relay
defense, distributed replay storage, restart persistence or trusted-time proof.
Reproducing all public response metadata can produce a current-looking record;
L14 preserves that limitation. Upstream `assessment`/`confidence` are declared
inputs, not classifier or continuity measurements. No genuine biometric
false acceptance/rejection rates are measured.

The code rejects unexpected history fields and stores response commitments,
not answer bodies. This is a bounded storage check, not a general privacy proof.
The model's admission provider is assumed, not authenticated. Identity,
causal-continuity, guilt, new-authority, live-consumption and action claims remain
false. Source outage is recorded, not declared unchanged or PASS.

All real end-to-end PCC, full-history-compromise, cryptographic rotation,
replay/relay and biometric trials remain **NOT_EXECUTED**. Their next gate is an
identified subject/adapter, actual current source/clock binding, durable replay
behavior, authorized datasets, frozen operating points and independent
reproduction. Keep #1021 open.
