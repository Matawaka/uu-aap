# CHSP v0.6 — External Canonical Stewardship Binding Protocol

CHSP v0.6 maps an already-effective **CHSP protocol steward** to evidence about an external control-plane principal without transferring or creating external authority.

It starts only from a valid CHSP v0.5 stewardship state and execution receipt.

## Core chain

`v0.5 CHSP steward -> external principal claim -> independent control attestations -> binding proposal -> binding assessment`

The strongest v0.6 state is:

`binding_review_eligible -> external_binding_human_review_may_be_requested`

v0.6 deliberately has **no external executor**.

## Invariants

`CHSP steward != repository owner`

`external identity claim != identity proven`

`role observed != authority transferred`

`challenge-response verified != ownership adjudicated`

`binding proposal != external binding established`

`binding review eligible != external control transition authorized`

`external principal mapped != canonical origin mutated`

`external principal mapped != KONTUR activated`

## Evidence model

A `CHSPExternalPrincipalClaim` names one external principal and one claimed role for one exact v0.5 stewardship state.

Supporting facts are separate `CHSPExternalControlAttestation` artifacts. Reference evidence classes are:

- `identity_match`
- `role_visibility`
- `challenge_response`
- `signature_verification`
- `repository_metadata`

Results are `support`, `contradict`, or `indeterminate`.

Attestor-domain labels describe declared topology only. They do not prove absolute physical or organizational independence.

## Reference sufficiency

The reference policy requires at least:

- 3 supporting attestations;
- 2 declared observer domains;
- 2 distinct evidence classes;
- at least one strong-possession class: `challenge_response` or `signature_verification`;
- observations no older than 7 days;
- zero contradictory attestations.

These are reference thresholds, not universal identity or governance laws.

## External roles

A claim may describe `identity_only`, `collaborator`, `maintainer`, `admin`, `owner`, or `release_signer`.

The role is a **claimed/observed external fact**, not a right created by CHSP.

Even if evidence is sufficient, v0.6 keeps false:

- external binding established;
- external control transferred;
- repository ownership transferred;
- account control transferred;
- canonical origin mutated;
- canonical publication executed;
- KONTUR activated;
- legal ownership adjudicated;
- universal identity proven;
- distributed consensus established.

## Conflict rule

Any valid `contradict` attestation blocks review eligibility. An `indeterminate` attestation does not count as support.

Conflicts are preserved as evidence and must be resolved by later evidence or a new claim; they are never silently discarded.

## No credentials

Evidence artifacts contain only digests and descriptive observations. Passwords, PATs, session cookies, passkeys, TOTP seeds, recovery codes, SSH private keys, or other secrets must not be embedded.

## No external mutation

The reference implementation is local-only. It performs no GitHub API calls, Git operations, network requests, account changes, repository mutations, canonical publication, ownership transfer, or KONTUR action.
