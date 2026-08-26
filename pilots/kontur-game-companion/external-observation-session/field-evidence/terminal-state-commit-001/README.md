# Sanitized terminal-state field confirmation 001

Status: **evidence publication only / no runtime authority**.

This directory publishes a privacy-minimized receipt derived from one explicitly
authorized bounded observation conducted with the architecture materialized at
`2bad1681b6d13a9e7cf8bf150d24478edfcee931`.

The receipt confirms that a non-empty field observation reached `stopped`
directly through the verified terminal-state commit, with a matching final
checkpoint and a successful read-only completed-sidecar ingest. The separate
finalizing recovery was not used.

## Publication boundary

The publication excludes the original session identifier and timestamps, local
paths, process identifiers, control tokens and digests, source-file hashes, log
file names, raw log lines, identifier values, account data, and player-profile
data. Original source evidence remains local and is not included in this pull
request.

The published byte/line/file counts establish that the observation was non-empty.
The sensitive-line count is a count only; no identifier value is present.

`Field Confirmation != Source Log Publication`.

`Evidence Publication != New Observation Authorization`.

`Receipt != Action Or Successor Permit`.

## Validation

Run:

```text
python pilots/kontur-game-companion/external-observation-session/field-evidence/terminal-state-commit-001/validate.py
```

The validator enforces exact receipt structure and claims, digest binding, the
three-file evidence-only surface, and the absence of session identifiers,
timestamps, paths, log filenames, 17-digit identifier values, or unapproved
64-hex values.

This receipt supports verification of sanitized aggregate and control continuity
only. It is not an independent reproduction of unpublished source logs.
