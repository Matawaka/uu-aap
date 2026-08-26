# KONTUR Game Companion External Observation Session v0.1

Status: **bounded runtime candidate / explicit human start / sanitized log aggregates**.

This optional adapter starts one manually authorized Scrap Mechanic observation session.
It baselines existing `Logs/*.log` byte offsets before the human launches the game, reads
only later appended bytes, classifies lines in memory, and writes create-only sanitized
JSON receipts to an existing `KONTUR_PILOT_INFO` sidecar.

It does not launch or attach to the game, inspect game process memory or network traffic,
capture screen/audio, emulate input, modify game files, retain raw log lines or identifier
values, generate recommendations, send messages, or execute game actions.

## Direction

```text
completed sidecar ingest
  -> explicit human decision for one new observation session
  -> bounded observer readiness
  -> manual game launch by the human
  -> sanitized aggregate receipts
  -> explicit stop / resource stop / four-hour ceiling
  -> completed sidecar ingest required again
```

`Observation Session Authorized != Game Launch Authorized`.

## Controls

The launcher is Python-based so Windows PowerShell execution policy is not involved.

Safe status before start:

```text
python pilots/kontur-game-companion/external-observation-session/control.py status --control-root <local-control-root>
```

Start requires the exact human-decision token and three explicit confirmations:

```text
python pilots/kontur-game-companion/external-observation-session/control.py start --game-root <game-root> --sidecar-root <sidecar-root> --control-root <local-control-root> --node-path <node.exe> --max-seconds 14400 --human-decision ALLOW_THIS_BOUNDED_SANITIZED_LOG_OBSERVATION_SESSION --confirm-game-stopped --confirm-new-bytes-only --confirm-no-process-network-input-or-raw-retention
```

Stop never terminates the game:

```text
python pilots/kontur-game-companion/external-observation-session/control.py stop --control-root <local-control-root>
```

`stopped_recovered` is a terminal control state. `status` reports it with the
observer liveness result, while a repeated `stop` returns the recovered state
immediately without creating a stop request or rewriting recovery/session
evidence. A later `start` still requires the complete decision and confirmation
sequence for a distinct observation session.

The launcher kills only its own observer child if readiness fails, preventing a hidden
orphan. Stop requests carry an unguessable session-local token. The observer performs a
bounded final catch-up before marking itself finalized, fixing the historical tail-loss
race.

## Resource and data bounds

- event-driven log notification with 30-second reconciliation;
- 256 KiB maximum read chunk;
- 64 MiB maximum session bytes;
- 16 MiB maximum final catch-up;
- 64 KiB maximum partial-line memory per file;
- 128 log files and 4096 checkpoints maximum;
- self CPU sampled every five seconds;
- 0.3% idle total-CPU target with three-strike stop;
- 100 MiB working-set stop;
- four-hour hard ceiling;
- no automatic retry.

## Next boundary

A stopped session is not interpreted automatically. Its completed receipts must pass the
separate `external-sandbox-sidecar-ingest` adapter before any later human decision.
The chain validator also runs the finalizing-recovery validator through this
session validator, preserving specification -> validator -> CI continuity.

## Copyright and IP-process isolation

Copyright, licensing, patent, legal-author-identity, and pseudonym-publication processes
are neither read nor changed by this runtime.
