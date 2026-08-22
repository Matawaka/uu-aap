# PoAI Execution / Compliance Sidecar — experimental successor research

Status: Level 3.1g research experiment. This does not modify the frozen `poai-genesis-v0.0.1` checkpoint.

## Purpose

Record what an executor/system later **declares** happened in response to an adjudication directive without mutating the Decision, Review, Appeal, or Adjudication artifacts.

Core separation:

`adjudication directive != execution report != verified execution != observed outcome`

and:

`execution context != adjudication context != appeal context != review context != decision context`

## Experimental machine artifact

`PoAIExecutionSidecar` v0.0.1-experimental contains:

- root `decision_record_id`;
- required `adjudication_id`;
- optional `appeal_request_id`;
- referenced `directive_ref.code`;
- executor self-declaration with `authority_status: unknown`;
- separate `execution_horizon.evidence_cutoff`;
- `declared_execution_status` such as `completed`, `failed`, `blocked`, or `in_progress`;
- evidence refs / notes;
- explicit negative claims that verified execution/compliance, observed outcome, legal effect, truth, causality, authority, responsibility, and canonical verdict are not established.

## Important semantics

`declared_execution_status = completed` means only that this artifact reports completion. It does not by itself prove implementation.

Likewise, `failed` or `blocked` do not automatically assign responsibility.

Execution-time evidence may be newer than Decision / Review / Appeal / Adjudication evidence but must not be injected into those earlier horizons.

## Non-goals

This experiment is not legal compliance certification, not PoAI/R, not PoAI/V, and not an observed-outcome record.

Tracking: RFC #55, implementation #56, live acceptance #57.
