# UU-AAP Continuity v0.3 — disposable offline restore drill

**Status:** experimental repository-continuity layer  
**Scope:** healthy/pre-loss verification that a Continuity v0.1 Git bundle can reconstruct the exact captured Git ref set in a disposable local repository.

This layer closes one specific gap left explicit by Continuity v0.2:

```text
backup present != recovery tested
```

It does **not** replace or invoke `protection/rescue/**`.

## Purpose

Continuity v0.1 can create a SHA-256-bound Git bundle and manifest. Continuity v0.2 can capture hosted metadata and compare remote ref maps. Continuity v0.3 asks a narrower operational question before any loss event:

> Can the captured bundle, by itself and without network access, reconstruct the captured Git objects and refs exactly enough to be independently verified?

The drill:

1. reads a Continuity v0.1 manifest and its adjacent bundle;
2. verifies the bundle SHA-256;
3. runs `git bundle verify`;
4. compares the manifest ref map with the bundle-advertised ref map;
5. reconstructs the bundle into a **temporary bare repository**;
6. runs `git fsck --full` on the temporary repository;
7. compares the reconstructed ref map with the captured ref map;
8. requires the reconstructed `refs/heads/<main_branch>` to equal the manifest's exact captured main SHA;
9. emits a bounded JSON receipt;
10. destroys the temporary restored repository on exit.

No network operation is required or permitted by the drill tool.

## Boundary with Rescue

This is a healthy/pre-loss continuity test, not a rescue transition.

```text
bundle verifies != restore drill succeeded
restore drill succeeded != rescue performed
restore drill succeeded != RECOVERED_NONCANONICAL
restore drill succeeded != continuation workspace created
restore drill succeeded != canonical successor
restore drill succeeded != authority transfer
restore drill succeeded != KONTUR readiness
restore drill succeeded != KONTUR activation
```

`RECOVERED_NONCANONICAL` remains reserved for the bounded Rescue protocol. Continuity v0.3 never emits that state and never creates a persistent recovered repository.

## Usage

Given an existing Continuity v0.1 capture:

```bash
python3 protection/continuity/v0.3/restore_drill.py drill \
  --manifest /secure/uu-aap/captures/<timestamp>/continuity-manifest.json \
  --out /secure/uu-aap/drills/restore-drill-receipt.json
```

The receipt is successful only when all exact comparisons pass.

Validate an already-produced receipt structurally and semantically:

```bash
python3 protection/continuity/v0.3/restore_drill.py validate-receipt \
  --receipt /secure/uu-aap/drills/restore-drill-receipt.json
```

## Receipt semantics

A positive receipt may establish only:

```text
bundle_digest_verified = true
bundle_integrity_verified = true
captured_refs_match_bundle = true
restored_refs_match_capture = true
restored_main_matches_capture = true
restored_repository_fsck_passed = true
restore_drill_verified = true
```

It must retain:

```text
rescue_performed = false
recovered_noncanonical_state_created = false
persistent_recovery_workspace_created = false
canonical_successor_claimed = false
authority_transferred = false
repository_ownership_transferred = false
kontur_readiness_established = false
kontur_activated = false
execution_authority_granted = false
distributed_consensus_claimed = false
legal_effect_established = false
truth_certified = false
```

## Offline meaning

`offline_capable = true` means the drill implementation itself needs only local files plus the local `git` executable. It does **not** prove that an operator actually stored a copy on physically offline media, that media will survive a disaster, or that independent custodians are available.

```text
offline-capable tool != offline copy observed
restore drill success != physical independence proven
```

Those remain operator-evidence questions.

## Relationship to v0.1 and v0.2

```text
v0.1 capture/bundle
    -> v0.3 disposable restore drill

v0.2 metadata snapshot
    -> separate hosted-context continuity evidence

v0.2 mirror exact-match
    -> separate remote-replica observation
```

The v0.3 receipt does not claim hosted metadata restoration. Git bundle continuity and GitHub-hosted metadata continuity remain distinct evidence classes.
