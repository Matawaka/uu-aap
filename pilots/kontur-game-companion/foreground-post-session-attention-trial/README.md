# Foreground post-session attention trial

This optional local adapter turns one **completed** external-sandbox ingest
receipt and one fixed cue into a small JSON context card. Its required
predecessor is the `player-cued-observation-event-bridge` proposed in PR #506
(head `0d20d598b8230c107254a21738745b8f1656286b`). This successor must not be
merged before that predecessor. It never admits the bridge event candidate to
a runtime.

```text
completed sanitized sidecar receipt
  -> read-only completed-session ingest
  -> player-cued observation bridge (PR #506)
  -> this foreground value-free context card
  -> explicit human decision remains required
```

`Context Card != Response`, `Category Presence != Game Fact`, and
`Successful Trial != Runtime Admission`.

It is not a live observer. It does not attach to a running game and cannot
recover a game session for which bounded observation was not started before the
game. A completed session is historical evidence, not current game state.

## Run

The CMD launcher does not use PowerShell, so PowerShell execution policy does
not apply. Double-clicking it, or running it without arguments, selects the
repository-owned synthetic scenario and the `overview` cue:

```bat
run-local-attention-trial.cmd
```

Explicit synthetic run:

```bat
run-local-attention-trial.cmd --scenario synthetic --cue lifecycle
```

Use a completed `external-sandbox-sidecar-ingest` receipt stored in an ordinary
JSON file:

```bat
run-local-attention-trial.cmd --receipt "C:\path\ingest-receipt.json" --cue terms
```

Or supply the same receipt on standard input:

```bat
type "C:\path\ingest-receipt.json" | run-local-attention-trial.cmd --receipt - --cue overview
```

The file form rejects directories, links/reparse points, inputs larger than
256 KiB, duplicate JSON keys, invalid UTF-8, and `NaN`/infinite constants. The
standard-input form applies the same size and JSON constraints.

Available cue identities are:

- `overview`
- `lifecycle`
- `severity`
- `terms`
- `pause`
- `resume`
- `decline`
- `redirect`
- `none`

Every invocation constructs a fresh synthetic state anchor with
`last_turn = 0` and phase `ACTIVE`. Therefore `resume` is expected to be blocked:
the trial does not invent a prior persisted pause state.

## Output and boundaries

The sole output is one deterministic JSON document on stdout. It contains only:

- available, selected, and bridged category identities;
- digest provenance;
- bridge decision, admission, currentness, and effect statuses.

Identity disclosure follows the cue boundary: `overview` may expose all available
category identities in fixed order; a category cue may expose only that selected
identity when it has signal; `none`, `pause`, `resume`, `decline`, and `redirect`
expose no available category identities. A missing selected signal never falls
back to another category.

No aggregate count value is renderable. The adapter does not generate advice or
response text, invoke a language model, send a message, access a game or process,
perform network or audio I/O, execute a game action, write output files, persist
state, start background work, or poll. Python bytecode writes are disabled for
the invocation.

The card is not authenticated human input, not authenticated runtime state, not
a response, and not authority. Event candidates remain non-admitted and
runtime-ineligible. The next boundary remains an explicit human decision.

## Validation

Run the deterministic validator from the repository root:

```text
python pilots/kontur-game-companion/foreground-post-session-attention-trial/validate.py
```

It covers all nine cue identities, selected-focus disclosure, the no-signal
case, strict receipt loading, deterministic CLI output, the Windows CMD launcher,
and fail-closed non-effect checks. A CI job can invoke the same validator with
repository-owned synthetic evidence only; it does not access a game or a private
sidecar.
