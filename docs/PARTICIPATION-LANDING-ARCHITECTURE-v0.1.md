# GitHub Pages Participation Landing Architecture v0.1

**Status:** implemented non-normative participation surface  
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

## Pages source binding

The active Pages deployment path is now repository-verifiable in `.github/workflows/poai-pages.yml`:

- the workflow checks out `main`;
- `actions/upload-pages-artifact@v4` uploads the full `docs/` directory;
- `actions/deploy-pages@v4` deploys that artifact;
- pushes to `main` affecting `docs/**` trigger the deployment.

Therefore the participation route is implemented additively as `docs/participate/index.html`, which maps to `/uu-aap/participate/` while leaving `docs/poai/` and `/uu-aap/poai/` unchanged.

## Pages landing content

The `/participate/` landing contains only:

1. one-sentence project orientation;
2. **review without coding** → Issue #422;
3. newcomer-path smoke test → Issue #774;
4. PoAI Web Verifier smoke test → Issue #775;
5. UU-AAP discussion → Discussion #8;
6. PoAI discussion → Discussion #10;
7. `good first issue` links;
8. links back to canonical repository records;
9. an explicit non-normative boundary.

It does not duplicate `SPEC.md` or protocol semantics.

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

`/participate/` remains an additive sibling route under the same `docs/` Pages artifact. Changes to it must not replace, rewrite, or alter `/poai/`.

A successful Pages deployment proves only that the static participation surface was published. It does not create external review evidence, protocol approval, release authority, or certification.
