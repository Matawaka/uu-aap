# GitHub Pages Participation Landing Architecture v0.1

**Status:** non-normative participation-surface architecture  
**Scope:** GitHub navigation and onboarding only

## Purpose

Create a low-friction path from project discovery to one bounded action without duplicating normative protocol text.

## Route model

| Surface | Role | Canonical? |
| --- | --- | --- |
| README | repository overview + first call to action | navigation only |
| `START-HERE.md` | participation router | no |
| Pages `/participate/` | human-facing landing | no |
| Pages `/poai/` | existing PoAI verifier | existing role unchanged |
| Issues / Discussions | review, discussion, implementation entry | no protocol authority |

## Pages landing content

The future `/participate/` landing should contain only:

1. one-sentence project orientation;
2. **review without coding** → Issue #422;
3. UU-AAP discussion → Discussion #8;
4. PoAI discussion → Discussion #10;
5. `good first issue` / `help wanted` links;
6. links back to canonical repository records;
7. an explicit non-normative boundary.

It should not duplicate `SPEC.md` or protocol semantics.

## Non-interference boundary

This participation layer changes no:

- `SPEC.md` / `PRINCIPLES.md` semantics;
- schemas;
- runtime, executor, or permission semantics;
- conformance profiles;
- release/checkpoint semantics;
- canonical-state records;
- behavior of the existing `/poai/` verifier.

`participation surface != protocol authority`

`Pages != canonical specification`

`issue label != evidence standing`

`navigation copy != normative text`

## Failure boundary

Pages may fail, move, or be redesigned without changing:

- protocol conformance;
- canonical repository state;
- release authority;
- runtime activation;
- ActionPermit or any permission ceiling.

## Deployment rule

A live `/participate/` route may be added only as an additive route once the active Pages source is identified with sufficient confidence. It must not replace, rewrite, or alter `/poai/`.

The current v0.1 implementation therefore records the landing architecture but deliberately leaves the existing live Pages deployment unchanged.
