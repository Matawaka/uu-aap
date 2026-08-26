# External observation finalizing recovery

Status: **bounded control-metadata recovery / completed evidence required**.

This optional adapter handles one narrow failure: the observer process is no
longer running and a valid `session-final.json` plus matching `final_checkpoint`
exist, but the local control state remains `finalizing`.

```text
dead observer + finalizing control state
  + valid completed-session ingest
  + final checkpoint identical to the final aggregate
  -> create-only recovery receipt
  -> separate recovered-state
  -> atomically repoint current.json
```

It does not edit the original `state.json`, the sidecar, checkpoints, or the
final receipt. It cannot start another observer, launch or access a game,
generate advice, send a message, or create action/successor authority.

`Valid Final Receipt != Permission To Rewrite Session History`.

`Recovered Control Metadata != New Observation Authorization`.

## Run

Run only after an explicit recovery decision and while the game and observer
are stopped:

```text
python pilots/kontur-game-companion/external-observation-session-finalizing-recovery/recover.py \
  --control-root <control-root> \
  --sidecar-root <Release/KONTUR_PILOT_INFO> \
  --session-id <session-id> \
  --expected-policy-sha256 <64-hex> \
  --human-decision ALLOW_THIS_FINALIZING_RECOVERY_WITH_VALID_SESSION_FINAL \
  --confirm-observer-stopped \
  --confirm-session-data-read-only \
  --confirm-control-recovery-only
```

Recovery fails closed when liveness is unknown, the PID is active, evidence is
missing or inconsistent, paths are linked, the final checkpoint does not match
the final aggregate, or recovery metadata already exists.

## Validation

```text
python pilots/kontur-game-companion/external-observation-session-finalizing-recovery/validate.py
```

The validator operates only on temporary copies and proves that source control
state and the complete synthetic sidecar remain byte-for-byte unchanged.
