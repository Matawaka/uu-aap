# Bounded capture and snapshot comparison — development contract

Checkpoint: reader 1c1910b16dfeddfcee0d0b9dae260c27d3a51565, HA-1 unchanged.
This increment implements one GET-only metadata collector and one two-package
comparator. No reviewer, merge, target action, new credentials, artifact-executed
command, general workflow language or changes to the frozen HA-1 are required.

Collector input is the existing separately selected expectation, not an observed
report. GET targets are constructed from its validated repository/run/attempt:
run attempt before, attempt-specific jobs pages, run-wide artifact pages, and
run attempt after. No URL or Link supplied by evidence is followed. Artifacts
remain separately supplied ZIPs: this collector DOES NOT download signed URLs,
request credentials, authenticate a live recorder or run tests.

Default limits: 12 GET calls, 4 pages per family, 100 rows per page, 2 MB per
response, 8 MB total, a cooperative 30-second overall deadline and 10-second socket timeout.
The deadline is checked before/after calls, not an OS-enforced interruption of a
slow/hostile transport. Late returned bytes cannot make collection complete. No
retry, redirects, proxy credentials or token discovery. Public api.github.com
only. Rate-limit/permission/transport errors produce incomplete evidence, not a
false empty source. A caller can run the same bounded orchestration on replay
responses. Replay provenance must never claim a fresh HTTP collection.

Each accepted size-bounded UTF-8 response body is retained unchanged BEFORE projection with its
hash, generated path and ordinal. HTTP-body bytes and connector-selected JSON
replays are distinct origins; neither is a signature. Run fences compare identity,
status, update time and source tree; mismatch, repeated IDs, inconsistent totals,
short pages or a missing tail prevent complete-collection status. Stable fences
are observations, not an atomic database snapshot. Run-wide artifact metadata
does not prove attempt identity; the reader checks the separately pinned archive
and its report's run_attempt. Unknown values remain unknown.

Extend reader provenance explicitly; retain its four existing statuses and seven
scope gaps. A collector error may not be laundered away by a matched report.
Legacy manual captures remain admitted under their original provenance label.

Comparator re-assesses both packages rather than trusting a saved summary. Compare
physical keys within the same repository/workflow; logical Python slots pair rows
across distinct runs but NEVER assert identical executions. Different attempts,
source revisions and expectation inventories are disclosed. Missing evidence on
either side prohibits a no-change conclusion. Evidence loss is not a proven code
regression. Same run/attempt with a changed source is inconsistent. Rendering is
escaped, self-contained HTML without script, links from evidence or network calls.

Finite tests: normal/multipage replay; bad IDs and booleans; duplicates; drift;
missing tail; extra/short page; invalid JSON; rate limit and transport failure;
byte/call/page/time limits; hostile redirects/URLs; raw-body retention; legacy and
new provenance; partial collection preserving recorded failure; same package;
ordering-only change; missing/tampered archive; other attempt/source/repository;
changed expectations; malicious text; deterministic/no-I/O comparison. Keep the
original reader's 64 tests and byte-identical captured ZIPs.

Real-world evidence in this increment is a connector GET capture/replay and reads
of already retained CI archives. Direct HTTP execution is separately reported;
unavailable DNS must not be reported as a successful live collector.

## Source documentation checked

GitHub's attempt-scoped run/jobs endpoints and paginated run artifact endpoints
are the selected transport contract:
- https://docs.github.com/en/rest/actions/workflow-runs
- https://docs.github.com/en/rest/actions/workflow-jobs
- https://docs.github.com/en/rest/actions/artifacts

No reliance on Link URLs, credentials or arbitrary download redirects. Artifact
acquisition is deliberately outside this metadata-only increment. The current
replay carries selected fields copied from connected GitHub responses, not full
responses; its success status is a replay delivery status, not an HTTP measurement.
It exercises the collector/normalizer without claiming successful live HTTP.
