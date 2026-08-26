# KONTUR Game Companion External Sandbox Sidecar Ingest v0.1

Status: **runnable / external read-only / completed sanitized sessions only**.

This optional adapter is the first deliberately external trial surface after the local
synthetic trial pilot. It consumes exactly three bounded JSON files from a separately
materialized `KONTUR_PILOT_INFO` sidecar and emits one normalized receipt to stdout.

It does not read raw game logs, attach to a game process, read process memory, inspect
network traffic, capture the screen or audio, emulate input, modify the game or sidecar,
generate a recommendation, send a message, or start a background task.

## Placement

```text
... -> Local Synthetic Trial Pilot
    -> explicit human decision for this completed sidecar session
    -> External Sandbox Sidecar Ingest (this package)
    -> HUMAN NEW OBSERVATION SESSION START DECISION REQUIRED
```

`External Read Completed != Live Observation Authorized`.

## Read boundary

The adapter reads only:

```text
KONTUR_PILOT_INFO/runtime-collection-policy.json
KONTUR_PILOT_INFO/sessions/<explicit-session-id>/session-start.json
KONTUR_PILOT_INFO/sessions/<explicit-session-id>/session-final.json
```

The sidecar root and every selected component must be a real directory or regular file,
not a symlink or Windows reparse point. Each file is capped at 256 KiB. The session ID,
policy digest, schemas, provenance, privacy markers, non-effects, and bounded aggregate
vocabulary are validated before a receipt is emitted. Absolute paths are never included
in the receipt.

## Safe default

```text
python pilots/kontur-game-companion/external-sandbox-sidecar-ingest/run.py --scenario safe-default --pretty
```

Expected decision:

`EXTERNAL_SANDBOX_INGEST_NOT_STARTED`

## Explicit external run

Run only after the game has stopped and choose one completed session explicitly:

```text
python pilots/kontur-game-companion/external-sandbox-sidecar-ingest/run.py --scenario external-read-only --sidecar-root "<Release>/KONTUR_PILOT_INFO" --session-id "<completed-session-id>" --expected-policy-sha256 "<64-hex-policy-digest>" --human-decision ALLOW_THIS_READ_ONLY_COMPLETED_SIDECAR_INGEST --confirm-game-stopped --confirm-read-only-completed-session --confirm-no-raw-log-process-network-or-write --pretty
```

Expected success decision:

`READ_ONLY_COMPLETED_SIDECAR_SESSION_INGESTED`

The command is single-shot and exits after printing one JSON receipt. It performs no
automatic retry and creates no persistent output.

## Core boundaries

- `Human Decision For This Read != General External Authority`
- `Completed Session Receipt != Live Game State`
- `Sidecar Read != Game Process Access`
- `Sanitized Aggregate != Raw Log`
- `Observed Term Count != Player Intent`
- `Receipt != Recommendation`
- `External Connectedness != Send Permit`
- `Successful Ingest != Next Session Authority`
- `Read Effect != ActionPermit`
- `Read Effect != Successor Permit`
- `Optional Adapter != Stable-Core Requirement`

## Copyright and IP-process isolation

This adapter has no dependency on licensing, copyright, patent, legal-author-identity,
or pseudonym-publication processes. It cannot request or record changes to them, and no
related repository or external-environment artifact is modified.

## Validation

`validate.py` uses a repository-owned synthetic sidecar fixture, verifies the executable
CLI, proves deterministic normalized receipts, confirms the fixture is unchanged by the
read, and rejects path, provenance, privacy, effect, authority, and output mutations fail
closed. The dedicated workflow does not touch a real external environment.
