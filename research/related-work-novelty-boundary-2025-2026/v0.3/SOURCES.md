# Foundational pressure sources — v0.3

This audit intentionally reaches outside the 2025–2026 AI-agent literature. Older terminology is not treated as irrelevant when the underlying semantic contract overlaps.

## 1976 — Denning, secure information flow

**A Lattice Model of Secure Information Flow**, CACM, 1 May 1976.

Foundational overlap: formal restrictions on information flow, lattice-based policy and automatic certification. This is direct pressure against treating non-escalating composition as a newly invented general security idea.

Non-overlap: no AI decision receipts, intent or responsibility model.

## 1987 — Fagin & Halpern, awareness

**Belief, Awareness, and Limited Reasoning**, Artificial Intelligence, December 1987.

Foundational overlap: awareness is explicitly distinct from belief; agents are not logically omniscient and may reason locally. This is a deep predecessor to `exists != available/aware != used in reasoning`.

## 1988 — Lucassen & Gifford, effect systems

**Polymorphic Effect Systems**, POPL 1988, 13 January 1988.

Foundational overlap: effects become separate machine-checkable descriptions, distinct from returned values and constrained to regions. This defeats any foundational novelty claim based merely on representing effects/non-effects separately.

## 1990 — Cohen & Levesque, intention

**Intention Is Choice with Commitment**, Artificial Intelligence, March 1990.

Foundational overlap: beliefs, goals, actions and intentions are separate formal concepts; an agent need not intend every foreseen side effect. This predates a central Matawaka distinction between possible/foreseen effects and intended effects.

## 1995 — Gensch & Soofi, consideration sets

**Information-Theoretic Estimation of Individual Consideration Set**, May 1995.

Foundational overlap: an awareness set is partitioned into consideration and non-consideration sets. The availability/consideration distinction therefore cannot be claimed as a new PoAI idea by itself.

## 1997 — Myers & Liskov, decentralized IFC

**A Decentralized Model for Information Flow Control**, SOSP 1997.

Foundational overlap: decentralized authority and declassification govern how information may flow despite untrusted code. Static certification can prove flow constraints. This strongly pressures general semantic-power non-amplification claims.

## 2001 — Proof-Carrying Authorization

**A Proof-Carrying Authorization System**, Princeton TR-638-01, April 2001.

Foundational overlap: a protected operation is admitted from a machine-checkable proof under distributed policy rather than because a principal can technically reach the resource. This predates modern proof-carrying agent authorization by decades.

## 2001 — BOID

**The BOID Architecture**, AGENTS 2001.

Foundational overlap: Beliefs, Obligations, Intentions and Desires remain distinct components; effects are considered before commitment and conflicts are explicitly resolved. This strongly limits novelty claims around typed epistemic/deontic/action staging.

## 2001 — local/frame reasoning

**Local Reasoning about Programs that Alter Data Structures**, CSL 2001.

Foundational overlap: formal reasoning can state the local footprint of an operation while preserving unaffected state. This is a predecessor to explicit reasoning about effects and guaranteed non-effects, though in a programming-logic domain.

## 2002 — security policy composition

**A Calculus for Composing Security Policies**, Princeton TR-655-02, August 2002.

Foundational overlap: policies enforced by runtime monitors have formal composition semantics; disallowed action sequences may be transformed or terminated. General safe policy composition is therefore not new to AI governance.

## 2007 — provenance semirings

**Provenance Semirings**, PODS 2007.

Foundational overlap: provenance annotations already have a general algebraic composition model. This is important pressure against framing evidence/provenance composition itself as a new idea.

## 2011 — Open Provenance Model

**The Open Provenance Model Core Specification v1.1**, Future Generation Computer Systems.

Foundational overlap: precise technology-agnostic provenance for any “thing”, with interoperability and valid-inference rules. Cross-domain provenance abstraction clearly predates Matawaka.

## 2013 — W3C PROV

**PROV-DM / PROV-O**, W3C Recommendation, 30 April 2013.

This is the strongest foundational pressure on cross-domain continuity. PROV already represents:

- Entities, Activities and Agents;
- human, organization and software agents;
- a Plan as intended actions/steps toward goals;
- plan reliance in an activity;
- assignment of responsibility for an activity;
- delegation as assignment of authority and responsibility for a specific activity;
- outcome/accountability lineage across domains.

Important non-overlap: PROV is descriptive provenance, not a fail-closed pre-action decision-authority protocol, and it does not require availability vs consideration relations.

## 2019 — in-toto

**in-toto: Providing Farm-to-Table Guarantees for Bits and Bytes**, USENIX Security 2019.

Foundational overlap: expected multi-step layouts, authorized functionaries and signed observed link metadata bind intended/authorized workflow structure to actual commands, materials and products. This pre-dates current AI-agent action-chain receipts.

Non-overlap: software supply-chain integrity is narrower than general decision epistemics and responsibility acceptance.

## Interpretation rule

No single predecessor above is asserted to be “equivalent to Matawaka.” The foundational result is based on **decomposition**: when every allegedly foundational primitive or distinction already has mature prior semantics, the burden shifts to proving that a specific integration/evaluation method is new and useful rather than claiming invention of the underlying concepts.
