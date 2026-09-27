# Captured CI Evidence Reader v0.1 — development contract

Status at contract creation: IMPLEMENTATION_PENDING. This is a separate development
candidate following HA-1 a57c8923552972a9dd2318d5ddbc4db2aba20ac7, not its acceptance.
The user authorized continuing bounded development without waiting for a reviewer.
PR #1013 and its source/test/CI checkpoint must remain unchanged.

## One consumer, one format

Consume an already captured HA-1 CI R2 run (36316768214, attempt 1), its two
artifact ZIPs, a separately selected expectation, and a normalized metadata capture.
No live collection, request from evidence, provider, model, subprocess, target
execution, archive extraction, code import from evidence, or permit issuance.
`assess(expected_bytes, capture_bytes, archives)` consumes bytes only. CLI reads
explicit caller paths and prints JSON or self-contained HTML. It does not scan paths
from metadata. There is no dependency on HA-1's reducer, fixture generator or runner.

Expected source/test/mutation inventories originate in the pinned HA-1 manifest,
not in the observed report. Run/job/artifact bindings originate in separately read
GitHub metadata. Expectations are a caller trust input, NOT authenticated by this
reader. Capture is an explicitly labeled connector-response field projection, NOT
original HTTP bytes, a signature, or an assertion of independently witnessed time.
ZIPs and source manifest retain exact bytes separately from normalized metadata.

## Distinct results

CAPTURE_MATCHED: supplied captured evidence agrees with pinned expectations.
CAPTURE_INCOMPLETE: a necessary observation/artifact is missing, unparseable, or pending.
CAPTURE_INCONSISTENT: a bound object contradicts an expected identity, inventory or claim.
CAPTURE_RECORDED_FAILURE: a supplied bound CI/job/report explicitly records failure.

Precedence: inconsistency > recorded failure > incomplete > matched. All reasons stay.
Neither MATCHED nor recorded failure is an assessment of all real-world behavior.
Unknown, null, unreadable and absence do not mean zero, successful, or never happened.
A genuine job failure remains visible even if a sibling artifact is missing.

The reader always reports workflow_assurance=INSUFFICIENT_EVIDENCE for this format:
CI does not establish independent design/code review, expected-RED-before-implementation,
owner acceptance, live recorder authentication, merge-result qualification, or authority.
Those are scope gaps, not allegations of non-execution and not blockers to development.
No synthetic stage records or caller-pinned fake live records are generated.

## Bounded checks

Run/repository/head/attempt/workflow/event; exact two job identities and named execution
step; exact expected artifacts by run/name/id; archive digest before parsing; four
allowed regular ZIP members, finite count and byte limits, no duplicate/path/symlink/
encrypted/native content; safe JSON with duplicate-key/type/depth/size checks; report
source/tree/run/attempt; 14 expected source pins, 4 CI source hashes, 8 Python sources;
114+46 exact distinct test IDs and zero skips/failures/errors; 7+8 named mutation
observations and intended catching evidence; all three log hashes; static HA-0 meaning
preserved. Expected integer zero does not accept bool false. No raw log/prose in output.
Archive expiration does not invalidate retained matching bytes; it is a warning about
upstream retention. Output links, if any, are renderer-owned, never evidence-owned.

## Finite test plan fixed before implementation

Positive captured pair and reordered inventories; missing/extra/duplicate/foreign jobs,
wrong source/attempt, skipped execution step, status-only success, partial result,
missing/tampered/expired archive, duplicate/path/symlink/oversized/corrupt ZIP,
invalid/duplicate-key/unsupported JSON, mismatched report/source/test/log bindings,
zero/partial/duplicate tests, bool masquerading as count, surviving or error-only mutant,
permission flag escalation, unknown environment, source projection with no original,
input immutability, no I/O, safe HTML, and deterministic repeat. Repinned diagnostic
mutations distinguish archive-integrity checks from content-semantics checks; they are
synthetic alterations, not upstream failures. Record original runs separately.

End after one reader, its finite tests, a real captured-run assessment, readable report,
and a separate development branch/checkpoint. No new universal orchestration framework.
