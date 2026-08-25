# KONTUR Game Companion — Cross-Layer Dependency Contract v0.1

Status: synthetic / non-executing / repository-evidence hardening

Related: #445, #446, #452, #453, #454, #455, #456, #457, audit publication #458

Origin frontier: `2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee`

## Purpose

The seven Game Companion layers already have strong local chains:

`README -> fixture -> validator -> workflow`

The connectivity audit published in #458 identified two high-severity evidence gaps:

1. adjacent successor relations were not machine-bound to an exact predecessor artifact state;
2. predecessor-only changes did not cause downstream Game Companion validation to run.

This slice adds one central, fail-closed dependency contract and one transitive validation workflow. It does **not** merge the seven layers into one component and does not promote the pilot into Stable Core.

## Canonical layer order

```text
observational-lane
-> assistance-gate
-> shared-discovery-memory
-> bounded-initiative
-> focus-diversity
-> interaction-receipt
-> pause-resume
```

Each layer is bound to four repository artifacts:

- specification (`README.md`);
- machine-readable fixture;
- deterministic validator;
- direct CI workflow.

For every artifact the contract records:

- exact path;
- SHA-256 at the layer's origin commit;
- SHA-256 of the currently accepted/bound artifact state.

The layer then receives a deterministic `binding_digest` over the four bound SHA-256 values. Every adjacent edge carries both the predecessor and successor binding digest.

Therefore a predecessor relation is no longer inferred from PR numbering, directory adjacency, or prose alone.

## Binding semantics

`Origin Commit != Semantic Dependency`

An origin commit proves provenance only. The dependency edge is established by the explicit edge plus the exact bound artifact digest.

`Artifact Hash Match != Semantic Correctness`

A hash proves identity of bytes, not correctness of policy.

`Dependency Edge != Authority`

A successor depending on predecessor evidence does not gain permission to act, interrupt, disclose, retain memory, or create a successor state.

`Downstream Validation != Downstream Authority`

Re-running validators after an upstream change checks compatibility. It grants nothing.

`Cross-Layer Contract != Stable-Core Promotion`

This remains an optional Game Companion pilot contract.

`Audit Finding != Architecture Authority`

#458 is evidence explaining why this hardening exists; the audit itself does not authorize runtime behavior.

## Change discipline

If any bound specification, fixture, validator, or direct workflow changes, this contract must be reviewed and its `bound_sha256` / `binding_digest` updated deliberately.

The validator rejects silent drift.

Historical `origin_sha256` values remain tied to the original layer commit and are not rewritten when a later compatible artifact version is accepted.

This preserves the distinction:

`Historical Origin != Current Accepted Binding`

## Transitive validation closure

`.github/workflows/kontur-game-companion-chain-validation.yml` runs when any Game Companion pilot artifact or Game Companion workflow changes.

It executes:

1. this dependency-contract validator;
2. Observational Lane validator;
3. Assistance Gate validator;
4. Shared Discovery Memory validator;
5. Bounded Initiative validator;
6. Focus Diversity validator;
7. Interaction Receipt validator;
8. Pause / Resume validator.

Thus a predecessor-only change has an effective CI path to every downstream validator without modifying six existing layer workflows independently.

## Non-effects

This contract and workflow do not authorize:

- live KONTUR response generation;
- proactive messaging or background activity;
- autonomous gameplay or account control;
- external effects;
- action permits or successor permits;
- behavioral, psychological, mood, or attention profiling;
- engagement or retention optimization;
- cross-game preference construction;
- total-history capture;
- automatic Stable Core promotion;
- release, tag, deployment, permission, or protection changes.

## Validation

Run from the repository root:

```bash
python pilots/kontur-game-companion/dependency-contract/validate.py
```

The validator checks exact layer identity/order, exact origin PR and commit provenance, origin ancestry, four artifact hashes per layer, layer binding digests, six adjacent edges, non-effects, and a fail-closed mutation suite.
