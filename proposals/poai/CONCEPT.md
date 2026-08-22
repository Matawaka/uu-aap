# Proof of Available Intelligence — Genesis Concept

**Proposal:** PoAI Genesis Proposal v0.0  
**Status:** Experimental concept draft  
**Date:** 2026-08-22  
**Relationship to UU-AAP:** Adjacent research proposal; no change to UU-AAP v0.1 conformance

## 1. Abstract

**Proof of Available Intelligence (PoAI)** is a proposed open protocol for describing and verifying what human, machine, institutional and documentary intelligence was practically available to a specific decision at a specific time.

PoAI does not attempt to prove that a person or AI system is generally intelligent. It does not rank models and it does not define a universal intelligence score.

Instead, PoAI asks:

> **What could this decision realistically know, check, compare or foresee before it closed, under the actual access rights, data, time, context, technical constraints and authority structure that existed then?**

The unit of analysis is therefore not "intelligence in general" but **available intelligence relative to a decision boundary**.

## 2. Why this proposal exists

Modern decisions increasingly depend on distributed cognition:

- humans provide intent, judgment, tacit knowledge and authority;
- AI systems generate options, retrieve information, analyze evidence and forecast outcomes;
- organizations control permissions, workflows and escalation paths;
- datasets and documents encode prior knowledge;
- automated systems execute decisions;
- future events can become operationally visible before they occur.

Existing provenance mechanisms can often show where an artifact came from or who signed an assertion. UU-AAP adds governance of meaning for AI-augmented intellectual works. A broader gap remains: reconstructing the **information and capability horizon of a decision itself**.

Without that layer, retrospective analysis often collapses several distinct questions:

1. Did relevant intelligence exist somewhere?
2. Could the decision-maker discover it?
3. Could they reach it?
4. Were they authorized to use it?
5. Could it receive enough context?
6. Could it respond before the decision deadline?
7. Was its output actually received?
8. Was it considered?
9. Did the receiving actor have authority to act?
10. What happened afterward?

PoAI exists to keep those questions separate and machine-readable.

## 3. Core proposition

Let `I` be an intelligence resource, `D` a decision event and `T` a relevant time boundary.

PoAI treats availability as a relation:

`Available(I, D, T)`

not as a permanent property of `I`.

A resource MAY be capable but unavailable. It MAY be available but unused. It MAY be used but ignored. It MAY be relied upon by an actor who lacks authority. It MAY correctly predict an event that is later prevented because of the prediction.

Those distinctions are the protocol's primary subject matter.

## 4. Relationship to UU-AAP

PoAI is intentionally not merged into UU-AAP.

### UU-AAP asks

- Who set the governing intent of an intellectual work?
- How did AI participate?
- Who selected concepts and wording?
- What evidence supports the provenance claims?
- Who accepted responsibility in defined scopes?

### PoAI asks

- What relevant intelligence was available to a decision?
- When was it available?
- Under which permissions and constraints?
- Was it invoked and considered?
- What alternatives were available but rejected?
- Who had decision and action authority?
- How should later outcomes be linked without rewriting the earlier state?

A UU-AAP decision trace MAY reference a PoAI record. A PoAI record MAY reference a UU-AAP manifest when the decision concerns creation, approval or publication of an intellectual work.

The first PoAI example references the existing UU-AAP/T pilot for **«Вайбкодинг реальности»**.

## 5. Philosophical origin

The proposal grows from several recurring ideas developed around the books **«Вайбкодинг реальности»** and **«Цифрорубляция реальности»**.

### 5.1 Augmented cognition

As AI expands the set of options a human can inspect, the critical question shifts from "who generated these words?" toward "what decision space was available, and who governed the choice inside it?"

### 5.2 Quasi-Existent Future

A future event may not yet be factual while already being represented through contracts, commitments, resource allocations, trajectories, forecasts and expected consequences.

PoAI calls a future event used as the subject of present intelligence a **Future Target**.

### 5.3 Responsibility horizon

A predicted event may cross a practical threshold at which an actor can reasonably inspect, challenge or act on information about it. PoAI does not define legal responsibility, but it can preserve the evidence needed to ask whether a meaningful intervention opportunity existed.

### 5.4 The market of the unrealized

An event that did not occur may still represent a successful outcome if it was prevented by an intervention. PoAI therefore requires successor outcome semantics that do not equate `not_realized` with `prediction_false`.

## 6. Core objects

### 6.1 Decision Event

A bounded decision, approval, rejection, commitment, publication act, automated action or other consequential selection.

A Decision Event SHOULD include:

- stable identifier;
- subject;
- opened time where known;
- closed time where known;
- knowledge cutoff;
- temporal precision;
- decision status.

Unknown historical timestamps MUST remain unknown rather than be invented.

### 6.2 Intelligence Resource

Anything capable of contributing relevant cognition or evidence to a Decision Event.

Examples:

- human judgment;
- AI model or AI-assisted workflow;
- expert group;
- document;
- dataset;
- retrieval service;
- forecasting model;
- simulation;
- institutional procedure.

Recording a resource does not imply personhood or moral agency.

### 6.3 Availability Claim

A scoped claim describing whether and how an Intelligence Resource was available to a Decision Event.

Recommended dimensions:

- `identity`;
- `discoverability`;
- `reachability`;
- `authorization`;
- `temporal_fit`;
- `context_sufficiency`;
- `execution_capability`;
- `delivery`;
- `evidence_strength`.

Each dimension SHOULD remain independently reportable.

### 6.4 Decision Boundary

The temporal boundary inside which intelligence can count as available to the original decision.

The Decision Boundary exists to prevent later information from being silently injected into the past.

### 6.5 Knowledge Cutoff

The latest point at which new information could materially enter the decision state.

For historical records, the cutoff MAY be approximate and its precision MUST be declared.

### 6.6 Consideration Trace

A proportionate record of what was actually considered.

It MAY include:

- question being decided;
- resources invoked;
- outputs received;
- alternatives considered;
- alternatives rejected;
- reasons stated;
- unresolved uncertainty.

PoAI MUST NOT require hidden chain-of-thought or complete prompt disclosure.

### 6.7 Available Alternative

A material alternative that existed and was practically available before the Decision Event closed, whether or not it was selected.

This object helps distinguish:

- "no alternative was available" from
- "an alternative was available but not used" from
- "an alternative was considered and rejected".

### 6.8 Authority Mapping

A mapping between actors and authority scopes.

Recommended scopes include:

- `observe`;
- `request_analysis`;
- `recommend`;
- `decide`;
- `approve`;
- `block`;
- `execute`;
- `review`;
- `appeal`.

Availability MUST NOT imply authority.

### 6.9 Future Target

A future event whose present representation is material to the decision.

A Future Target SHOULD state its epistemic status and MUST remain distinct from a realized outcome.

### 6.10 Successor Record

A later record that updates interpretation without overwriting history.

Examples:

- a prediction becomes realized;
- a predicted event is prevented after intervention;
- an availability claim is disputed;
- a model version is later identified;
- a historical timestamp is corrected;
- independent review is added.

## 7. Availability lifecycle

PoAI proposes the following conceptual lifecycle:

```text
exists
  -> discoverable
  -> reachable
  -> authorized
  -> contextualized
  -> callable
  -> invoked
  -> output_received
  -> considered
  -> relied_upon | rejected | not_used
  -> action
  -> outcome
```

The lifecycle is descriptive, not mandatory workflow automation.

Implementations MAY record only the stages material to their use case, subject to profile requirements.

## 8. Tentative conformance profiles

Genesis v0.0 reuses the four-letter progression familiar from UU-AAP. These profiles are experimental and not yet normative.

### PoAI/D — Declared

Declares:

- Decision Event;
- Decision Boundary;
- actors;
- Intelligence Resources;
- major constraints;
- authority scopes.

### PoAI/T — Traceable

Adds:

- Availability Claims;
- evidence references;
- Consideration Trace;
- material Available Alternatives;
- epistemic status;
- version lineage;
- contestability path.

### PoAI/V — Verifiable

Adds:

- cryptographic binding;
- signed assertions or equivalent credentials;
- timestamp or durable transparency evidence;
- verification instructions.

### PoAI/R — Reviewed

Adds:

- independent scoped review;
- reviewer identity or verifiable pseudonymous key;
- review limitations;
- unresolved disagreements.

Profiles indicate evidence strength, not intelligence quality, truth, morality or legal responsibility.

## 9. Evidence model

Genesis v0.0 tentatively reuses the UU-AAP evidence classes:

- `E0 declaration` — self-declaration only;
- `E1 artifact` — supporting artifact exists;
- `E2 hash_bound` — evidence is represented by cryptographic digest;
- `E3 signed` — evidence or claim is digitally signed;
- `E4 third_party` — independent attestation exists.

An evidence class MUST NOT be interpreted as factual truth.

## 10. Future-event semantics

For a Future Target, PoAI SHOULD allow a later successor record to describe:

- `realized`;
- `not_realized_without_intervention`;
- `not_realized_after_intervention`;
- `indeterminate`;
- `not_yet_observable`.

If intervention occurs, the successor SHOULD state the intervention relation rather than simply label the original forecast false.

This is required to represent the paradox of successful warning: a useful forecast can reduce the probability of its own observed realization.

## 11. Contestability

Consequential claims SHOULD be challengeable.

A challenge MAY target:

- resource identity;
- capability;
- discoverability;
- reachability;
- authorization;
- temporal availability;
- context sufficiency;
- output receipt;
- consideration status;
- authority mapping;
- future-target interpretation;
- outcome interpretation.

Challenges SHOULD be additive. The original record remains part of history.

## 12. Privacy and proportionality

PoAI MUST NOT require total observability of cognition.

A conforming implementation SHOULD support:

- selective disclosure;
- redaction;
- hash-bound private evidence;
- encrypted evidence;
- private escrow;
- reviewer attestations.

The protocol SHOULD collect the least sensitive evidence necessary for the selected profile and use case.

## 13. Non-goals

PoAI v0.0 does not determine:

1. whether a human or AI is conscious;
2. general intelligence ranking;
3. factual truth;
4. legal liability;
5. moral blame;
6. copyright ownership;
7. whether every available resource should have been used;
8. whether a prediction should automatically trigger action;
9. whether an unobserved future event was objectively inevitable;
10. a universal trust or intelligence score.

## 14. Threat model summary

PoAI must eventually address at least:

- **availability laundering** — claiming a resource was available when practical use was impossible;
- **hindsight injection** — attributing later knowledge to the earlier decision;
- **capability inflation** — overstating what a resource could do;
- **context stripping** — counting nominal access where necessary context was absent;
- **silent model substitution** — changing model/version without provenance update;
- **false consideration** — claiming an alternative was considered when it was not;
- **responsibility laundering** — assigning responsibility to an actor who lacked relevant intelligence or authority;
- **coercive transparency** — demanding excessive prompt, biometric or private evidence.

## 15. Interoperability direction

PoAI SHOULD reuse existing infrastructure before inventing new cryptography.

Candidate mappings include:

- provenance graphs compatible with W3C PROV concepts;
- W3C Verifiable Credentials or equivalent signed claims for roles and authority;
- C2PA where PoAI records bind to digital artifacts;
- transparency services or append-only signed-statement logs;
- ordinary cryptographic digests and signatures for minimal implementations.

These are interoperability directions, not mandatory dependencies in Genesis v0.0.

## 16. First pilot question

The first example uses an existing decision in the UU-AAP/T pilot for **«Вайбкодинг реальности»**:

> Treat AI as cognitive augmentation supporting search, comparison, drafting and critique while retaining human governing authority over direction and final selection.

The example tests whether PoAI can distinguish:

- the human author's governing judgment;
- the available ChatGPT-assisted workflow;
- incomplete historical model/version metadata;
- private evidence;
- actual use of AI assistance;
- human decision authority;
- a traceable link to the existing UU-AAP manifest.

It deliberately leaves unknown historical details as `null` or `unknown`.

## 17. Open questions for public review

Genesis v0.0 intentionally leaves several questions unresolved:

1. Which availability dimensions are mandatory for each profile?
2. When is a resource merely reachable versus practically available?
3. How should context sufficiency be evidenced without exposing sensitive inputs?
4. How should organizations represent authority that changes during a decision window?
5. What minimum evidence is required to claim that an alternative was genuinely considered?
6. How should future-target probability be represented without creating a universal score?
7. How should successful interventions be causally linked to unrealized outcomes?
8. Should PoAI define a registered assertion format or remain a semantic model mapped into existing standards?
9. Which parts belong in a future standalone `poai` repository rather than the UU-AAP research space?

## 18. Genesis thesis

PoAI begins from a simple claim:

> **The future of accountability requires provenance not only of artifacts and decisions, but of the intelligence that was actually available before those decisions became history.**
