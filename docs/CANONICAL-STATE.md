# Canonical Repository State

**Status date:** 2026-08-23  
**Scope:** repository provenance, licensing and checkpoint navigation for `Matawaka/uu-aap`.

This document is a non-normative repository-state index. It does not change UU-AAP v0.1 conformance, frozen CCRP v0.1 semantics, PoAI authority artifacts, or any historical checkpoint.

## Canonical project origin

**Project:** UU-AAP — Augmented Authorship & Accountability Protocol  
**Canonical repository:** https://github.com/Matawaka/uu-aap  
**Initial proposer/editor:** Kuznetsov Dmitrii Olegovich (Кузнецов Дмитрий Олегович), GitHub `@Matawaka`.

A copy, fork, mirror, archive, package, publication or model output does not become a canonical successor merely by reproducing repository content.

`copy != canonical origin`

`fork != canonical successor`

## Release and checkpoint anchors

The following tag-to-commit bindings were verified against the canonical repository state on 2026-08-23:

| Tag | Repository-scoped role | Exact commit |
| --- | --- | --- |
| `v0.1` | first public draft / release anchor | `16f83e655b80d1dabcd1d6b7533dc823796c767c` |
| `poai-authority-exp-v0.1` | PoAI authority-root experimental checkpoint | `2424e61846fd262f9c01ccc406931683d3c6e616` |
| `poai-ccrp-exp-v0.1` | frozen CCRP v0.1 experimental checkpoint | `33215e251310105e2fac591b17ae2d90522488d9` |
| `uu-aap-product-protection-v0.1` | product provenance, attribution and responsibility checkpoint | `66cbeb97b512bc3d09babdfb43fbd4339bae4dda` |
| `uu-aap-licensing-v0.1` | finalized open-licensing package checkpoint | `541d345432de851b198fa459cb33447c096aebe7` |

Historical tags identify historical states; later edits on `main` do not redefine those states.

The repository policy designates release/checkpoint anchors as immutable reference points. GitHub Rulesets are administrative controls rather than committed cryptographic evidence, so exact current enforcement must be checked in repository settings by an administrator. The tag/commit bindings above remain independently inspectable in Git history.

## Checkpoint manifests

Repository-scoped checkpoint manifests currently include:

- [`protection/checkpoints/product-provenance-responsibility-v0.1.json`](../protection/checkpoints/product-provenance-responsibility-v0.1.json) — binds the product-provenance, attribution and responsibility hardening state;
- [`protection/checkpoints/open-licensing-v0.1.json`](../protection/checkpoints/open-licensing-v0.1.json) — binds the finalized open-licensing package.

Earlier PoAI/CCRP checkpoints remain preserved under their own tagged repository history and proposal/experiment records.

## Current provenance and responsibility documents

- [`NOTICE.md`](../NOTICE.md) — canonical origin, attribution and anti-impersonation boundary;
- [`RESPONSIBILITY.md`](../RESPONSIBILITY.md) — responsibility-laundering boundary and attributable-action model;
- [`CITATION.cff`](../CITATION.cff) — machine-readable project citation;
- [`GOVERNANCE.md`](../GOVERNANCE.md) — repository governance model;
- [`SECURITY.md`](../SECURITY.md) — security, privacy and assurance limits;
- [`FILE_HASHES.md`](../FILE_HASHES.md) — release/checkpoint integrity-anchor policy.

## Finalized open licensing

The repository uses the licensing map in [`LICENSE.md`](../LICENSE.md):

- non-software content → **Creative Commons Attribution 4.0 International (`CC-BY-4.0`)**;
- software and implementation content → **Apache License 2.0 (`Apache-2.0`)**;
- file-specific and third-party notices override repository defaults;
- third-party material is not silently relicensed by inclusion in the repository;
- intentional contributions use the applicable outbound license under the contribution policy in [`CONTRIBUTING.md`](../CONTRIBUTING.md), unless explicitly stated otherwise or separately agreed.

Canonical license texts are stored in [`LICENSES/`](../LICENSES/).

`permission to copy != canonical succession`

`open license != endorsement`

`commercial implementation != official implementation`

## Repository review controls and CODEOWNERS

The repository contains [`.github/CODEOWNERS`](../.github/CODEOWNERS) with repository-scoped ownership routing:

`* @Matawaka`

That file is review metadata; it does not itself prove that GitHub requires a code-owner approval before merge, and it does not assert intellectual-property ownership.

At the current single-code-owner stage, this repository does not treat mandatory independent CODEOWNERS approval as a completed assurance unless a safe independent-reviewer or explicit bypass model is configured. A pull-request author cannot be relied upon to provide independent approval of their own change, so enabling a strict code-owner gate with only one eligible reviewer can create a governance deadlock rather than stronger assurance.

The repository's validation path includes the following named checks for protected changes where the applicable GitHub Ruleset requires them:

- `PoAI Genesis validation`;
- `PoAI Authority Root validation`;
- `CCRP validation`;
- `PoAI CCRP pre-materialization validation`.

Administrative Ruleset configuration is not a substitute for committed provenance and is not represented here as cryptographic proof.

## What this state does not establish

Neither repository history, tags, checkpoints, licenses nor administrative protection settings by themselves establish:

- legal identity;
- adjudicated copyright ownership;
- universal legal or governance authority;
- factual truth;
- causality;
- moral correctness;
- responsibility for third-party downstream actions;
- universal canonicality outside this repository lineage;
- PoAI/V conformance unless separately established by the applicable protocol evidence.

`attribution != legal ownership adjudication`

`provenance preserved != truth certified`

## Update policy

This file may be updated on `main` as the repository evolves. Historical release and checkpoint meaning must be recovered from the exact tagged commits and their bound artifacts, not from a later version of this index.

When a new immutable release/checkpoint is created, update this index and `FILE_HASHES.md` by normal pull-request review rather than rewriting an existing tag target.
