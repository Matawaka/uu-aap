# KONTUR-to-Core Admission Assessment v0.1

**Status:** read-only architecture admission / no promotion  
**Issue:** #761  
**Origin frontier:** `db9633583c937fd2cecdde4ea5b2b5a5b68d381a`

## Purpose

This assessment enforces the KONTUR successor rule:

`Pilot Success != Core Requirement`

It evaluates the three newly merged successor layers after their own conformance passed:

- Non-Binding Attention / Minimal Hint Energy;
- Useful Interaction Evidence Admission;
- Bounded Interaction Evidence Envelope.

The current result for all three is:

`NO_CORE_ADMISSION`

This does not reject or deprecate the pilot layers. It prevents successful KONTUR-specific work from silently expanding Stable Core.

## Admission threshold

A candidate is not Core/reusable merely because it is merged, green or useful. The assessment requires evidence of at least two independent non-KONTUR consumers (or equivalent independent reusable demand), a stable cross-domain interface, meaningful external conformance, no authority widening and a reversible migration path.

The current candidate packages provide no such independent consumer evidence. Their exact interfaces and vocabularies remain pilot-specific.

`One Pilot Family != Independent Reusable Demand`

`Green CI != Stable Core Admission`

`Merged != Universal`

`Useful != Generic`

## Reuse result

The assessment separately binds existing reusable primitives already used by KONTUR:

- DLC-SI v0.1 for contention/plurality;
- Event-Hash Minimalism v0.1 for bounded event commitments.

This supports the opposite of duplication:

`Reuse Existing Primitive != Need New Primitive`

Non-Binding Attention remains a KONTUR policy layered on DLC-SI. The Bounded Interaction Evidence Envelope remains a KONTUR evidence profile layered on Event-Hash Minimalism. The usefulness admission remains a pilot evidence gate.

## Byte-bound evidence

`assessment.json` binds exact Git blob SHA-1 values for every candidate and reused primitive. `validate.py` recomputes those hashes directly from repository bytes before evaluating the admission decision.

No candidate may be admitted from path/name presence alone.

## Current architecture decision

```text
state = DEFER_UNTIL_INDEPENDENT_REUSABLE_DEMAND
new_core_primitive_required = false
new_interface_registry_entry_required = false
stable_core_promotion_authorized = false
pilot_layers_remain_valid = true
next_internal_architecture_expansion_required = false
next_genuine_evidence_boundary = SEPARATELY_AUTHORIZED_FIELD_INTERACTION_SOURCE
```

This deliberately leaves the KONTUR successor umbrella open while stopping speculative internal architecture growth at the evidence boundary identified by #757/#759.

## Validation

Run:

```bash
python pilots/kontur-game-companion/core-admission-assessment-v0.1/validate.py
```

The mutation suite rejects pilot-success/green-CI promotion, threshold weakening, candidate/primitive byte substitution, fabricated consumer evidence, cross-domain/external-conformance overclaims, Core/registry promotion, forced architecture expansion, pilot invalidation and authority/effect mutations.

Dedicated CI re-runs the three assessed KONTUR layers plus DLC-SI and Event-Hash Minimalism.

## Non-effects

This assessment does not mutate Core, the interface registry or release state; it does not activate KONTUR, authorize observation, create ActionPermit, or create external-effect authority.
