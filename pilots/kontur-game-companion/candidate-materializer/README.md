# KONTUR Game Companion — Synthetic Candidate Materializer v0.1

This synthetic/non-executing slice follows the merged Pre-Text Policy Receipt in PR #470.

It materializes a **concrete candidate response** from a pre-text policy shape using a fixed,
auditable template catalog. It then evaluates that concrete candidate through a
candidate-specific Interaction Receipt bridge bound to the current Interaction Receipt v0.2
semantics.

No language model is invoked.

## Pipeline

`Session State + PLAYER Event`
`→ Candidate Envelope`
`→ Pre-Text Policy Receipt`
`→ Synthetic Candidate Materializer`
`→ Interaction Receipt`
`→ no send authority`

The materializer only runs when the Pre-Text Policy Receipt says a response shape exists and
`shape_admissible = true`. `PAUSE`, `SHAPE_BLOCKED`, and `NO_RESPONSE_CANDIDATE` produce no
candidate and no Interaction Receipt.

## Core boundaries

- `Materialized Candidate != Sent Response`
- `Shape Admissible != Content Admissible`
- `Concrete Text != Response Authority`
- `Template Selection != Policy Authority`
- `Interaction Receipt != Send Permit`
- `Receipt Pass != Required Response`
- `Concrete Solution Candidate != Persistent Solver Mode`
- `Synthetic Fixture Solution != External Game Truth`
- `Candidate Digest != Authority`
- `Materializer != Language Model`
- `No Candidate != Refusal`
- `Content Exists -> Interaction Receipt Required`

## Fixed synthetic catalog

The catalog contains bounded deterministic wording for the canonical synthetic gate scenario:

- `THEORY`: explicitly marked as a theory;
- correction `QUESTION`: acknowledges the prior failed theory and asks for local evidence;
- `NOTICE`: points only to the already observed synchronization;
- neutral resume `COMMENT`: offers the old topic or another topic without restoring old intent;
- `HINT`: exactly one bounded hint;
- challenged-hint `QUESTION`: marks the hint as challenged and asks for evidence;
- `SOLUTION`: a fixture-local synthetic solution (`SUN → LEAF → MOON`) only after the current
  explicit solution request.

Generic lower-depth fallback templates exist for policy-reduced shapes. A policy reduction can
therefore remain materializable without silently restoring the original deeper request.

The fixture-local solution is not evidence about any real game. It exists only so the pipeline
can exercise a concrete `SOLUTION` candidate without introducing an external knowledge source.

## Interaction Receipt bridge

The bridge does not counterfeit the old pre-text stage. Content is now actually present.

Before validating a candidate it:

1. loads the current `interaction-receipt/validate.py`;
2. runs the official Interaction Receipt v0.2 validator against its canonical fixture;
3. imports the exact current `DECISION_SEMANTICS`, `BOUNDARY_FALSE`, assistance and initiative
   orderings;
4. binds each candidate receipt to the SHA-256 of that current validator;
5. checks current-event intent/initiative, focus, content flags, solution scope and all
   authority/action/successor non-effects.

Every candidate-specific Interaction Receipt has:

- `response_admissible = true` only after candidate checks;
- `scope = THIS_CANDIDATE_ONLY`;
- `authority_effect = NONE`;
- `action_effect = NONE`;
- `successor_effect = NONE`;
- `response_authority_created = false`;
- `action_permit_created = false`;
- `successor_permit_created = false`;
- `send_authority = false`;
- `future_help_authority = false`;
- `future_solution_authority = false`.

Thus this is the first slice in the computed pipeline where `response_admissible` can honestly
become boolean: a concrete candidate now exists.

## Synthetic-only boundary

This slice authorizes no live KONTUR connection, model invocation, network request, response
sending, proactive/background message, game input, account control, external effect, profiling,
attention tracking, engagement/retention optimization, total-history capture, cross-game
preference construction, Stable Core promotion, deployment, release, permission or protection
change.

Related: #445, #456, #460, #467, #468, #469, #470.
