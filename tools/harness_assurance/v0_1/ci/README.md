# HA-1 CI execution boundary (2026-09-27)

**Change class:** separately scoped test integration, not another reducer revision.
Tracking #1012 / Draft PR #1013. R1 source checkpoint:
`d294fe12ebf6b53820fc15816b379bcf26572189`.

The user's continuation request is used to prepare one dedicated GitHub Actions
check for the existing candidate. Independent review is still pending. No HA-2
adapter, target control, production execution, merge, release or permit is introduced.
Historical HA-0/HA-1/R1 reports retain their original scope and results.

## Fixed consumer and requirements

The consumer is a reviewer of HA-1 at an exact commit. A source checkout must run:

- the **same 114 R1 unittest methods**, including all 40 frozen named cases;
- **31 CI-gate self-tests**, separate from the 114 reducer tests;
- all 7 original and 8 R1 authored reducer mutants;
- the unchanged historical HA-0 static checker (10 rejected design mutations).

`manifest.json` pins twelve R1 code/design files and the exact discovered test IDs.
Neither reducer.py nor the original fixtures, test suites, oracle or historical
reports are modified by this step. CI must fail for missing/extra/duplicate tests,
zero tests, partial execution, skips, expected failures, unexpected successes,
failed tests, surviving mutants or changed source pins. R1 mutants additionally
require their benign baseline and designated assertion, with no unrelated error.
These finite checks are not a coverage percentage or a proof of full correctness.

`run_ci.py` is the repository test wrapper, not the pure reducer. It executes
known checked-in tests, uses fixed Git commands, and writes synthetic test logs
outside the checkout. It never executes command strings supplied as evidence.
The actual reducer's no-I/O boundary is unchanged.

## Workflow boundary

`.github/workflows/harness-assurance-v0.1.yml` is the only new workflow. Existing
workflows and branch protection are untouched. It is path-scoped to this package,
its design, original scoped roadmap and the workflow itself. It is **not** a
repository-wide required check or a merge-queue qualification.

PR runs check out `github.event.pull_request.head.sha` explicitly, not the implicit
PR merge ref; push runs (main only, after a separately authorized future merge)
use github.sha. The runner checks actual HEAD against that expected source and
records the tree. Success does not claim the merge result has been tested.

Two named Linux jobs select Python 3.12 and 3.13. Actual interpreter patch version
is recorded; the hosted image and dependency delivery are not claimed bit-reproducible.
Each job has a finite timeout. The workflow uses pull_request, not
pull_request_target; its GITHUB_TOKEN permissions are contents:read, checkout does
not persist credentials, no repository secrets are referenced, and no dependency
cache or package installation is configured. Checkout/setup/artifact delivery use
network services: this is **not** a network-isolated CI sandbox.

Action refs were resolved through the official GitHub repositories and pinned:

- actions/checkout v4: `11d5960a326750d5838078e36cf38b85af677262`;
- actions/setup-python v5: `a26af69be951a213d495a4c3e4e4022e16d87065`;
- actions/upload-artifact v4: `ea165f8d65b6e75b540449e92b4886f43607fa02`.

These are selected compatible major refs, not claims of latest major or a
third-party source-code audit. Relevant platform documentation:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

## Evidence and result interpretation

Every completed runner attempt writes ci-report.json, individual test logs and
HA-0 output. Artifacts are requested even after failure, with a 14-day retention
window; absence of files is a job failure, never a synthetic pass. Timeouts before
report creation remain incomplete runs. An artifact being present is not success.

The report binds checkout SHA/tree, twelve source pins, CI source hashes, test
identities/counts, named mutation outcomes, Python version and run/attempt labels.
Those labels are read from environment, not a signature. Relying on hosted
execution requires checking the actual GitHub run/jobs and artifact association.
A repository author can change both code and workflow/pins; this setup is not an
independent trust root, protection from a compromised runner, or independent review.

The record of an actual hosted result belongs to the observed run and PR checkpoint,
not a pre-written declaration in this document. Before such a run is read back,
status is **CI_WIRING_LOCAL_CHECKED_HOSTED_RESULT_PENDING**. No hosted result is
claimed by the mere presence of this workflow.

## Local reproduction and actual checks performed before upload

From a clean Git checkout (outputs must be outside the checkout):

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONHASHSEED=1 \
python -B tools/harness_assurance/v0_1/ci/run_ci.py \
  --expected-source "$(git rev-parse HEAD)" --output /tmp/ha1-ci-output
```

Local Python 3.13.5: 114 reducer tests + 31 wrapper tests passed, 7+8 mutants detected,
HA-0 static checks passed. Three executable negative wrapper trials returned exit 1:
wrong checkout SHA, committed tampering of a pinned source, empty expected test
inventory. They failed for their named cause, not an import or environment failure.
Workflow YAML parsing and scoped trigger/permission/action-pin assertions passed.
Raw local output and source identities are retained in the downloadable package.
Local runs are same-assistant execution, not hosted evidence or external review.

## Finite external-review handoff

Review the exact source SHA from the PR checkpoint and its CI artifact, not a moving
branch name. Check: separation of policy/evidence/trust; incomplete versus violated
requirements; human-stop and unknown-effect preservation; pinned source and full test
inventory; absence of target execution/permit paths; and the limits of recorder pins.
Reproduce the fixed commands, attach source/runtime/result identities and concrete
findings, and state reviewer/operator relationships rather than infer independence.
No named reviewer is contacted or approval fabricated by this change.

After the hosted result is verified, independent review remains the next barrier.
Do not start HA-2 automatically or add another general orchestrator/test framework.
