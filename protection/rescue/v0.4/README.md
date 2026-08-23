# Project Survival Plane v0.4 — Rescue Execution Envelope

This layer adds the first bounded execution path after Project Rescue Protocol v0.1 and Survival Plane v0.2/v0.3.

It answers one narrow question:

> Given an already `rescue_eligible` assessment, an explicit unexpired human rescue authorization, a verified Rescue Capsule, and an exact local recovery source, may the system reconstruct a non-canonical local Git copy without gaining canonical authority?

The reference answer is deliberately limited to one operation:

`verified local git bundle -> new local bare Git repository -> RECOVERED_NONCANONICAL`

## Core boundary

`rescue eligible != rescue authorized`

`rescue authorized != arbitrary execution`

`bounded execution != canonical succession`

`recovered repository != canonical repository`

`nonce consumed locally != globally consumed`

`successful recovery != KONTUR activation`

## Required chain

The executor requires all of the following:

1. a verified `RescueCapsuleManifest v0.3`;
2. exactly one capsule `rescue_assessment` item whose self-digest is valid and whose state is `rescue_eligible`;
3. a `ProjectRescueAuthorization v0.1` whose `assessment_sha256` exactly matches that assessment;
4. authorization scope containing `reconstruct_noncanonical_git_copy`;
5. authorization not expired at execution time;
6. a capsule `recovery_source_manifest` of type `RecoverySourceBinding v0.4` whose `source_id` equals the authorization's `selected_recovery_source_id`;
7. a local regular non-symlink Git bundle whose SHA-256 equals the recovery-source binding;
8. a destination path that does not yet exist;
9. a local durable execution state directory in which the authorization nonce has not previously been consumed.

Any missing or mismatching binding fails closed.

## Recovery source

v0.4 supports only `git_bundle` as executable recovery material.

The bundle payload is kept separate from the Rescue Capsule because the capsule is an evidence package and may remain compact. The capsule carries a `RecoverySourceBinding` with:

- `source_id`;
- payload SHA-256;
- expected frontier commit;
- failure-domain identifier;
- explicit non-canonical / no-authority-transfer claims.

At execution time the local payload must match that exact digest.

## Local execution only

The reference executor:

- accepts only local filesystem paths;
- rejects symlink source files;
- runs `git bundle verify` before recovery;
- creates only a bare repository;
- uses the local bundle as the only Git source;
- removes any remote configuration created during reconstruction;
- requires `git remote` to be empty before publication;
- runs `git fsck --full` on the recovered repository;
- requires the expected frontier commit to exist;
- computes a normalized recovered-ref-set SHA-256;
- publishes the result by temporary-directory rename;
- writes a `NON_CANONICAL_RECOVERY` marker and a self-digested execution receipt.

It does not checkout working-tree content.

## Nonce replay boundary

Before execution, the authorization nonce is reserved in a local `state-dir` using exclusive file creation.

Once reservation succeeds, that nonce remains consumed even if execution later fails. This is intentionally fail-closed.

The protection claim is narrow:

`replay prevented within this state-dir != distributed/global replay prevention`

Copying or deleting the state directory can defeat the local replay history. A future distributed authority layer would be required for stronger guarantees.

## Output state

A successful output directory contains:

- `repository.git/` — recovered bare repository;
- `NON_CANONICAL_RECOVERY` — explicit boundary marker;
- `rescue-execution-receipt.json` — self-digested receipt.

The receipt records the exact authorization, assessment, capsule, recovery source, payload, recovered frontier and recovered ref-set digests.

A positive receipt may claim:

- human authorization was validated for the narrow execution scope;
- a non-canonical recovery was executed;
- the recovered repository passed local integrity checks;
- no Git remotes remain.

It must keep false:

- canonical successor established;
- ownership transferred;
- KONTUR activated;
- distributed consensus established;
- global replay prevention established;
- legal effect established;
- truth certified.

## CLI

Prepare/validate without recovery:

```bash
python3 protection/rescue/v0.4/rescue_execution.py preflight \
  --capsule-dir <capsule> \
  --authorization <authorization.json> \
  --payload <recovery.bundle> \
  --policy protection/rescue/v0.4/reference.rescue-execution-policy.json \
  --at 2026-08-23T15:00:00Z
```

Execute locally:

```bash
python3 protection/rescue/v0.4/rescue_execution.py execute \
  --capsule-dir <capsule> \
  --authorization <authorization.json> \
  --payload <recovery.bundle> \
  --destination <new-recovery-dir> \
  --state-dir <durable-local-state-dir> \
  --policy protection/rescue/v0.4/reference.rescue-execution-policy.json
```

## Non-goals

v0.4 does not:

- create or select a canonical successor;
- write to the canonical repository;
- push to any Git remote;
- use HTTP/SSH/network recovery sources;
- transfer repository ownership;
- activate or modify KONTUR;
- restore authenticated sessions or credentials;
- execute arbitrary commands from rescue artifacts;
- establish distributed consensus, legal effect, or universal truth.
