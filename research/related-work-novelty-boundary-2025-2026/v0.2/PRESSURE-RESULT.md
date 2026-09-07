# Novelty Pressure Test v0.2 — bounded result

This result pressures the five v0.1 `NOVELTY_CANDIDATE` claims against additional public predecessor families. It is not a patentability or world-priority conclusion.

## Executive result

```text
SNE_HEC                         -> MATERIALLY_NARROWED
COMMON_NON_EFFECTS              -> MATERIALLY_NARROWED
AVAILABLE_CONSIDERED_AUTHORITY  -> MATERIALLY_NARROWED
TYPED_CONTINUITY                -> MATERIALLY_NARROWED
CROSS_DOMAIN_REUSE              -> SURVIVES_BOUNDED_PRESSURE

novelty_established             -> false
world_first                     -> false
patentability_established       -> false
complete_prior_art_search       -> false
```

No v0.1 candidate survives unchanged.

## 1. Semantic Non-Escalation under Heterogeneous Evidence Composition

### Pressure

EP-AEC predates the public Matawaka anchor and already composes heterogeneous authorization evidence by binding all receipts to one exact action, invoking the verifier appropriate to each receipt type, and evaluating a fail-closed requirement expression.

QIK-VRT EFFECT_ACK independently states that technical receipt does not establish understanding, policy compliance, or permission for downstream effect. SCITT AI-Agent Action Receipts likewise limits a signed action record to a narrow set of claims and explicitly refuses correctness, safety, true-input, completeness, or real-world-outcome promotion. Microsoft IFC and FAVA provide deterministic mechanisms preventing information or permission from flowing into effects outside a policy boundary.

### Consequence

The broad idea `valid evidence must not silently imply a stronger claim` is not defensible as a Matawaka novelty claim.

### Surviving narrower question

The remaining candidate is a **cross-domain semantic-power composition model** in which evidence, availability, consideration, intent, authority, responsibility, coordination, permission, action and outcome are independently typed powers, and no composition creates a stronger power without its explicit transition.

That is narrower than EP-AEC authorization satisfaction and narrower than ordinary information-flow noninterference.

## 2. Machine-readable non-effects

### Pressure

Oplogica predates the public Matawaka anchor. Its deterministic verification discipline attaches machine-readable negative fields to every result, including:

```text
verifies_decision_correctness = false
certifies_compliance = false
establishes_fairness = false
detects_silent_omission = false
is_compliance_certificate = false
is_a_standard = false
```

SCITT action receipts and QIK-VRT additionally make narrow not-proven semantics normative.

### Consequence

Matawaka cannot claim to have invented machine-readable negative claims, limitation flags, or the practice of stating what a receipt does not prove.

### Surviving narrower question

The candidate is only the **shared cross-receipt contract**: heterogeneous receipt types carry machine-readable `non_effects`, and those negative semantics constrain cross-receipt composition and successor transitions rather than merely describing one verifier's posture.

## 3. Available Intelligence != Considered Intelligence != Authority

### Pressure

Observation-missingness work from May 2026 formally studies the case where recorded data omit observations that were available to the original decision-maker. Wider decision-provenance practice also treats information available at decision time as part of reconstructable context.

### Consequence

Neither `information available at the time` nor the distinction between original information and later audit records is a PoAI novelty claim.

### Surviving narrower question

The remaining candidate is the conjunction of **heterogeneous resource-level relations**:

```text
resource exists
!= resource available to this decision
!= resource considered
!= resource relied upon
!= actor has authority
!= actor accepts responsibility
```

with human judgment, AI systems, documents, datasets, models, expert groups and institutional processes represented compositionally rather than collapsed into one opaque context field.

## 4. End-to-end typed continuity

### Pressure

SOOS is the most important newly admitted predecessor family. IDP predates UU-AAP and defines a per-transition intent declaration. MAD adds delegation and narrowing. The broader SOOS family connects governed objects, mandates, execution, human escalation and tamper-evident audit.

AAC separately distinguishes pre-action authorization records, the performed/stopped action, and later outcome statements. MVAR separates planning-phase policy evaluation from execution authorization. EP-AEC composes multiple authorization layers.

### Consequence

`multi-layer agent governance`, `intent -> delegation -> execution -> audit`, and `typed agent governance architecture` are crowded claims.

### Surviving narrower question

Only the exact semantic decomposition remains under test:

```text
State/Evidence
-> Availability
-> Intent
-> Authority/Responsibility
-> Coordination
-> Action Permit/Receipt
-> Outcome/Successor State
```

Its potential contribution cannot be the number or labels of layers. It would require evidence that each transition is independently necessary to prevent a concrete semantic escalation or historical reinterpretation.

## 5. Cross-domain authorship-to-action reuse

### Pressure

The pressure corpus contains strong agent authorization, execution, audit, information-flow and decision-reconstruction architectures. None located in this bounded pass uses one typed semantic contract both for accountable human-AI authorship and for externally consequential agent actions.

### Result

`SURVIVES_BOUNDED_PRESSURE`, but only as a bounded search result.

This does not establish that no prior framework bridges these domains. The next search must explicitly include scientific workflow provenance, legal decision records, policy-as-code, software supply-chain attestations and content authenticity systems that may already provide a cross-domain abstraction.

## Revised research thesis after v0.2

The strongest defensible Matawaka research direction is no longer:

> AI agents need authorization receipts and audit trails.

Nor:

> Evidence should say what it does not prove.

Both are crowded.

The narrower research thesis is:

> A heterogeneous human/AI decision-action system needs a typed semantic-power calculus in which availability, consideration, intent, authority, responsibility, coordination, action and outcome remain separately composable; positive evidence and explicit non-effects jointly constrain which semantic transitions are admissible, and the same calculus should work across authorship governance and real-world agent action.

This thesis remains falsifiable and unresolved.

## Next gate

Before any research paper claims novelty, run v0.3 against older foundational work outside the 2025–2026 window:

- authorization logics and proof-carrying authorization;
- noninterference and information-flow type systems;
- effect systems and capability calculi;
- provenance semirings / provenance algebras;
- epistemic and dynamic logics of knowledge, belief, action and responsibility;
- decision-science concepts of information sets, awareness and consideration;
- workflow/provenance standards capable of spanning documents and actions.

`2025-2026 survival != foundational novelty`.
