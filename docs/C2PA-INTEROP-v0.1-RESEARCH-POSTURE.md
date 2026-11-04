# C2PA 2.4 × UU-AAP — Research Posture Successor Note

**Status:** non-normative interoperability / research-positioning note  
**Predecessor:** #777 — `docs: define C2PA 2.4 semantic boundary and interop profile v0.1`  
**Related research audits:** #957, #959, #961

## Purpose

This note narrows the research posture around the C2PA 2.4 × UU-AAP interoperability profile from #777 without changing its interoperability mechanics, semantic invariants, binding path, C2PA assertions, cryptographic handling, or authority model.

The profile should be treated as an **integration / interoperability case study** rather than as a foundational novelty claim.

> This profile operationalizes a narrowed interoperability boundary. It does not claim novelty for `provenance != permission`, generic AI-contribution disclosure, generic multi-layer governance, generic authorization/evidence composition, or generic receipt/audit semantics.

## Relationship to #777

The following #777 positions remain unchanged:

- C2PA provenance, PoAI decision-time availability, and UU-AAP authority/responsibility remain separate evidence layers;
- C2PA signer identity does not become authorship, approval, authority, or responsibility;
- C2PA action does not become a UU-AAP decision;
- C2PA ingredient lineage does not become concept origin;
- AI disclosure does not become decision/publication authority or responsibility;
- repository receipt does not become truth, review, or authorization;
- cryptographic integrity does not become epistemic truth;
- artifact provenance/existence does not establish decision-time availability;
- standard `c2pa.external-reference` remains the preferred first binding path for an external UU-AAP/PoAI record unless a concrete interoperability requirement demonstrates otherwise.

This successor therefore does **not** introduce a new C2PA assertion namespace, new trust semantics, new cryptographic primitive, or new production authority.

## Research-boundary update from #957

#957 establishes that several broad claims are predecessor-constrained and must not be presented as Matawaka novelty, including:

- generic AI-contribution disclosure;
- `Provenance != Permission`;
- generic pre-action agent authorization;
- delegation and scope narrowing;
- execution receipts;
- ordinary decision-time evidence traces.

For the #777 profile, these are therefore treated as **interop constraints and semantic safety requirements**, not originality claims.

The relevant remaining question is whether heterogeneous provenance / availability / authority evidence can be composed without silently escalating semantic power.

## Research-boundary update from #959

#959 further narrows:

- semantic non-escalation under heterogeneous evidence composition;
- machine-readable `non_effects`;
- available-vs-considered-vs-authority distinctions;
- seven-layer typed continuity.

The useful integration opportunity is narrower:

> Define a shared heterogeneous receipt envelope in which machine-readable `non_effects` and typed evidence boundaries constrain composition across provenance, decision-time availability, consideration/reliance, authority, responsibility, action admission, and outcome evidence.

This remains a research/integration candidate. It is **not** incorporated into the C2PA profile as a new standard, required assertion, or established protocol primitive.

## Research-boundary update from #961

#961 concludes that the surviving space is primarily integration and evaluation, not foundational novelty. The strongest overlap with #777 is the possibility of an interoperable profile that combines:

```text
artifact / content provenance
        +
decision-specific availability
        +
consideration / reliance
        +
authority / responsibility
        +
fail-closed action admission
        +
outcome / successor provenance
```

Accordingly, #777 should be read as a concrete **C2PA-backed interoperability case study** within that broader integration program.

It may supply evidence for whether established content-provenance mechanisms can be reused safely while preserving non-substitutability across decision and action semantics.

It must not be used to claim that Matawaka invented provenance/permission separation, AI disclosure, domain-neutral provenance, authorization proofs, execution receipts, or multi-stage governance.

## Candidate next integration work

Any successor implementation should remain bounded to testable interoperability questions such as:

1. whether standard C2PA mechanisms can bind an external heterogeneous evidence envelope without semantic loss or accidental authority escalation;
2. whether machine-readable `non_effects` survive relevant producer/consumer/adapter paths;
3. whether a consumer can mechanically distinguish provenance, availability, consideration, authority, performed action, and outcome;
4. whether cross-SDK transformations preserve the required semantic distinctions or fail explicitly;
5. whether a C2PA-backed case study can feed the broader adversarial semantic-escalation benchmark proposed after #961.

Each item requires independent evidence before any status elevation.

## Non-effects

This note does not:

- modify `SPEC.md`, `PRINCIPLES.md`, Stable Core, PoAI Genesis, CCRP, or Profile V;
- alter C2PA conformance requirements;
- define a new C2PA assertion;
- modify cryptographic verification or trust infrastructure;
- make a world-first, novelty, patentability, or standards-ownership claim;
- reinterpret historical #777 receipts or executable evidence;
- authorize merge, release, publication, deployment, or production authority expansion.

`Foundational novelty narrowed != interoperability value removed`.
