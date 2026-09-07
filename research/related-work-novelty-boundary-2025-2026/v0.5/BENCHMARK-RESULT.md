# v0.5 Synthetic Benchmark Result

Status before independent CI: `CANDIDATE_SYNTHETIC_RESULT`

Exact predecessor: `1473ab2005c876816dab12ae46ed7f39bbfbad6b`.

## Result

The deterministic synthetic runner evaluates 66 fixtures:

- 6 benign controls;
- 60 hostile fixtures = 6 domains × 10 semantic-promotion classes.

Measured local profiles:

| Local profile | Hostile detected | Recall | Benign FP | Unsupported classes |
| --- | ---: | ---: | ---: | ---: |
| `MATAWAKA_TYPED_PROFILE` | 60/60 | 1.00 | 0/6 | 0 |
| `SPECIALIZED_UNION_PROFILE` | 60/60 | 1.00 | 0/6 | 0 |
| `WEXP_LIKE_EXECUTION_PROFILE` | 36/60 | 0.60 | 0/6 | 4 |
| `STATEBENCH_LIKE_STATE_PROFILE` | 24/60 | 0.40 | 0/6 | 6 |
| `NAIVE_SCHEMA_PROFILE` | 0/60 | 0.00 | 0/6 | 10 |
| `LLM_POLICY_JUDGE` | not measured | — | — | — |

The top-level result is therefore:

`NO_SYNTHETIC_ADVANTAGE_OVER_SPECIALIZED_COMPOSITION`

The hostile-recall delta between the Matawaka typed profile and the intentionally strong specialized-union profile is exactly `0.0`.

## Interpretation

This negative result is the desired falsification pressure.

The benchmark shows that **unifying known semantic checks under one typed profile does not, by itself, create additional detection recall**. A composition of narrow local checks can reproduce the same 60/60 detection coverage on these controlled fixtures.

Therefore v0.5 does **not** support claims that Matawaka is safer, more complete, or more accurate merely because it has one cross-layer semantic contract.

Possible operational benefits of unification — fewer integration surfaces, simpler verifier wiring, clearer verdict provenance, lower configuration drift, lower latency/cost, easier cross-domain portability — remain unmeasured hypotheses.

## What the narrow local profiles show

The WEXP-like local profile catches the execution-evidence-oriented subset mapped in v0.4 and reaches 0.60 recall. The StateBench-like local profile catches the state/authority-oriented subset mapped in v0.4 and reaches 0.40 recall.

These are local synthetic approximations only. They are **not evaluations of upstream WEXP or StateBench implementations** and must never be cited as third-party benchmark scores.

The schema-only profile deliberately detects none of the mutations because all hostile fixtures preserve valid JSON shape while invalidating one semantic support relation. This demonstrates only that syntax validation is insufficient for this synthetic task.

## Ablation result

Removing one Matawaka semantic family creates deterministic false negatives:

| Removed family | New false negatives | Remaining recall |
| --- | ---: | ---: |
| Epistemic availability/consideration | 6 | 0.90 |
| Identity/authority | 12 | 0.80 |
| Review/permission | 6 | 0.90 |
| Invocation/effect | 12 | 0.80 |
| Provenance/causality | 18 | 0.70 |
| Freshness/current authority | 6 | 0.90 |

This is a property of the benchmark partition. It does not prove that the exact UU-AAP seven-layer architecture is unique or necessary.

## What would be required for a stronger contribution

The next empirical gate should stop using hand-authored coverage profiles and instead run **actual independent implementations or adapters** against held-out fixtures. A stronger result would require at least one measurable benefit that specialized composition does not reproduce, for example:

- higher held-out cross-class detection recall;
- lower false-positive rate under ambiguous benign cases;
- lower integration/configuration complexity under a predefined metric;
- lower verifier cost or latency at equivalent coverage;
- stronger portability across materially different domains;
- more reproducible and informative verdict provenance.

An LLM-policy judge should be admitted only through a separate exact invocation procedure binding model/version, prompt, fixture set and outputs. No model result exists in v0.5.

## Non-effects

`synthetic result != real-world security result`.

`local WEXP-like/StateBench-like profile != upstream implementation performance`.

`ablation sensitivity != proof of architectural necessity`.

`one verifier surface != stronger detection`.

This result establishes no novelty, world-first status, patentability, real-world superiority, production readiness, release authority, standards authority or merge authority.
