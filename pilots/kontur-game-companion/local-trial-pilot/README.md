# KONTUR Game Companion Local Trial Pilot v0.1

Status: **runnable / local / synthetic / null transport / no external effects**.

This package is the first directly runnable trial-pilot surface after local synthetic
enablement materialization. It reconstructs the deterministic KONTUR fixture chain in
memory, selects one bounded synthetic state, and emits a signed-by-digest JSON receipt
to stdout.

It does not connect to Scrap Mechanic or any other game. It does not access a game
process, modify game files, capture audio or microphone input, open a network, invoke
transport, send a message, or start background activity.

## Placement

```text
... -> Bounded Enablement Grant
    -> Local Synthetic Enablement State
    -> Local Trial Pilot (this package)
    -> HUMAN EXTERNAL SANDBOX PILOT DECISION REQUIRED
```

`Local Trial Pilot Ready != External Pilot Authorized`.

## Run

From the repository root:

```text
python pilots/kontur-game-companion/local-trial-pilot/run.py --scenario synthetic-ready --pretty
```

Windows PowerShell wrapper:

```text
pilots\kontur-game-companion\local-trial-pilot\run-local-trial-pilot.ps1
```

If Python is not in `PATH`, pass it explicitly:

```text
pilots\kontur-game-companion\local-trial-pilot\run-local-trial-pilot.ps1 -PythonPath C:\path\to\python.exe
```

The safe default scenario is also available:

```text
python pilots/kontur-game-companion/local-trial-pilot/run.py --scenario safe-default --pretty
```

Expected ready decision:

`LOCAL_SYNTHETIC_TRIAL_PILOT_READY`

## Runtime profile

The checked-in `pilot-config.json` is consumed and validated by the pilot:

- one process invocation;
- deterministic synthetic fixture input only;
- bounded single-shot CPU work;
- no polling or background loop;
- null transport;
- JSON receipt to stdout only;
- no persistent output;
- no network, game-process, game-file, audio, or microphone access.

The ready run performs no wait loop and exits after printing one receipt.

## Decisions

- `NOT_APPLICABLE`
- `TRIAL_PILOT_NOT_STARTED`
- `PILOT_PRECHECK_REQUIRED`
- `LOCAL_SYNTHETIC_TRIAL_PILOT_READY`

## Core boundaries

- `Runnable != Externally Connected`
- `Pilot Ready != Network Enabled`
- `Pilot Ready != Game Attached`
- `Pilot Ready != Audio Capture Started`
- `Synthetic Fixture != Live Observation`
- `Null Transport != Send Permit`
- `Stdout Receipt != Delivery`
- `One Invocation != Background Service`
- `Low-Duty Single Shot != Continuous Monitoring`
- `Pilot Receipt != Authority`
- `Pilot Ready != ActionPermit`
- `Pilot Ready != Successor Permit`
- `Local Trial Complete != External Sandbox Authorized`

## Next human boundary

A ready receipt sets only
`human_external_sandbox_pilot_decision_required = true`. It does not contain that
decision and cannot infer it from a successful run or CI result.

## Copyright and IP-process isolation

The pilot has no dependency on licensing, copyright, patent, legal-author-identity, or
pseudonym-publication processes. It cannot request or record changes to them, and no
related repository artifact is modified.

## Validation

`validate.py` proves deterministic default/ready behavior, executes both CLI scenarios,
checks the machine-readable config, and rejects configuration, provenance, networking,
game access, audio capture, background activity, sending, authority, persistence, and
copyright/IP mutations fail closed.
