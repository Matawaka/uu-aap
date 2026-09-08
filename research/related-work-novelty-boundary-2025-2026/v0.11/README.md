# StateBench frozen sync and import smoke v0.11

Status: `CANDIDATE_AWAITING_INDEPENDENT_CI`.

This stage advances exactly one evidence level beyond v0.10. It installs the exact frozen dependency graph from the qualified v0.10 `uv.lock` and performs import/version checks only.

It does **not** load StateBench task YAML, load/download a dataset, instantiate/download a language model, call a provider, score a fixture or emit any benchmark/performance claim.

Exact predecessor: `0b82089449e5a1401ad5f9310e2ce8ff43fa1bf1`.
Exact predecessor subtree: `65999dd76af39c79872131231355b3655c52573d`.

Frozen lock SHA-256: `324ab96f208bfbe1e6a2d03bc6ceb4bf5aa4867a57eeac5217e81571b7925532`.

Success target: `FROZEN_SYNC_AND_IMPORT_SMOKE_EXECUTED`.

A success proves only bounded runtime import compatibility of this frozen environment under the recorded runner. It does not prove StateBench task compatibility, model compatibility, benchmark validity, detection advantage, production readiness or merge authority.
