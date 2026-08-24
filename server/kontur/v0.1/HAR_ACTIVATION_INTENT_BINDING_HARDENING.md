# HAR -> Activation Intent Binding Hardening

## Status

This change is a bounded remediation candidate for the handoff gap discovered after Formal Human Activation Review became available on canonical `main`.

Canonical remediation base:

- `main`: `6ef0e97e4fcaf4d1e248959394a4beac8a3d5089`
- tree: `0b74c3b35275e7b9c58806614b5d6745c74652cc`

Remediation implemented does **not** mean the finding is closed. A separate targeted read-only re-audit of the merged successor is required.

## Gap

Before this remediation, `KONTURActivationIntent v0.1` bound the exact revision, activation frontier, readiness signal, policies, health observation, responsibility holder, scopes, fencing epoch, lease and explicit human activation intent, but it did not bind the preceding `KONTURHumanActivationReviewDecision`.

Therefore the documented chain:

```text
Human Activation Review approval
-> activation intent preparation may be requested
-> KONTURActivationIntent
```

was not mechanically enforced at the activation-intent boundary.

A structurally valid activation intent could be constructed without proving that the exact revision had an explicit positive Formal Human Activation Review decision.

## Remediation

The public activation-preflight surface now requires a positive HAR chain before building an activation intent:

```text
KONTURHumanActivationReviewPacket
        |
        v
KONTURHumanActivationReviewDecision
  decision = approve_intent_preparation
        |
        v
exact decision RFC8785/JCS SHA-256 binding
        |
        v
KONTURActivationIntent
        |
        v
side-effect-free preflight
```

`KONTURActivationIntent v0.1` now contains:

- `human_activation_review_decision_binding` — exact type/ref/JCS-SHA-256 binding to the approved decision;
- `human_activation_review_evidence.review_packet` — bounded embedded packet evidence;
- `human_activation_review_evidence.decision` — bounded embedded decision evidence;
- `claims.human_activation_review_approval_bound = true`.

The HAR decision digest is also committed into the activation-intent deterministic identity seed.

## Revalidation

Before intent construction, and again whenever the intent is validated, the HAR-binding layer fails closed unless all of the following hold:

- the packet is the exact `KONTURHumanActivationReviewPacket v0.1` shape;
- packet project and exact Git revision match the activation revision;
- packet TTL is exactly 24 hours;
- packet predecessor binding shapes are exact;
- the packet deterministic ID recomputes correctly;
- the decision is the exact `KONTURHumanActivationReviewDecision v0.1` shape;
- decision outcome is exactly `approve_intent_preparation`;
- safe effect is exactly `activation_intent_preparation_may_be_requested`;
- all eight required human confirmations are true;
- the exact typed confirmation is `APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY`;
- decision revision matches the activation revision;
- the decision occurred while the packet was valid and in correct time order;
- complete prior-history and replay-guard assertions are present;
- the decision's packet binding exactly matches the embedded packet;
- the canonical typed decision identity seed reproduces `decision_id`;
- the intent's decision binding exactly matches the embedded decision;
- the HAR-bound activation intent ID recomputes correctly.

The decision is historical evidence that the human review occurred while its packet was valid. This layer does not require the HAR packet itself to remain unexpired at later intent construction. Operational freshness remains separately fail-closed through current revision, readiness signal, server health, intent age and lease checks.

## Cross-process boundary

HAR evidence is embedded in the intent so validation does not depend on process-local memory.

The preserved preflight core remains responsible for the existing revision/frontier/readiness/policy/health/holder/scope/lease checks and for producing the same side-effect-free preflight receipt contract. The HAR wrapper validates the embedded evidence before delegating to that core.

This means an Executor process that receives only the intent and the ordinary preflight context can independently revalidate the HAR chain from the intent itself.

## Regression boundary

Permanent tests reject at minimum:

- missing HAR packet;
- missing HAR decision;
- defer/reject in place of approval;
- decision-ID tampering;
- packet substitution;
- HAR revision drift;
- decision-binding substitution in the intent;
- missing embedded HAR evidence;
- embedded packet tampering;
- embedded decision outcome or ID tampering;
- external-vs-embedded HAR substitution;
- HAR-bound activation-intent ID tampering.

All prior activation-preflight fail-closed vectors remain in the same suite.

## Preserved non-effects

This remediation does not:

- create a live activation intent;
- request or run a live preflight;
- create an execute command;
- invoke the Activation Executor;
- call the Responsibility Kernel;
- create or accept responsibility state;
- grant execution authority;
- expand or bypass repository permissions;
- transfer repository ownership;
- mutate canonical origin;
- activate KONTUR;
- establish legal authority or truth.

```text
HAR approval bound to intent
!= intent currently created
!= positive live preflight
!= execute command
!= KONTUR activation
```

## Next step

After this remediation is merged, perform one bounded read-only targeted re-audit against the exact successor `main` frontier. Only a canonical PASS may permit preparation of a fresh Formal Human Activation Review for that successor revision.
