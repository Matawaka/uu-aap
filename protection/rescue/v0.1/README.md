# Project Rescue Protocol v0.1

This directory defines the first fail-closed rescue eligibility layer for UU-AAP / Proof of Available Intelligence.

The protocol exists to answer one narrow question:

> When may a human reasonably conclude that ordinary preservation/recovery controls are no longer sufficient and that a non-canonical rescue reconstruction may be started from verified evidence?

It does **not** automatically recover, transfer, fork, or replace canonical authority.

## Core rule

`unavailable != destroyed`

`loss suspected != loss confirmed`

`loss confirmed != rescue authorized`

`rescue authorized != canonical succession`

`recovered copy != canonical successor`

## Rescue ladder

The protocol models a monotonic evidence ladder with reversible early states:

1. `healthy`
2. `degraded`
3. `loss_suspected`
4. `loss_confirmation_pending`
5. `loss_confirmed`
6. `rescue_eligible`
7. `rescue_authorized` (separate human artifact; no automatic transition in v0.1)
8. `recovered_noncanonical` (future typed execution protocol)
9. `canonical_succession_pending` (future typed authority protocol)

A return to `healthy` is valid from the early states when independent evidence shows that canonical availability/control/integrity has returned.

## Independent evidence

Multiple failed checks from one provider, one machine, one network, or one credential path do not count as independent confirmation.

Every observation carries:

- an `evidence_class`;
- an `observer_domain_id`;
- a `failure_domain_id`;
- a subject and result;
- a timestamp;
- a SHA-256 evidence digest;
- a typed indicator.

The reference policy requires negative evidence across multiple classes and multiple failure domains. Pure unavailability needs a longer persistence window than explicit destructive evidence.

Example evidence classes:

- `canonical_read_path` — Git/HTTP/API read access to the canonical repository;
- `canonical_control_path` — owner/admin/collaborator control-plane access;
- `provider_status_path` — provider status/support signal;
- `independent_replica_path` — a separately held mirror/bundle/replica;
- `independent_human_custodian` — a second human custodian's independent observation;
- `external_content_anchor` — an external digest/tag/release/provenance anchor.

## Loss types

The protocol distinguishes:

- availability loss;
- authority/control loss;
- integrity/frontier loss;
- destructive loss (object absent/replaced or provider-confirmed deletion);
- unknown/transient outage.

The assessor never treats one HTTP error or one login failure as project destruction.

## Preventers before rescue

A rescue case records the state of prior non-destructive preventers. The reference policy includes:

- alternate canonical read path;
- second human/collaborator access;
- provider recovery/support path;
- verified local Git bundle/mirror;
- independent second remote when present;
- GitHub metadata snapshot when present;
- KONTUR read-only ledger replica when relevant;
- last-known-good frontier/protected tag evidence.

Mandatory preventers must be either:

- `succeeded` — which blocks rescue because continuity was restored;
- `exhausted`;
- `blocked`;
- `not_applicable` when the policy allows it.

`available_not_attempted` blocks `rescue_eligible`.

## Recovery source requirement

Loss confirmation alone is not enough. `rescue_eligible` additionally requires at least one independently verified recovery source bound by SHA-256 and a known-good frontier.

Examples:

- verified `git bundle`;
- verified bare mirror;
- independently verified second remote;
- release/protected-tag-bound archive;
- read-only KONTUR ledger replica for the ledger evidence plane.

## Human authorization boundary

`project-rescue-authorization.schema.json` defines a human authorization artifact that may bind:

- the exact rescue assessment digest;
- the selected verified recovery source;
- a narrow recovery scope;
- an expiry time and nonce.

The authorization explicitly keeps these false:

- canonical successor established;
- ownership transferred;
- KONTUR activated;
- distributed consensus established;
- legal effect established;
- truth certified.

v0.1 contains **no restore executor** and performs no remote mutation.

## Reference decision logic

The reference policy requires, at minimum:

- 3 negative observations;
- 3 independent evidence classes;
- 2 observer domains;
- 2 failure domains;
- both a canonical data/read-path signal and a control/custodian signal;
- a known-good frontier or external content anchor;
- either:
  - an explicit destructive indicator, or
  - pure unavailability persisting for the configured prolonged-loss window;
- mandatory preventers exhausted/blocked/not-applicable;
- at least one verified recovery source.

These numbers are policy inputs, not universal truths.

## CLI

```bash
python3 protection/rescue/v0.1/rescue_assessor.py evaluate \
  --policy protection/rescue/v0.1/reference.project-rescue-policy.json \
  --case rescue-case.json \
  --out rescue-assessment.json
```

The assessor is deterministic, local, read-only, and uses only Python standard library.

## Security boundary

Never place in rescue artifacts:

- passwords;
- TOTP seeds;
- recovery codes;
- passkey private material;
- PATs;
- SSH private keys;
- authenticated browser cookies/sessions.

Evidence may identify an abstract observer/custodian ID, but must not contain authentication secrets.
