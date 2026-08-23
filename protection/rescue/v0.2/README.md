# Project Survival Plane v0.2

This layer extends Project Rescue Protocol v0.1 with two earlier control planes:

1. a machine-readable Prevention Registry; and
2. passive, non-mutating observation artifacts.

It does not replace v0.1. It feeds evidence into v0.1 while keeping rescue and authority decisions separate.

## Core boundary

`preventer registered != preventer verified`

`preventer verified != preventer currently available`

`observer negative != loss confirmed`

`observer domains declared != independence proven`

`rescue eligible != rescue authorized`

`replica available != canonical successor`

## Prevention Registry

The registry records each known continuity/prevention capability before a loss event happens.

Each entry carries:

- a stable `preventer_id`;
- a typed `preventer_type`;
- whether it is mandatory before rescue;
- a `custodian_domain_id` and `failure_domain_id`;
- current availability state;
- latest verification time and SHA-256 evidence binding when verified;
- a bounded attempt history;
- whether the capability can mutate canonical state (reference entries must not);
- explicit false claims for authority transfer and canonical succession.

Reference preventer types include:

- `alternate_canonical_read_path`;
- `standby_human_or_collaborator_path`;
- `provider_recovery_or_support_path`;
- `known_good_frontier_verification`;
- `local_git_bundle_or_mirror`;
- `independent_second_remote`;
- `metadata_snapshot`;
- `kontur_readonly_ledger_replica`.

The registry is descriptive and evidentiary. It does not execute recovery actions.

## Preventer state

Availability is one of:

- `available`;
- `degraded`;
- `unavailable`;
- `unverified`;
- `retired`.

Attempt state is one of:

- `not_attempted`;
- `succeeded`;
- `failed`;
- `blocked`;
- `not_applicable`.

A mandatory preventer that is available but not attempted remains a rescue blocker. A successful preventer restores continuity and also blocks rescue escalation. Failed/blocked/not-applicable preventers may be admitted into the v0.1 rescue case only with evidence.

## Passive observers

An observer never changes the target it observes.

The reference observer runner supports only read-side probes:

- `file_sha256` for local/offline content anchors;
- `http_head` / `http_get` for unauthenticated public read paths;
- `git_ls_remote` for Git refs without push.

Credential-bearing URLs are rejected. The runner has no token/header input and no POST/PUT/PATCH/DELETE mode.

Each observation records:

- observer identity;
- declared observer and failure domains;
- evidence class;
- probe method;
- target subject;
- timestamp;
- result and indicator;
- observed frontier/content digest when applicable;
- SHA-256 of the normalized evidence payload.

The artifact explicitly states that domain independence is declared but not cryptographically proven by the runner itself. Independence must come from deployment topology, distinct custodians, separate networks/providers, or later attestations.

## Feeding Project Rescue Protocol v0.1

The v0.2 layer does not decide loss. It produces typed evidence that can be converted into v0.1 `ProjectRescueCase` observations and preventer records.

Recommended sequence:

```text
prevention registry
      |
      +--> periodic verification receipts
      |
passive observers
      |
      +--> read-only observations
      |
      v
ProjectRescueCase v0.1
      |
      v
rescue_assessor.py
      |
      v
human authorization boundary
```

## Security rules

Do not store:

- passwords;
- TOTP seeds;
- recovery codes;
- passkey private material;
- PATs;
- SSH private keys;
- authenticated browser cookies/sessions;
- credential-bearing URLs.

Registry and observer artifacts may contain abstract custodian/observer identifiers but not authentication secrets.

## Reference CLI

Summarize a registry:

```bash
python3 protection/rescue/v0.2/prevention_registry.py summarize \
  --registry protection/rescue/v0.2/reference.prevention-registry.json
```

Run a passive observer:

```bash
python3 protection/rescue/v0.2/passive_observer.py observe \
  --spec observer-spec.json \
  --out observation.json
```

The reference implementation uses only the Python standard library plus the local `git` executable for `git_ls_remote` probes.

## Non-goals

This layer does not:

- auto-open a rescue case;
- declare project loss;
- create a canonical successor;
- transfer ownership;
- push to any Git remote;
- activate KONTUR;
- grant execution authority;
- establish distributed consensus;
- establish legal effect or universal truth.
