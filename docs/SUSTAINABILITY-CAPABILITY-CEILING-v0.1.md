# Sustainability Capability Ceiling v0.1

**Status:** non-normative operational contract  
**Canonical predecessor:** `e927e9a2855b1678506083745c33a1627c1ad46d`  
**Kernel relation:** operationalizes Sustainability Kernel K4 and reinforces K2/K3/K5.

## Purpose

This contract defines the maximum capability envelope a component may rely on at a given observed frontier.

It is intentionally narrower than execution authorization.

`within capability ceiling != authorized to execute`

`recovered state != expanded capability`

`handoff != authority transfer`

## State model

A capability request is assessed against an explicit ceiling:

`fresh observation -> declared ceiling -> requested capability -> within-ceiling | requires-fresh-authorization | denied | unknown`

The strongest result from this contract is `prepare-only`.

This contract cannot create CHSP execution authorization, cannot activate KONTUR, and cannot change repository or provider permissions.

## Capability set

A ceiling contains:

- explicit allowed capabilities;
- explicit denied capabilities;
- a fail-closed rule for every unlisted capability.

The default for an unlisted capability is:

`denied-until-fresh-authorization`

Absence from a deny list is not permission.

## Expansion rule

Capability expansion requires a **new attributable authorization event**.

Expansion cannot be inferred from:

- an earlier authorization for another action;
- recovery after pause or context loss;
- handoff between contexts;
- project inactivity;
- elapsed time;
- successful validation;
- branch existence;
- a prior successful execution;
- the fact that a provider API technically permits the action.

`technical possibility != authorized capability`

## Denial semantics

A denied capability must remain denied until a fresh attributable authorization changes the ceiling.

A component must not:

- route around a denied provider operation using another provider path;
- reinterpret a broader role as implicit permission for an unrelated action;
- use recovery metadata as authority;
- convert delay or silence into consent;
- claim that a successful dry run grants execution permission.

`denial != routing hint`

## Relationship to Recovery / Resume v0.1

The recovery contract merged in #276 can re-establish a trustworthy current frontier and reach `safe_to_prepare`.

This capability-ceiling contract then determines whether a requested capability is inside the known envelope.

Neither contract authorizes external execution.

`recovered + within-ceiling != executable`

Execution, when applicable, remains governed by a separate exact execution authorization mechanism such as CHSP v1.0.

## Relationship to CHSP v1.0

CHSP v1.0 is a bounded external-transition executor architecture with exact execution request, authorization, preflight, mutation boundary, verification, and receipt.

This contract is upstream and generic. It does not widen CHSP and does not substitute for CHSP authorization.

A capability may be inside the ceiling while CHSP execution remains unauthorized.

Conversely, a request outside this ceiling requires a new attributable expansion decision before any later execution protocol can be considered.

## Relationship to KONTUR

This contract does not activate KONTUR, does not grant KONTUR new permissions, and does not reinterpret already granted permissions.

If KONTUR is later assessed against a capability ceiling, denied and unlisted capabilities remain fail-closed.

## Required invariants

1. `requires_new_attributable_authorization = true`
2. `prior_authorization_implies_expansion = false`
3. `recovery_implies_expansion = false`
4. `handoff_transfers_authority = false`
5. `inactivity_is_consent = false`
6. `denial_may_be_routed_around = false`
7. `authority_effect = none`
8. `external_execution_authorized = false`

## Non-effects

This contract does not:

- modify repository permissions;
- add or remove collaborators;
- call provider mutation APIs;
- create CHSP execution requests or authorizations;
- activate KONTUR;
- create workflows or required checks;
- mutate tags, releases, checkpoints, or canonical origin;
- infer human incapacity or reduce human authority.

## Compact chain

`recover current state -> establish fresh frontier -> evaluate requested capability -> remain within ceiling OR require fresh attributable authorization -> only then may a separate execution protocol be considered`

This contract therefore bounds **what may be prepared**, not **what may be executed**.
