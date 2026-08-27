# FCL Current-State Request Evaluation Gate v0.1

This directory implements the seventh bounded, read-only slice of **Feedback Continuity & Perceived Causal Liveness (FCL)**.

It consumes an exact `UserControlRequestReceipt` and an exact current `RuntimeUIViewModelReceipt`, then determines whether the human request is still semantically applicable to the current evidence-bound execution context.

```text
UserControlRequestReceipt
  + current RuntimeUIViewModelReceipt
  -> CurrentStateRequestEvaluationInput
  -> CurrentStateRequestEvaluationReceipt
  -> later Authority / Action Gate
```

## Why this gate exists

A valid request is historical evidence that a human explicitly requested something against one rendered state. It is not proof that the same state is still current when the request is processed.

```text
Valid Request != Current Request
Current Request != Authorized Effect
Request Evaluation != ActionPermit
```

## Re-render is not state change

The first slice deliberately does **not** use full view fingerprint equality as the only currentness criterion. A UI may re-render the same causal evidence later. That changes `rendered_at` and `last_confirmed_progress_age_seconds`, and therefore changes the view fingerprint, without changing the run or the offered control.

```text
Re-render != Progress
Re-render != State Change
Different View Fingerprint != Automatically Stale
```

The output records `exact_source_view_match`, but that bit is diagnostic.

## Stable semantic request anchor

A request remains semantically applicable only when the following still match:

- displayed run id;
- run epoch;
- chain id;
- intent reference;
- request-compatible display state;
- the same request-only control;
- same-run continuity, with no predecessor/successor identity injected into the current view.

This yields `semantic_anchor_match`.

For `REQUEST_INTERRUPT` the required state remains `STALL_SUSPECTED + REQUEST_INTERRUPT`.
For `REQUEST_SUCCESSOR` it remains `CONTINUATION_AVAILABLE + REQUEST_SUCCESSOR`.

## Current evidence boundary

The current view must have been rendered at or after `request.requested_at` before the request can classify as current.

An older view may still be the exact view on which the human clicked, but that is not a current-state revalidation:

```text
Old Exact View != Current Evidence
```

Such input classifies `INSUFFICIENT_CURRENT_EVIDENCE` and is not forwardable.

## Classifications

```text
CURRENT_EQUIVALENT_STATE
STALE_EXECUTION_CONTEXT
STALE_DISPLAY_STATE
STALE_CONTROL_WITHDRAWN
INSUFFICIENT_CURRENT_EVIDENCE
```

Only `CURRENT_EQUIVALENT_STATE` sets:

```text
forwardable_to_authority_gate = true
authority_evaluation_required = true
next_safe_action = EVALUATE_AUTHORITY_FOR_REQUEST
```

No authority is established by this result. It only permits a later authority evaluator to inspect the still-current human request.

Stale requests use `DO_NOT_FORWARD_STALE_REQUEST`; insufficient evidence uses `OBTAIN_CURRENT_STATE_EVIDENCE`.

## No overclaim about intervening progress

Even `CURRENT_EQUIVALENT_STATE` fixes:

```text
absence_of_intervening_progress_proven = false
```

Semantic equivalence means the request still fits the current bounded state. It does not prove that nothing happened between the original activation and evaluation.

## Fixed non-effects

Every evaluation receipt fixes:

```text
request_effect_authorized = false
interrupt_completed = false
continuation_receipt_created = false
successor_run_created = false
runtime_state_transitioned = false
progress_created = false
liveness_proven = false
action_permit_established = false
execution_admitted = false
authority_established = false
hidden_reasoning_included = false
```

Thus:

```text
Current Request != Effect Authorization
Current-State Revalidation != ActionPermit
Forwardable To Authority Gate != Authority Granted
```

## CLI

```bash
node request-evaluation.js validate <input.json|->
node request-evaluation.js evaluate <input.json|->
```

Only `validate`, `evaluate`, and `help` exist. There is deliberately no `interrupt`, `resume`, `execute`, `send`, `switch`, `activate`, `create-successor`, `grant`, or `permit` command.

## Conformance

The test suite covers current interrupt and successor requests, old/insufficient evidence, run/epoch/chain/intent drift, recovered run state, successor already visible, control withdrawal, benign re-render fingerprint changes, source fingerprint integrity, no-intervening-progress overclaim rejection, stale forwarding rejection, fixed non-effects, identity preservation, deterministic output, and non-actuating CLI closure.

## Deliberately out of scope

This slice does not evaluate actual authority evidence, create an ActionPermit, execute interrupt, create continuation/successor state, mutate production UI, invoke a provider/model, send transport messages, change timeout state, or perform any external effect.
