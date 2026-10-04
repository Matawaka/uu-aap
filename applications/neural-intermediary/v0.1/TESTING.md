# Local validation — 2026-10-03

Local development evidence, authored and run by the implementing assistant.
Not independent review, provider qualification, scientific comparison or production acceptance.

Environment: Python 3.12.14, Node.js 24.19.0, managed Linux.
Repository base: `260e325619ffd2eed12c43f982c369e6468d5f07`.
Local workspace materializes the new package plus exact RERC dependency files;
it is not a full repository checkout. Full repository CI is not claimed.

| Surface | Observed result |
| --- | --- |
| Core, flow boundaries, egress, join, independent report checker | 36 Python methods passed |
| Archive integrity, original bytes, fresh reassessment | 10 Python methods passed |
| CLI subprocess round-trip, rendering, refusal behavior | 7 Python methods passed |
| Four authored checker-source mutations | 1 Python method passed, four named mutant subcases |
| RERC-backed projection | 11 named JS checks passed |
| Accepted predecessor test | `RERC_V0_1_PASS` |
| Ten finite synthetic demonstration scenarios | all expected classifications matched |
| Flood example projection | 13 original relations → 3 active relations; exact graph restoration |
| Raw policy/observation bytes after archive replay | exact match |
| Fixed Linux isolation probe | exit 2; `UNAVAILABLE / HOST_PREFLIGHT_DENIED` |

Total new test surface: **54 Python methods + 11 JS checks**. Parameter matrices
and subcases are not extra independent tests. Seventeen altered, rehashed reports
are exercised inside one checker method. Four separately compiled checker-source
mutations are exercised inside one mutation method. Each has an unchanged benign
control and a named negative obligation that it incorrectly accepts; the original
checker rejects that same counterexample.

The isolation host refused the positive-control socket. No unisolated fallback
ran, and production isolation remains false. The synthetic runtime probe is kept
separate from offline algorithm results. A successful future fixed probe would
still not qualify arbitrary native-code execution or a hostile kernel.

Exact RERC source blob:
`d2aae21a2e2375477c6349eae5f236ea60cd7151`.
The integration imports that implementation directly and the CI workflow checks
its Git blob before tests. No RERC source changes are part of the patch.

Reproduce using the named commands in README. No paid API, credential, external
provider, real corporate data, model training or deployment was used.
