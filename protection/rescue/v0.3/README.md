# Project Survival Plane v0.3

This layer extends merged Project Survival Plane v0.2 with two capabilities that remain non-authoritative:

1. **Observer Deployment Attestation** — policy-bounded evidence that passive observers are deployed across sufficiently distinct operational domains; and
2. **Rescue Capsule** — a self-contained, hash-bound package of rescue evidence that can be verified without relying on the canonical GitHub origin being online.

It does not replace Project Rescue Protocol v0.1 or Survival Plane v0.2.

## Core boundary

`observer domain declared != deployment independently attested`

`deployment attested != physical independence universally proven`

`policy independence satisfied != loss confirmed`

`rescue capsule complete != rescue authorized`

`capsule verified != canonical successor`

`recovery evidence preserved != authority transferred`

## Observer Deployment Attestation

A passive observer from v0.2 already records declared observer and failure domains. v0.3 adds a separate attestation artifact so the observer does not attest its own independence.

An attestation binds:

- a stable observer identifier;
- the observer spec SHA-256;
- the attestor identity/domain as an opaque identifier;
- observer, failure, custodian, provider and network domain identifiers;
- evidence references and SHA-256 digests;
- issuance time and validity window;
- explicit non-authority claims.

The attestation contains no credentials and gives no mutation authority.

## Policy-bounded independence assessment

`observer_topology.py` evaluates a set of deployment attestations against a policy.

The reference policy requires at least:

- 2 attested observers;
- 2 distinct observer domains;
- 2 distinct failure domains;
- 2 distinct custodian domains;
- 2 distinct attestor domains;
- at least 2 attestation evidence classes;
- no expired attestation;
- no duplicate observer represented as multiple independent observers;
- every admitted attestation bound to evidence by SHA-256.

Provider/network diversity is measured and reported. The reference policy requires provider diversity but records network diversity separately because the latter may be difficult to establish from durable evidence alone.

A successful assessment may set:

`independence_sufficient_for_policy = true`

It must still keep:

`universal_physical_independence_proven = false`

`loss_confirmed = false`

`rescue_eligible = false`

## Rescue Capsule

A Rescue Capsule is a local directory whose manifest binds exact file bytes. It is intended to survive canonical-origin unavailability.

A capsule can contain copies of artifacts such as:

- last-known-good frontier evidence;
- Continuity manifests;
- metadata snapshots/manifests;
- Prevention Registry snapshot/assessment;
- passive loss observations;
- observer deployment attestations;
- observer topology assessment;
- ProjectRescueCase;
- ProjectRescueAssessment;
- verified recovery-source manifests;
- KONTUR read-only ledger replica manifests.

The capsule builder accepts only local files. It does not fetch remote resources, push Git refs, open a rescue case, execute recovery, or activate KONTUR.

Each included item records:

- a logical role;
- original source label supplied by the operator;
- stored capsule-relative path;
- exact byte size;
- SHA-256 digest.

The manifest is itself self-digested. `CAPSULE_COMPLETE` is written last.

## Capsule verification

Verification fails closed if:

- the manifest is malformed;
- a listed file is missing;
- any file size differs;
- any SHA-256 differs;
- duplicate stored paths exist;
- the capsule manifest self-digest differs;
- `CAPSULE_COMPLETE` is absent or inconsistent.

Verification does not infer that the evidence is true. It proves only that the capsule is internally consistent with the bytes sealed by its manifest.

## Recommended evidence flow

```text
Passive Observer Specs v0.2
          |
          v
Deployment Attestations v0.3
          |
          v
Observer Topology Assessment
          |
          +--------------------+
                               |
Prevention Registry -----------+----> ProjectRescueCase v0.1
Passive Observations ----------+             |
Recovery-source manifests -----+             v
                                             rescue_assessor.py
                                                     |
                                                     v
                                             human authorization

All relevant immutable artifacts
          |
          v
     Rescue Capsule
          |
          v
 offline/local verification
```

## Security boundary

Never put into attestations or capsules:

- passwords;
- TOTP seeds;
- recovery codes;
- private passkey material;
- PATs;
- SSH private keys;
- authenticated cookies/sessions;
- credential-bearing URLs.

A capsule may contain public or already-safe evidence artifacts. It is not a secret vault.

## Non-goals

v0.3 does not:

- automatically monitor continuously;
- confirm project loss by itself;
- authorize rescue;
- restore a repository;
- push to any remote;
- choose a new canonical origin;
- transfer ownership;
- activate KONTUR;
- establish distributed consensus;
- establish legal effect;
- certify universal truth.
