# UU-AAP Continuity Copy Placement Plan v0.1

**Status:** experimental prepare-only continuity layer  
**Scope:** deterministic planning of a distributed copy topology and the evidence an operator must later collect.

This layer does not create copies, accounts, remotes, credentials, custodians, or provider resources. It converts the existing Continuity v0.1 policy into an explicit human-executable placement plan bound to one exact repository frontier.

## Problem

A continuity policy can say that three independent copies and two custodians are required, but that still leaves operational ambiguity:

```text
policy requirement != placement plan
placement plan != copy created
copy created != copy verified
copy verified != independence proven
```

This layer removes the first ambiguity only.

## Deterministic plan

`copy_placement_plan.py` accepts only:

- exact `main` commit SHA;
- exact tree SHA.

It emits a deterministic JSON plan containing:

- the unchanged Continuity v0.1 thresholds;
- three required copy roles;
- at least two custodian roles;
- one mandatory offline role;
- distinct-storage-domain requirements;
- distinct credential-domain requirements where credentials exist;
- evidence fields to collect for each copy;
- pairwise independence evidence requirements for all three copy pairs;
- explicit authority and KONTUR boundaries;
- a deterministic SHA-256 plan digest.

No wall clock or network state is used, so the same frontier produces the same plan bytes.

## Copy roles

The reference topology uses three abstract roles, not real locations:

1. `active-local-copy` — operator-accessible continuity capture;
2. `sealed-offline-copy` — physically disconnected/offline continuity capture;
3. `independent-secondary-copy` — a third storage domain distinct from the first two.

These are constraints, not assertions that such copies already exist.

The plan deliberately uses abstract `custodian-role-a` and `custodian-role-b`. It does not contain names, emails, account IDs, home addresses, passwords, recovery codes, tokens, private keys, TOTP seeds, passkeys, session data, or other secrets.

## Required evidence

For every copy role, the operator is instructed to record later:

- exact source `main` SHA;
- exact source tree SHA;
- continuity capture manifest SHA-256;
- verification evidence SHA-256;
- capture timestamp;
- verification timestamp;
- metadata-backup presence;
- declared storage-domain ID;
- declared custodian-domain ID;
- declared credential-domain ID or null;
- whether the copy is offline.

For the three pairs `(A,B)`, `(A,C)`, `(B,C)`, separate independence evidence is required.

## Security boundary

```text
plan generated != operator acted
operator acted != copy verified
copy verified != continuity guaranteed
copy placement != authority transfer
copy placement != rescue authorization
copy placement != failover authorization
copy placement != canonical succession
copy placement != KONTUR readiness
copy placement != KONTUR activation
```

The plan schema requires:

- `human_completion_required=true`;
- `copies_claimed_present=false`;
- `provider_mutation_authorized=false`;
- `external_execution_authorized=false`;
- `authority_transferred=false`;
- `rescue_authorized=false`;
- `failover_authorized=false`;
- `canonical_successor_claimed=false`;
- `kontur_activation_authorized=false`.

The generator performs no network access, subprocess execution, Git mutation, filesystem mutation, provider write, secret retrieval, CHSP action, Rescue action, or KONTUR call.

## Usage

```bash
python3 protection/continuity/placement/v0.1/copy_placement_plan.py \
  --main-sha <40-hex-main> \
  --tree-sha <40-hex-tree>
```

Redirect the output to a local file if desired. The repository tool itself only writes JSON to stdout.

## Relationship to evidence assessment

A completed placement plan may later supply operator-collected evidence to a separate copy-set evidence assessment layer. This plan does not depend on that assessor and does not claim that any evidence has been collected.
