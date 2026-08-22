# Proof of Available Intelligence — Genesis Principles

**Proposal:** PoAI Genesis Proposal v0.0  
**Status:** Experimental concept draft  
**Date:** 2026-08-22  
**Repository context:** UU-AAP research proposal; not part of UU-AAP v0.1 conformance

> **Core idea:** intelligence is consequential only when it is actually available to a decision under real temporal, technical, legal, contextual and authority constraints.

These principles constrain the design of **Proof of Available Intelligence (PoAI)**. PoAI is proposed as an adjacent protocol layer to UU-AAP, not as a replacement for UU-AAP.

UU-AAP asks who governed meaning, how AI participated, what evidence supports provenance claims, and who accepted responsibility in defined scopes. PoAI asks a prior and broader question: **what relevant intelligence was actually available to a decision at the time it was made?**

A future PoAI version SHOULD NOT weaken these principles silently.

## P1. Availability is relational

Available Intelligence is not a permanent property of a person, model, organization or dataset.

Availability MUST be evaluated relative to a defined subject such as a decision, claim, action, artifact or future-target event, and relative to a defined time boundary.

A resource MAY be highly capable in general while being unavailable or irrelevant to one specific decision.

## P2. Existence is not availability

The existence of a model, expert, document, dataset or prediction does not prove that it was available to a decision.

PoAI MUST be able to distinguish at least:

`exists -> discoverable -> reachable -> authorized -> contextualized -> callable -> delivered`

A system MUST NOT infer practical availability merely from technical existence.

## P3. Availability is not use

A resource that was available MAY remain unused.

PoAI MUST distinguish availability from invocation, receipt, consideration, reliance, rejection and action.

The protocol SHOULD make it possible to represent a relevant resource that was available but intentionally or unintentionally not used.

## P4. Use is not authority

Generation, analysis or recommendation does not itself confer decision authority.

PoAI MUST distinguish:

`capability -> availability -> consideration -> decision authority -> action authority -> outcome`

A human expert or AI system MAY identify a risk without possessing authority to change the decision. A decision-maker MAY possess authority without possessing the relevant knowledge.

## P5. Accountability is time-bounded

Past decisions SHOULD be evaluated against the intelligence practically available at the time, not against knowledge that emerged later.

Every consequential PoAI record SHOULD define a **Decision Boundary** and a **Knowledge Cutoff**.

Implementations MUST resist **hindsight injection**: attributing later knowledge, later model capability or later evidence to an earlier decision state.

## P6. Rejected intelligence has provenance

Decision provenance is incomplete if it records only what was selected.

PoAI SHOULD be able to represent material alternatives that were available, considered and rejected, together with the evidence and stated reason for rejection where proportionate.

The provenance of refusal can be as consequential as the provenance of adoption.

## P7. Uncertainty is first-class information

PoAI MUST NOT convert prediction, estimation or incomplete evidence into false certainty.

Implementations SHOULD support explicit epistemic states such as:

- `asserted`;
- `probable`;
- `provisional`;
- `speculative`;
- `disputed`;
- `unknown`;
- `not_verified`;
- `unavailable`.

Cryptographic validity MUST remain distinct from epistemic confidence.

## P8. The future may become actionable before it becomes factual

A future event may become sufficiently represented through contracts, commitments, resources, trajectories, forecasts and causal dependencies that it can influence present action before it becomes a historical fact.

PoAI MAY represent such an object as a **Future Target**.

A Future Target MUST NOT be presented as already realized merely because it is predictable or operationally relevant.

## P9. Prevention must not erase the value of prediction

A predicted event that does not occur is not necessarily a failed prediction.

The event may have been prevented because the prediction triggered intervention.

PoAI SHOULD therefore distinguish at least:

- `realized`;
- `not_realized_without_intervention`;
- `not_realized_after_intervention`;
- `indeterminate`;
- `not_yet_observable`.

Outcome interpretation SHOULD be represented through successor records rather than retrospective rewriting.

## P10. Consequential prediction requires contestability

If a prediction or availability claim can materially affect a person, organization or automated action, there SHOULD be a path to challenge the relevant claim before or after the consequence where feasible.

Disputes MUST NOT silently erase the original record.

Corrections, responses and appeals SHOULD create successor or linked records that preserve history.

## P11. Transparency must remain proportional

Proof of availability does not require total exposure of cognition.

PoAI MUST NOT require complete prompt histories, private conversations, continuous screen recording, biometric traces, confidential source material or hidden model reasoning for ordinary conformance.

Evidence MAY be public, redacted, hash-bound, encrypted, privately escrowed or attested by a reviewer.

## P12. No universal intelligence score

PoAI MUST NOT define one scalar score that collapses capability, availability, authority, factuality, reliability, evidence strength, review quality or responsibility into a single rank.

Different dimensions MAY be reported separately.

A protocol-defined "intelligence score" would erase distinctions that PoAI exists to preserve.

## P13. Proof is not truth

A valid signature can prove integrity of a statement. It cannot prove that the statement is honest, complete or factually correct.

A valid availability record can show what was declared and cryptographically bound. It cannot by itself prove that the associated recommendation was correct.

Interfaces MUST distinguish integrity, availability evidence, review and truth claims.

## P14. Interoperability before invention

PoAI SHOULD reuse open standards for provenance, credentials, artifact binding, timestamps, signatures and transparency records where practical.

The protocol SHOULD remain implementable by competing registries, organizations, AI providers and independent validators.

No blockchain, single identity provider, model vendor or proprietary registry SHOULD be mandatory for conformance.

## P15. PoAI itself is corrigible

PoAI is subject to the same philosophy it proposes for decisions.

Its assumptions SHOULD be visible, revisions attributable, disagreements preserved and governance open to correction.

Genesis v0.0 is intentionally incomplete. Unknowns and contested design choices are part of the record rather than defects to be hidden.

## Compact formulation

The proposal can be summarized by four constraints:

> **Availability is not use. Use is not authority. Authority is not responsibility. Proof is not truth.**

And by one temporal rule:

> **No responsible reconstruction of a decision without a time-bounded account of the intelligence that was actually available to it.**
