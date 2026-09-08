# StateBench Upstream Code Execution v0.8

Issue: #972

Exact predecessor: `c2ea9dc329b1d3060770c028554f37aa1cb93611`

Exact predecessor v0.7 subtree: `9771bd009efc930df5b42e1c9fb5a870a68dc3a5`

## Purpose

v0.8 tests whether the exact pinned StateBench source package can be installed and whether its complete pinned upstream pytest tree can execute independently without model API credentials.

This is a code-execution evidence layer after v0.7's full 209-fixture dataset replay. It is intentionally separate from StateBench model evaluation.

## Exact upstream source

`Parslee-ai/statebench@1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7`

Pinned Git objects:

- `src/` tree: `93d4843a4a444f8ea583c19a4d5961ed9042a586`
- `tests/` tree: `b9c5cd768f7e117b9a7871eb4b91a8ecb3e2c6df`
- `pyproject.toml`: `54a9ba6b6cb711074d771bf3da45a4f0cb17d166`
- `uv.lock`: `58b24498b3ffb56247482613c5c01dec3e46bc0d`

The pinned package declares `statebench==2.0.0`, Python `>=3.11`, MIT licensing, and a `dev` optional dependency set containing pytest tooling.

## Harness provenance

The pinned commit does not contain `.github/workflows/`. Therefore this stage does **not** claim to reproduce an upstream GitHub CI procedure.

The execution procedure is explicitly:

`MATAWAKA INDEPENDENT REPRODUCTION HARNESS USING PINNED UPSTREAM uv.lock`

Dependencies are synchronized with `uv sync --frozen --extra dev`. The entire exact `tests/` tree is passed to pytest. No `-k`, marker filter, file exclusion, or post-result test-selection change is authorized.

The first candidate run may install the `uv` runner from PyPI and records the observed `uv --version`. If that run becomes the first independent qualification, the observed runner version must be frozen for the successor validation rather than silently drifting.

## Model credential boundary

Immediately before pytest and result summarization, these variables are explicitly unset:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`

If the upstream test suite requires credentials, model access, or other unavailable external state, the resulting non-pass is evidence. The stage must not selectively skip or patch those tests after observing the failure.

## Meaning of a pass

A complete pytest pass may establish only:

`upstream_code_execution_status = PINNED_UPSTREAM_TEST_SUITE_EXECUTED_PASS`

It does **not** establish:

- StateBench model harness execution;
- StateBench baseline/model performance;
- Matawaka model execution;
- held-out detection recall;
- benign false-positive rate;
- superiority or non-superiority.

A non-pass is recorded as `PINNED_UPSTREAM_TEST_SUITE_EXECUTED_NONPASS` with exact pytest counts/blocker evidence; it is not repaired by shrinking the upstream test selection.

## Non-effects

No v0.1-v0.7 rewrite. No Stable Core, SPEC, PRINCIPLES, PoAI, C2PA, runtime, package, application or product mutation. No novelty, world-first, patentability, production-readiness, release, standards, automatic-merge or merge authority.
