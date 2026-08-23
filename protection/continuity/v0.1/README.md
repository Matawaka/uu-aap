# UU-AAP Project Continuity Layer v0.1

**Status:** experimental continuity hardening  
**Scope:** repository survival, independent recoverability, account continuity, and pre-KONTUR distribution hardening  
**Canonical repository:** `https://github.com/Matawaka/uu-aap.git`

## Purpose

This layer reduces single-point-of-failure risk without creating a second canonical authority.

Core invariants:

```text
copy != canonical successor
replica != authority transfer
standby account != shared identity
backup available != backup verified
recovery possible != recovery exercised
```

It protects against:

- temporary or permanent loss of GitHub availability;
- loss of access to the primary GitHub account;
- loss or failure of one workstation or Codex environment;
- accidental ref movement or upstream deletion;
- loss of transient conversational or execution context;
- inability to reconstruct exact Git release/checkpoint history from memory alone.

It does **not** establish distributed consensus, legal succession, KONTUR activation, universal canonicality, or automatic authority transfer.

## Minimum continuity target

The reference policy requires:

1. at least **3 independent repository copies**;
2. at least **2 independent human custodians**;
3. at least **1 offline copy**;
4. **no shared GitHub credentials**;
5. a continuity capture at least every **7 days** and after important releases/checkpoints;
6. a full verification at least every **30 days**;
7. separate backup of non-Git GitHub metadata;
8. a read-only KONTUR ledger replica before any future live activation.

See `reference.continuity-policy.json`.

## Recommended topology

```text
                    canonical GitHub origin
                             |
             +---------------+---------------+
             |                               |
     primary local mirror              independent remote
             |                               |
      dated Git bundles                 standby custodian
             |
      offline encrypted copy
```

The independent remote or standby copy must not be represented as a canonical successor merely because it contains identical bytes.

## Account continuity boundary

For a personal-account-owned GitHub repository, the owner remains a single administrative authority. A collaborator can preserve contribution capability, but is not a second owner of the personal account.

Therefore:

- never share the primary account password, TOTP secret, recovery codes, passkeys, PATs, SSH private keys, or browser session;
- use a separate standby person's GitHub account with its own email, password, MFA, passkey/security key and recovery material;
- use collaborator access for operational continuity;
- use GitHub's successor mechanism for long-term public-repository succession where appropriate;
- consider migration to a GitHub organization when true multi-owner administrative continuity is required.

The standby custodian must be able to restore project bytes independently without impersonating the primary account.

## Local continuity capture

`continuity.py` performs only Git reads against the source repository. It never pushes, changes remote refs, changes GitHub settings, or activates KONTUR.

Example:

```bash
python protection/continuity/v0.1/continuity.py capture \
  --repo https://github.com/Matawaka/uu-aap.git \
  --root /path/to/uu-aap-continuity \
  --expected-main <verified-main-sha>
```

The command creates:

```text
uu-aap-continuity/
  mirror/uu-aap.git/
  captures/
    <UTC timestamp>/
      uu-aap-<UTC timestamp>.bundle
      continuity-manifest.json
      continuity-manifest.sha256
      CAPTURE_COMPLETE
```

Each capture records:

- exact `main` commit;
- exact `main` tree;
- all visible Git refs;
- all tags and their resolved commits;
- `git fsck --full` success;
- `git bundle verify` success;
- bundle SHA-256;
- previous local capture manifest SHA-256 when one exists;
- explicit non-authority/non-canonicality boundaries.

Upstream ref deletion is intentionally not pruned from the working mirror by the capture tool. Dated bundles must never be overwritten.

## Verification

```bash
python protection/continuity/v0.1/continuity.py verify \
  --manifest /path/to/continuity-manifest.json
```

A successful result establishes only that the bundle still matches its recorded digest and is a valid Git bundle.

## Storage rule

Keep the three copies in different failure domains. A practical minimum is:

1. primary GitHub repository;
2. local encrypted disk/NAS copy;
3. encrypted removable or independent-cloud copy held separately.

Do not keep all three copies on the same computer, in the same cloud account, or behind the same credential set.

## What Git backup does not preserve

A Git mirror/bundle does not fully preserve:

- Issues and comments;
- Pull Request discussions/reviews beyond committed merge history;
- Discussions;
- Releases metadata and uploaded release assets;
- Actions run metadata/logs/artifacts;
- repository Rulesets/settings;
- account recovery state;
- ChatGPT/Codex conversational context.

These require a separate metadata continuity layer. v0.1 marks this as required but intentionally keeps it separate from Git-object preservation.

## Pre-KONTUR requirement

Before any future live KONTUR activation, create and test a read-only durable ledger replication path with at least one independently stored sealed copy. Replication must not grant execution authority and must not silently create distributed consensus semantics.

```text
KONTUR authoritative ledger
        |
        +--> sealed read-only replica A
        +--> sealed read-only replica B
```

A recovery drill must prove that a replica can be validated without mutating the authoritative ledger.
