# StateBench Evaluator Availability v0.9

Issue: #974

Exact predecessor: `46a70e83f56c33f07a1c5d43fbe1ec49fb2465b3`

Exact predecessor v0.8 subtree: `8bd96e94cdc71be82a97bd550686478e9a4b2d5b`

## Purpose

v0.9 asks a narrower question than a benchmark run: which exact StateBench evaluation paths are actually available in a frozen no-key GitHub runner, and which scoring code can be executed without silently substituting a model or creating external cost?

Pinned upstream: `Parslee-ai/statebench@1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7`.

## Two distinct upstream surfaces

### Native full-metrics harness

The pinned `EvaluationHarness` supports OpenAI, Anthropic, Google and CAR generation. Every query passes through `_generate_response()` before `judge()`. `use_llm_judge=False` disables LLM fallback in the judge; it does **not** remove model-under-test generation.

OpenAI/Anthropic/Google are remote-provider paths. CAR is a local-provider path, but the pinned implementation lazily requires the optional `car_runtime` PyO3 client and a running `car-server` daemon.

### statebench-lm-eval

The same pinned repository also ships `statebench-lm-eval`, which explicitly supports a HuggingFace `hf` model path and sets `temperature: 0` / `do_sample: false`.

Upstream itself labels this integration **simplified mode**:

- context pre-computed with `transcript_replay`;
- queries flattened independently;
- decision accuracy only;
- no full SFRR or provenance metrics.

Its pyproject declares `lm-eval>=0.4.0` and the surface root contains no dependency lock. v0.9 therefore records the local-HF path as source-present but does not install an arbitrary latest lm-eval version or call that a reproducible execution.

## Protocol/implementation seam

Pinned `docs/EVALUATION.md` says an official test should use the test split, `temperature=0`, three seeds, mean±std, all primary metrics, per-track reporting and an identified judge.

The pinned native `_generate_response()` does not explicitly pass a temperature. The pinned CLI variance-report also states that its seeds currently affect dataset generation rather than model sampling. Separately, the lm-eval template does explicitly pin `temperature: 0`.

These are bounded implementation observations, not a claim that StateBench results are invalid.

## v0.9 execution

The dedicated runner:

1. revalidates the frozen predecessor chain;
2. checks exact upstream Git objects;
3. uses Python `3.12.14`, uv `0.12.10`, and the exact upstream `uv.lock`;
4. removes all named model/cloud credential evidence;
5. enables a socket guard before provider probing;
6. constructs provider clients only where possible but never issues a model request;
7. verifies that CAR's optional runtime is absent in the frozen environment;
8. executes the pinned deterministic `ResponseJudge(use_llm_judge=False)` against an empty-string, explicitly non-model control for all 251 query events in the exact 209-fixture public test split;
9. emits a deterministic result and digest.

The empty-response control proves scorer-code execution only. Its mechanical counts are not model performance and are not promoted into decision accuracy, SFRR, recall, FPR or StateBench score fields.

## Non-effects

No paid model call. No user credentials. No native model benchmark. No lm-eval model run. No official leaderboard claim. No advantage/non-advantage, novelty, world-first, production, release, standards or merge authority. No v0.1-v0.8 rewrite and no Stable Core/SPEC/PRINCIPLES/PoAI/C2PA/runtime/product mutation.
