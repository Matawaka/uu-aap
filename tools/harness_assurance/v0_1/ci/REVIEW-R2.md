# HA-1 CI review R2: validate import surface before execution

**Status:** CI_IMPORT_BOUNDARY_FIXED_LOCAL_CHECKED_HOSTED_PENDING.
**Tracking:** #1012 / Draft PR #1013.
**Reviewed predecessor:** `3336c22cc9d4acec5bdc69b830e69dd473afe984`.
**Reviewer class:** same-assistant counterexample and correction, not independent review.

## One reproduced defect, not a new reducer revision

The predecessor pinned twelve source/design files and compared discovered and
executed unittest IDs. However, `unittest.TestLoader.discover()` imports matching
modules before returning that list. An additional committed `test_*.py` file
can run import-time code while contributing zero tests. The original source pins
and all 145 expected test IDs still match.

A disposable local Git fixture containing the 23 preserved PR files plus a single
harmless extra module reproduced this. The module wrote only an external temporary
marker. The predecessor runner returned **exit 0 / CI_CHECKS_PASS**, ran the 114
HA-1 and 31 CI tests, and the marker existed. No candidate or target system was
modified by that marker, no secret was read, and no network call was made. This
is a violation of the wrapper's fixed executable-test-surface claim; it is not
an exploit of a deployed runtime or evidence of compromised GitHub infrastructure.
A repository writer able to rewrite the runner/manifest remains outside this gate's
trust boundary.

## Correction

1. The workflow starts Python with `-I -B`; the wrapper requires isolated startup.
   This avoids importing from the script directory, working directory or PYTHONPATH
   before selecting its explicit package paths. It does not disable site-packages
   or turn the runner into an OS sandbox.
2. `verify_import_surface()` enumerates the bounded package before test imports.
   Its Python sources must exactly equal the pinned namespace. Unpinned Python
   modules, namespace symlinks, bytecode and native-extension files are refused.
3. `load_ha1_suite()` loads only the pinned module names derived from the frozen
   114 test IDs. Glob discovery is no longer an execution entrypoint.
4. The CI runner and its own test file now also have source pins: fourteen files
   total, with the prior twelve hashes unchanged. The namespace is rechecked at
   the end. An external actor can still edit both code and pins, and there is no
   protection against a concurrently hostile checkout or compromised interpreter.

The reducer, original 114 tests, fixture generator, frozen 40 scenarios, original
7+8 reducer mutants, and historical HA-0/R1 reports remain byte-identical.
No HA-2 source, permission issuer, new daemon or general plugin system is introduced.
Only the existing dedicated workflow is tightened; action revisions/permissions
and all unrelated workflows are unchanged.

## Local verification actually performed

The original 114 tests passed before the patch. After the patch:

- 114 unchanged reducer tests and **46 CI tests** passed (31 preserved plus 15 new);
- the 7 original and 8 R1 authored reducer mutants were detected;
- the historical HA-0 static validator passed with 10 design mutations rejected;
- the clean end-to-end wrapper trial passed;
- seven end-to-end negative wrapper trials failed for their intended reason:
  unpinned zero-test module, import shadow in `ci/`, cached bytecode, non-isolated
  Python, wrong checkout SHA, empty test inventory, and changed pinned source;
- both marker-carrying negative trials were refused before the marker could be
  written. The unit suite also asserts that the test loader is not called when
  admission fails.

Local tests used Python 3.13.5 and disposable changed-file snapshots, not a full
repository checkout or an independent operator. Exact local Git SHAs, raw logs,
the predecessor runner, and the marker experiment are retained in the conversation
package. `review-r2.json` pins the files and records the bounded results. Hosted
results must be observed on the newly committed source; the old CI run does not
qualify this modification. 160 methods repeated on two interpreters would still
be 160 distinct methods, not 320.

## Reproduction

Use a clean full checkout of the new PR head, with no secrets. Inspect source first.
The wrapper command is now:

```bash
python -I -B tools/harness_assurance/v0_1/ci/run_ci.py \
  --expected-source <exact-new-head-sha> --output /tmp/ha1-review-UNIQUE
```

Do not apply the old handoff's non-isolated command to this updated wrapper.
All prior checkpoints remain historical evidence, not current-source acceptance.
The runner checks source/test inventory; its output is never permission to merge,
deploy, or start a live evidence adapter.

## External review and stop point

A request to invoke the existing external code-review integration was attempted
in this continuation but blocked by the platform. It is NOT counted as a posted
review request, started reviewer, response, or approval. No alternate route was
used to bypass that block; no new service/account was installed and no purchase
was made. The separate external-review gate remains open.

After this single concrete correction and hosted reproduction, freeze the new
candidate. A selected independent reviewer must assess that exact revision; do not
create further versions simply because reviewer assignment is still missing.
