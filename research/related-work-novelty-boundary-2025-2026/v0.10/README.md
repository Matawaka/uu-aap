# StateBench lm-eval reproduction envelope v0.10

Tracks #976.

This stage exists only to materialize and freeze a complete dependency lock for a separate local-HuggingFace `statebench-lm-eval` integration path.

Pinned inputs:

- qualified predecessor: `1b2c5e622501dd07f4560d5356e0708fa9633833`
- predecessor v0.9 subtree: `d409b43debc532a1423092200661b8a823990eda`
- StateBench: `Parslee-ai/statebench@1b87cf6f43bcd6ec21e01bdec5705fcba04e71a7`
- StateBench package version: `2.0.0`
- StateBench lm-eval plugin version: `0.1.0`
- lm-eval reproduction choice: `lm-eval[hf]==0.4.13`
- lm-eval exact commit: `ddd67220430a2470529f25fd5c05a576ca1057a0`
- Python: `3.12.14`
- uv: `0.12.10`

The exact lm-eval v0.4.13 metadata requires `datasets>=2.16.0`; no `datasets<4` upper bound is present in that release metadata. Therefore no datasets-version conflict is claimed here. The ordinary pinned StateBench lm-eval task still names `dataset_path: parslee/statebench`, so its ordinary execution is not treated as byte-bound to the separately pinned local StateBench test payload.

The first gate is resolver-only. It may access package indexes and the two named public Git repositories to resolve dependency metadata, but it must not run a language model, download a HuggingFace model, load/download the StateBench dataset, use user credentials, or produce benchmark/performance fields.

A successful first resolver run is evidence only that the selected dependency graph can be resolved. Its exact `uv.lock` bytes must be frozen into this branch and revalidated by a successor before any local-model execution is considered.

No official StateBench benchmark, decision accuracy, SFRR, held-out recall/FPR, detection advantage/non-advantage, novelty, production authority, standards authority, release authority, or merge authority is created by this stage.
