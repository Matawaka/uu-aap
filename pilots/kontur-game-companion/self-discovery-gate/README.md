# KONTUR Game Companion — Discovery Prompt Gate / Self-Discovery Surface v0.1

**Status:** synthetic / non-executing / bounded discovery-support experiment  
**Related:** Issue #445  
**Predecessors:** Assistance Gate, Interaction Receipt v0.2, Conversational Variety, Uncertainty Repair  
**Origin frontier:** `98cea5a8b521a2b2fd0715d24efd90c8b7e3b87b`

This slice defines a narrow post-admissibility gate for prompts that invite the player to notice, compare, predict, or test something for themselves without smuggling in a deeper hint or solution.

## Core invariants

`Prompting Discovery != Manufacturing the Discovery`

`Question Form != Lower Assistance Depth`

`Hidden Answer != Self-Discovery`

`Knowledge of Solution != Right to Encode It in a Question`

`Experiment Suggestion != Action Command`

`Player Curiosity != Permission to Redirect Focus`

`Self-Discovery Support != Mandatory Pedagogy`

`Explicit Solution Request != Obligation to Withhold`

`Discovery Prompt != Action Permit`

The gate may only keep or reduce already-admissible interaction depth. It cannot revive a blocked response or increase assistance, initiative, spoiler depth, authority, or external effect.

## Placement

`Interaction Receipt + assistance/spoiler ceiling + safety + player focus + correction state -> Discovery Prompt Gate`

Outcomes are exactly:

`ALLOW_PROMPT | ALLOW_WAIT | BYPASS_DISCOVERY | BLOCK_PROMPT`

Discovery moves are exactly:

`WAIT | REFLECT_BACK | OBSERVATION_CUE | COMPARISON_CUE | PREDICTION_QUESTION | SMALL_REVERSIBLE_EXPERIMENT | HYPOTHESIS_INVITATION | CHECKPOINT_QUESTION`

`NUDGE`, `HINT`, `PARTIAL_SOLUTION`, and `SOLUTION` are deliberately excluded because they already carry assistance semantics upstream.

## Anti-leading boundary

A discovery prompt must not encode the answer in wording, option structure, ordering, emphasis, comparison setup, or proposed experiment.

`Question Syntax != Non-Leading`

High model confidence does not weaken this rule.

## Reversibility and cost

A proposed experiment is admissible only when it is local, reversible, low-cost, ignorable, inside current assistance/spoiler limits, and not framed as a command. Irreversible, scarce-resource, permanent-loss, account-level, or externally consequential experiments are blocked.

## Focus and repetition

`Player Focus > Discovery Objective`

The gate cannot redirect attention merely because another topic is more interesting or pedagogically useful. If a discovery prompt is ignored, the next compatible choice is normally `WAIT`, `REFLECT_BACK`, or bypass rather than stronger prompting.

## Correction and uncertainty

Contested evidence may produce an evidence-seeking checkpoint or reversible test, but correction provenance must remain visible. Player disagreement does not become automatic global truth, and repair cannot reveal a deeper spoiler.

## Explicit-answer boundary

If the player explicitly requests a direct solution and upstream Assistance Gate / Interaction Receipt already permits `SOLUTION`, the correct result is `BYPASS_DISCOVERY`.

`Self-Discovery Support != Forced Withholding`

This prevents the companion from turning bounded discovery support into compulsory tutoring.

## Canonical cases

The fixture covers visible-evidence observation, same-depth comparison, a reversible low-cost experiment, disguised-answer blocking, spoiler blocking, irreversible experiment blocking, focus preservation, ignored-prompt waiting, explicit-solution bypass, contested correction, confidence not authorizing leading prompts, engagement-objective rejection, and blocked-receipt non-revival.

## Non-effects

Synthetic only. No live response generation, proactive/background messaging, autonomous gameplay, account control, external effect, response authority, ActionPermit, successor permit, profiling, attention tracking, engagement/retention optimization, total-history capture, cross-game preference profile, Stable Core promotion, release, deployment, permission, or protection change is authorized.
