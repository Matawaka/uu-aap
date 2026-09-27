# HA-1 bounded self-review R1 — 2026-09-26

**Status: LOCAL_REVIEW_R1_FIXED_REPRODUCED_EXTERNAL_REVIEW_PENDING.**
Tracking #1012, Draft PR #1013. Reviewed predecessor:
`b6cc11f2cd4a3f10abd666dbfad5e5f13d0c5e39`.

This is a further same-assistant adversarial review and clean-directory reproduction.
It is NOT independent design acceptance, an external reviewer, real recorder
qualification, HA-2, HA-3 completion, or permission to merge/deploy. No new workflow,
model call, target control, live evidence adapter or authority mechanism is installed.
The source-bound machine result is [review-r1.json](review-r1.json).

## Method and retained history

Seven predecessor tooling files were checked against their exact Git blob identities.
The predecessor passed the original 77 tests and seven authored implementation mutants.
The 40 original case expectations and all frozen input hashes remain unchanged.

A separate `test_adversarial.py` with 37 test methods was frozen before patching the
reducer. On the exact predecessor it ran RED: **45 assertion failures and one error**,
including subtests. Those counts are not 46 independent bugs. Raw logs and the old
reducer are retained in the downloadable package under `evidence/review-r1/`; the
machine result pins their bytes. The predecessor is also recoverable by its Git SHA.
The new test-file SHA-256 is
`1c56f0cbedebcff8377683d9f51fa883b3ab78cc158f459c90f7f1104ae43c83`.
Same-assistant test-first regression work is not independent TDD.

## Findings and corrections

| ID | Reproduced counterexample / gap | Disposition |
| --- | --- | --- |
| R1-01 | A latched human stop allowed advancement without restart; waiting/blocked or explicitly incomplete current work could satisfy the profile. | Preserve the latch. Claimed advancement/completion under a stop or blocked prerequisite is UNSATISFIED; safe waiting or explicit incompleteness remains INSUFFICIENT_EVIDENCE. |
| R1-02 | FAILED or NOT_PERFORMED could coexist with a success claim and satisfy the report. | Detect contradictory success. Failed unresolved effects cannot be promoted to current completion. No-effect tasks with NOT_PERFORMED and no success claim remain valid. |
| R1-03 | `failure_mode=CLOSED` hid an admitted observation of an effect after control failure. | Assess the observed effect independently of the declared mode; retain the original fail-open reason as well. |
| R1-04 | Non-test stage `PASS` could coexist with a nonzero exit, environment failure or failed-test count. | Reject contradictory success records. This is an evidence consistency failure, not proof of a business-invariant defect. |
| R1-05 | A dependent stage could be individually SATISFIED while its prerequisite was failed/unestablished. | Propagate insufficient prerequisite support in topological order; preserve known violations and all other reasons. |
| R1-06 | Empty/unrecognized change domains silently received ordinary risk routing; several sensitive normalized domains were missing. | Freeze an explicit domain vocabulary, require T3 for the additional named sensitive domains, report unknown domains as insufficient. No source-code risk inference is claimed. |
| R1-07 | Self/cyclic contract succession or a whitespace-only revision reason could be accepted. | Reject cyclic caller lineage data and require a nonblank revision reason. Legitimate admitted successors remain supported. |
| R1-08 | Same test identities enumerated in a different order produced a false test-identity rejection. | Compare membership after existing duplicate/count checks; changed membership still fails. |
| R1-09 | A lone Unicode surrogate escaped strict_loads as UnicodeEncodeError; aggregate object size was bounded only after JSON serialization. | Normalize invalid Unicode to the safe parser error and bound aggregate string/key bytes before serialization. This is not an OS resource sandbox. |
| R1-10 | Empty expected/observed RED reason could count as a named assertion. | Require a nonblank expected reason in the selected policy. This does not turn recorder prose into a deterministic test oracle. |

## Narrow semantic clarification

`completion_claim` is a claim of completion for the **current assessed attempt**, not
an assertion that some historical stage once completed. The existing context record
has no historical/completion-before-stop ordering evidence, and cannot use such an
interpretation to clear a current human stop. Historical stage observations are
retained separately. Resolving a stop, blocked dependency or failed effect requires
a separately admitted successor observation; this reducer cannot perform it.

Fixed normalized change-domain vocabulary:
`ordinary-code`, `authz`, `authn`, `crypto`, `secrets`, `payment`, `billing`,
`migration`, `external-mutation`, `public-api`, `infrastructure`, `control-policy`.
Every listed domain except `ordinary-code` requires T3. Unknown labels remain
INSUFFICIENT_EVIDENCE even at T3; the profile does not guess synonyms or inspect code.
This makes a previously underspecified field explicit, not a universal risk taxonomy.

## Checks actually completed

- 114 test methods: original 77 + R1 37, with subcases; all passed.
- Original 40 frozen cases: expectations/inputs unchanged; 4 satisfied, 12 insufficient,
  24 unsatisfied. These are expected verdicts on synthetic records, not target runs.
- Original seven authored mutants detected; eight additional R1 mutants detected by
  their designated regression tests. Each R1 mutant still passes the benign baseline;
  unrelated execution errors do not count as detection. This finite sample is not
  a percentage of mutation coverage or all possible defects.
- Two fresh-directory, separate-HOME test replays at Python hash seeds 1 and 777.
  They use the same interpreter/operator. The combined wrapper hit its 40-second tool
  deadline after five checks; the remaining R1 mutation check was retried once in a
  fresh directory and passed. The interruption is retained, not relabelled as a test PASS.
- Historical HA-0 static validator remains successful; its NOT_EXECUTED status is
  historical and is not rewritten as target execution.

## Reproduce the current candidate

From repository root:

```bash
python -B -m unittest discover -s tools/harness_assurance/v0_1 -p 'test_*.py' -v
python -B tools/harness_assurance/v0_1/check_mutations.py
python -B tools/harness_assurance/v0_1/check_review_mutations.py
python -B docs/design/harness-assurance/v0.1/validate_design.py
```

The mutation scripts compile only modified copies of this package's own source.
They do not interpret evidence commands. The production reducer never invokes the
fixture generators or test/mutation runners.

## Remaining gate

An independent reviewer must reproduce the candidate's exact source identities,
review these assumptions and inspect counterexamples beyond both suites. A future
repository test integration requires its own bounded change; successful pre-existing
GitHub workflows are not evidence that these 114 tests ran in CI. HA-2 stays NOT_STARTED,
HA-3 stays NOT_STARTED and HA-4 stays DEFERRED. Do not interpret this review as a mark,
permit, full repository qualification, new trust root, or deployment authorization.
