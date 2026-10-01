# Local collection diagnostics (2026-10-01)

`collection_view.py` reads one explicitly selected `collection.json` and prints
JSON or Russian HTML. It displays recorded HTTP status, fixed issue codes and only
the existing six re-filtered diagnostic headers. It never reads response bodies,
paths, sibling files or arbitrary provenance, and makes no requests. Old errors
without diagnostic headers show `NOT_RECORDED`; empty/unsafe fields are disclosed
as `EMPTY_OR_FILTERED`. HTTP-error cause remains `NOT_ESTABLISHED` even when
rate-limit counters are present. Recorded source/status and input hashes do not
authenticate the index. This is diagnostics, not a CI assessment or acceptance.

```bash
python -I -B tools/ci_evidence_reader/v0_1/collection_view.py \
  retained/collection.json --format html > diagnostics-NEW.html
```

The input has no schema/version field. The viewer supports the current bounded
collector index: fixed method/origins, at most 12 sequential response rows and
16 typed issues, strict JSON limits and status/issue coherence. Unknown issue
codes become `UNRECOGNIZED_ISSUE`; private values are not reflected. Claimed
METADATA_CAPTURED with missing/non-200 status or fewer than four calls is refused.
Exit 2 is preserved for incomplete/inconsistent/refused inputs; exit 0 means only
that a consistent index recorded METADATA_CAPTURED, not authenticated live CI.
The 14 synthetic view tests join the unchanged three workflow entrypoints.
Local CPython 3.12.14: 64 + 94 + 38 = 196 methods passed.

## Portable snapshots and safe HTTP diagnostics checkpoint

`bundle.py` packages two explicitly selected snapshot directories into one data-only
ZIP and re-assesses them offline for JSON or Russian HTML viewing. Stored reports
are not accepted as evidence. Missing archives remain missing. The original archive
bytes and selected expectations/captures are retained exactly. Bundle member hashes
establish self-consistency; an optional separately retained whole-ZIP digest adds a
caller pin. Neither establishes source authentication or permission to act.

```bash
python -I -B tools/ci_evidence_reader/v0_1/bundle.py pack \
  --before r1-package --after r2-package --output evidence-NEW.zip
python -I -B tools/ci_evidence_reader/v0_1/bundle.py view evidence-NEW.zip \
  --sha256 <digest-printed-by-pack> --format html > comparison-NEW.html
```

No installation, server, automatic browser launch, network access or evidence-code
execution is involved. `pack` refuses an existing output file. `view` reads the
chosen ZIP in memory and writes its report only to stdout. Structural/hash refusal
and incomplete evidence remain non-passing. Details: [BUNDLE.md](BUNDLE.md).

The local HTML comparison includes expandable exact added/removed test IDs,
source/CI paths whose selected hashes changed, import and mutant inventories.
These are changes to caller-selected requirements, not inferred code fixes.
Separate per-snapshot panels expose nonmatching checks, profile warnings and all
seven assurance gaps. Values remain escaped text; the view uses no script or link
from evidence. This display increment leaves the JSON assessment unchanged.

The existing `test_collection.py` entrypoint includes the bundle tests, so the
consumer workflow requires no changes. Local CPython 3.12.14 check: 64 reader,
80 collection/comparison/diagnostic/bundle, 38 cross-run/view methods = 182 passed.
This is development validation; formal HA-2 acceptance is unchanged.

HTTP errors now retain only six bounded rate-limit diagnostic fields in
`collection.json`. Error prose and body bytes are still unread and unretained;
cookies, URLs and credential headers are excluded. Diagnostics do not classify
the cause or change fail-closed collection. The 2026-09-28 HTTP 403 remains
unexplained by its retained evidence; a future run is a separate observation.

## Preserved capture/comparison checkpoint (2026-09-28)

One bounded GET-only metadata collector and two-package comparison are added.
The original manual capture remains supported with its original provenance label.
No new workflow or changes to HA-1 are introduced. Local checks: 64 existing +
55 new test methods passed; six CLI trials matched. This is not hosted CI or
independent review. The current limits/results live in [CAPTURE-AND-COMPARE.md](CAPTURE-AND-COMPARE.md)
and [capture-result.json](capture-result.json).

```bash
python -I -B tools/ci_evidence_reader/v0_1/test_reader.py
python -I -B tools/ci_evidence_reader/v0_1/test_collection.py
# Metadata only: public API, selected expectation, fresh output directory.
python -I -B tools/ci_evidence_reader/v0_1/collector.py \
  --expectation expectation.json --output /tmp/ci-capture-NEW
# A package directory contains expectation.json, capture.json and retained
# py312.zip / py313.zip. Missing archives remain missing, never fabricated.
python -I -B tools/ci_evidence_reader/v0_1/compare.py \
  --before /path/to/first-package --after /path/to/second-package --format html
```

For the bundled selected-field replay, add `--replay selected-responses.json
--per-page 1` to the collector. This is replay, NOT a fresh live collection.
The real network smoke in the current runtime was incomplete due to DNS;
connector reads supplied the selected replay fields. No token or installation
was requested. Artifact download remains outside this metadata-only collector.

## Preserved initial reader checkpoint

# Captured CI Evidence Reader v0.1

**Status: DEVELOPMENT_CANDIDATE_CAPTURE_CHECKED.** Tracking #1012; separate from
frozen HA-1 PR #1013 at `a57c8923552972a9dd2318d5ddbc4db2aba20ac7`.
Continued development is authorized without waiting for a reviewer. This does not
mark HA-1 accepted or make this prototype an authenticated live adapter.

## What works

One standard-library module reads separately supplied expectation bytes, a selected-field
GitHub metadata capture and two existing HA-1 CI R2 ZIP archives. It checks run/job/source/
artifact bindings, source and CI hashes, the exact 114+46 test IDs, 7+8 mutant observations,
all log hashes and the preserved meaning of historical static HA-0 checks. It returns
JSON or an escaped, script-free Russian HTML report. Archive members are read in memory,
never extracted; evidence code and URLs are never executed or dereferenced.

The expectation is a caller trust input. For the real example its test/source inventories
come from the source manifest at the frozen SHA, not from the report being assessed.
The capture is explicitly a **manual selected-field projection of connector GET replies**,
not retained original HTTP bytes. Exact ZIPs and the source manifest are kept separately
in the downloadable package. No signature, trusted time or independent author is inferred.

| Exit | Capture result | Meaning |
| --- | --- | --- |
| 0 | CAPTURE_MATCHED | The supplied captured package agrees with selected expectations. |
| 1 | CAPTURE_INCONSISTENT | An identity, inventory or claim contradicts those expectations. |
| 2 | CAPTURE_INCOMPLETE | Necessary observations are missing, pending or uninterpretable. |
| 3 | CAPTURE_RECORDED_FAILURE | Bound metadata/report records a CI failure, cancellation or timeout. |

All reasons survive. Inconsistency dominates failure, then incompleteness. A missing
sibling artifact does not erase a known job failure. Expired upstream retention does
not invalidate matching retained bytes; the report warns instead of claiming availability.
Every output keeps `workflow_assurance=INSUFFICIENT_EVIDENCE`: this report format does
not prove design acceptance, test-first history, independent review, owner acceptance,
merge-result qualification, live-recorder authentication or authority to act. Missing
proof is not an allegation that the corresponding event never occurred.

## Run

No installation or API key is required. After inspecting these two Python files:

```bash
python -I -B tools/ci_evidence_reader/v0_1/test_reader.py
python -I -B tools/ci_evidence_reader/v0_1/reader.py \
  --expectation capture/expectation.json --capture capture/capture.json \
  --py312 capture/py312.zip --py313 capture/py313.zip
```

Add `--format html` and redirect stdout to a local `.html` file for the readable view.
Paths are chosen explicitly by the caller, never taken from evidence. The reader
writes no files; CLI reads only those selected inputs. There are no provider calls,
process execution, signing, target mutation or new permissions.

The conversation package includes the actual captured example, raw archived bytes,
output JSON/HTML, initial prototype failures and CLI logs. Repository unit tests are
self-contained synthetic observations, explicitly not evidence of a GitHub run.

## Actual local results

64 authored test methods passed on Python 3.13.5. The first 63-test pass had one failed
assertion (nested 0/false equivalence) and one error (missing per-job assessment on an
absent archive). A further nested-shape test exposed six subcase errors. All three
finding groups were fixed and retained; raw predecessor sources/logs are in the package.
This is same-assistant development/testing, not independent review or a TDD claim.

Five CLI trials ran: real retained pair -> exit 0; missing archive -> 2; altered archive
-> 1; synthetic job failure with missing sibling -> 3; HTML output -> 0. The real pair
produced 185 matched comparisons and disclosed seven assurance gaps. This is a new
**reading of existing evidence**, not another run of the earlier 160 test methods.
HTML structural/security tests passed. Browser file navigation was blocked by the
local browser policy, so no rendered screenshot or visual verification is claimed.

Captured run: `36316768214`, attempt 1. Source: `a57c8923552972a9dd2318d5ddbc4db2aba20ac7`.
Two observed artifact IDs: `10931196274` and `10930892944`. Both exact ZIP digests were
rechecked against connected GitHub metadata. Source manifest Git blob:
`9cad89124486fb608058863f44b37a1ee1f4f39c`. Details and byte pins: [local-result.json](local-result.json).

## Scope and next useful task

This is a first development increment toward HA-2, not completion of its formal
acceptance. No frozen HA-1 file, workflow, fixture or expected result is modified.
No claims of universal ZIP hardening, full repository coverage, cryptographic origin
authentication or protection against a caller changing both expectations and evidence.
It is not a workflow engine. Exact schema/count restrictions intentionally support only
this R2 report profile. The initial design record is [DESIGN.md](DESIGN.md).

Next useful engineering: a separately scoped, read-only capture command for this ONE
GitHub format, keeping capture separate from offline assessment, then a two-snapshot
comparison using stable identities. Do not import HA-1 synthetic fixtures to invent live
stage receipts. Continue development on its own branch; acceptance and deployment stay
separate decisions, not reasons to stop reversible engineering.
