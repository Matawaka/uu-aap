# Portable CI evidence bundle — bounded development contract

2026-10-01. Tracking #1012 / draft PR #1014.
Predecessor: 2425bc905d80b8efb2d0bec23b99816319e8a3eb.
Frozen HA-1: a57c8923552972a9dd2318d5ddbc4db2aba20ac7, unchanged.

## Data contract

One ZIP contains `manifest.json` and two fixed namespaces, `before/` and `after/`.
Each namespace requires exact caller-selected `expectation.json` and `capture.json`
bytes and optionally includes `py312.zip` / `py313.zip`. Missing archives are
preserved as absence and remain non-passing when required by the reader.
No code, cached report, URL-selected input, dynamic slot or extra member is admitted.
The whole archive is never extracted. Nested archives remain inputs to the existing
reader and are never executed. Historical profiles are still selected only by the
out-of-band expectation; packaging never selects or downgrades them.

Manifest schema: `matawaka.ci-reader.bundle/v0.1`, with exactly `schema` and `files`.
Each listed payload has exactly its integer byte length and lowercase SHA-256.
The manifest inventory must equal actual members. ZIP duplicates, alias paths,
directories, symlinks/nonregular entries, encryption and unsupported compression
are refused. Fixed bounds: at most 9 members; 2,000,000 bytes per payload;
65,536 bytes for the manifest; 16,065,536 total uncompressed bytes; 16,069,632
bytes for the input ZIP. ZIP_STORED and ZIP_DEFLATED are admitted; the writer uses
deterministic ZIP_STORED bytes, fixed timestamps and regular file modes.

## Integrity, assessment and trust

Member hashes prove only the self-consistency of supplied bytes. An optional
separately chosen whole-ZIP digest rejects coordinated payload/manifest replacement
relative to that caller pin. A caller who changes both the bundle and the pin can
choose another input. No signature, upstream authentication, chronology, independent
review, stage receipt or authority is inferred from either check.

`view` checks the container, then calls the existing comparison reducer on both
snapshots. Saved summary reports are not an input. The underlying assessment/status,
seven assurance gaps and non-effects are preserved. A container with consistent
hashes can still contain missing, inconsistent or failed CI evidence.
Internal refusal has the explicit non-passing status `BUNDLE_REFUSED` and a fixed
diagnostic code. The HTML view escapes text and reuses the script-free comparison
renderer. A refused package does not claim an assessment was performed.

The HTML comparison shows exact added/removed selected identities and the names
of files with changed selected hashes, including the CI source inventory. Native
`details` elements expose this information without scripts. Per-snapshot panels
retain nonmatching checks, warnings, profile limits and all seven assurance gaps.
Only the existing report is rendered; JSON data, verdicts and bundle bytes are
unchanged. No stored body/log text is newly displayed. This is an author-led
usability check on retained R1/R2 evidence, not user or independent acceptance.

`pack` reads only explicitly selected snapshot directories and creates one new
output file exclusively; it never overwrites. `view` reads one explicitly selected
file and prints JSON or HTML. Neither calls the network, opens a server/browser,
downloads artifacts, executes evidence, issues permits or updates targets.
The source CLI remains separately inspected repository code, outside the data ZIP.

## HTTP diagnostic increment

The collector copies a selected header projection before closing HTTPError in a
finally block. Only x-ratelimit-limit/remaining/reset/used/resource and retry-after
are eligible. Values have ASCII-only syntax and bounded length; duplicates or
unreadable headers are omitted. Retry-After admits numeric seconds only. The
collector re-filters injected transport fields before serialization. Successful
response bodies/rows, failure status codes, call/page/byte/time budgets, no-retry,
no-redirect and anonymous transport behavior remain unchanged. This is diagnostic
data, not an inferred error cause. The old 403 has no recoverable header/body data.

## Validation and boundaries

The separate `collection_view.py` increment reads only an explicitly selected
current collector index; it does not change the bundle schema or reader verdict.
It admits at most 12 sequential response rows, 16 typed issues and the existing
strict JSON budgets. The fixed collector method, reported origins, call count,
HTTP types and status/issue coherence are checked. A claimed complete index needs
at least four HTTP 200 rows and no issues. Unknown issue codes are replaced by a
fixed label. Only the existing six safe error headers are re-projected, and only
on recorded non-200/non-null status. Missing/filtered headers are disclosed;
no cause, authentication or CI qualification is inferred. Bodies, paths, files,
body hashes and other provenance are not displayed or dereferenced. CLI exit 2
remains for incomplete/inconsistent/refused input. Fourteen additional authored
synthetic tests run inside the existing collection test entrypoint (196 total).

The preceding bundle/comparison-view checkpoint covered 182 methods locally on CPython 3.12.14:
150 preserved methods, 7 HTTP diagnostic methods, 18 bundle methods and 7 view
methods. Tests
cover exact roundtrip, deterministic bytes, external pin and coordinated rewrite,
unknown/duplicate/nonregular members, input limits, manifest typing/inventory,
unsupported compression, missing/corrupt nested evidence, offline purity,
exclusive output, fixed refusal diagnostics and escaped HTML.
View tests also cover exact inventory identities, all gaps, concurrent failure
and missing evidence, incomplete/refused output, escaping of new fields, offline
rendering, report immutability and reuse through the bundle viewer.

The retained R1/R2 conversation package is separately re-read without executing
historical code. Its original ZIP digest and all four nested archive digests are
preserved. Real-data reproduction and any later hosted results are recorded as
actual observations; local tests are not presented as hosted tests or independent
qualification. HA-2 formal acceptance remains unclaimed; HA-3 NOT_STARTED;
HA-4 DEFERRED. No new workflow, permissions, token, model call or Workbench change.
