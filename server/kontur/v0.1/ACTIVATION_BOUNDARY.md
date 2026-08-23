# KONTUR activation boundary

The readiness infrastructure intentionally stops before activation.

A canonical `KONTURActivationFrontierReceipt` may establish:

- the exact repository revision is bound;
- six independent readiness axes passed;
- the emitted readiness signal is exact;
- the Responsibility Policy accepts that signal as an activation precondition;
- the canonical activation prompt may be requested.

It must still establish all of the following as false:

- `kernel_activated`
- `responsibility_state_created`
- `responsibility_accepted`
- `execution_authority_granted`
- legal responsibility/effect
- moral blame
- truth certification
- PoAI materialization
- universal canonicality

The phrase `KONTUR ACTIVATION FRONTIER READY` may be announced only after the aggregator is merged and the canonical `main` workflow reproduces a valid frontier artifact bound to that exact `main` revision.

Before preparation of a new activation intent, the current architecture may additionally produce a revision-bound `KONTURHumanActivationReviewPacket v0.1`. That packet permits only a separate human review decision.

A positive human review decision may establish at most:

`activation_intent_preparation_may_be_requested = true`

It does not create a `KONTURActivationIntent`, run activation preflight, create an execute command, call the Responsibility Kernel, write the Durable Responsibility Ledger, expand permissions, bypass permission limits, or activate KONTUR.

The review boundary is therefore:

```text
frontier/checkpoint ready
!= human review approval
!= activation intent
!= positive preflight
!= execute command
!= activation
```

See `HUMAN_ACTIVATION_REVIEW.md`.

Activation itself remains a separate explicit human-controlled operation.
