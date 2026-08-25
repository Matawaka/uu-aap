# Preventive Intent Challenge v0.1

Preventive Intent Challenge (PIC) v0.1 is a provider-neutral, non-actuating profile for surfacing slow, cumulative intent or policy drift without converting drift evidence into authority, blame, liability, sanction, blocking, or execution.

## Canonical sequence

`Prior Intent Baseline -> Bounded Drift Evidence -> Preventive Challenge -> Fresh Non-Leading Response -> Scoped Drift Assessment -> Advisory Human Gate`

## Normative boundaries

- `Drift Evidence != Proof of Malicious Intent`
- `Challenge Trigger != Automatic Block`
- `Preventive Review != Authority Escalation`
- `TEXT_PRESENTED != TEXT_UNDERSTOOD != TEXT_ACCEPTED != INTENT`
- `Proof of Exposure != Proof of Understanding != Proof of Acceptance != Proof of Intent`
- `Silence != Refusal`
- `Delay != Intentional Delay`
- `Accumulated Deviation != Liability`
- `Prior Approval != Fresh Intent After Challenge`

The challenge text must carry provenance and origin classification (`system`, `human`, or `mixed`). A presentation event has `intent_evidence_weight = 0` by default. A PIC assessment may recommend a human review gate, but it cannot itself block, execute, revoke, sanction, mutate responsibility state, expand authority, or alter KONTUR.

## Required fields

A conforming artifact binds:

1. a prior intent baseline;
2. a bounded drift observation window and explicit indicators;
3. challenge provenance and anti-leading properties;
4. response state (`responded`, `no_response`, or `deferred`) without interpreting silence or delay as refusal;
5. a scoped assessment that may surface a human gate but preserves all non-effects.

## Fail-closed behavior

Validation rejects unbounded drift windows, missing baseline/provenance, leading wording, non-zero intent weight for presentation alone, silent/refusal conflation, delay/intent conflation, carry-forward of old approval, automatic blocking/sanction/execution, authority escalation, responsibility/liability assignment, and any KONTUR or permission mutation claim.

This profile is evidence and coordination only. It performs no external lookup, profiling, actuator invocation, permission change, release/tag/publication, history rewrite, canonical-origin mutation, or KONTUR transition.
