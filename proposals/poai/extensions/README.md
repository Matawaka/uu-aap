# PoAI successor research extensions

This directory contains successor research built **after** the frozen `poai-genesis-v0.0.1` checkpoint.

Extensions here do not silently redefine the tagged Genesis/Machine-Layer checkpoint. They are experiments that must survive machine validation, public review and field use before any future protocol revision is proposed.

## Current extensions

### Compositional Intelligence Horizon

[`COMPOSITIONAL_INTELLIGENCE.md`](COMPOSITIONAL_INTELLIGENCE.md)

Models one decision as a composition of independently represented human, AI, model, documentary, group or institutional intelligence resources while keeping availability, consideration and authority separate.

Core research invariant:

`resource provenance != availability != consideration != authority != responsibility`

and:

`epistemic advantage != authority`

Synthetic example:

[`../examples/augmented-observer.synthetic.poai.json`](../examples/augmented-observer.synthetic.poai.json)

Tracking / review:

- compositional implementation: Issue #27;
- terminology RFC (`human_judgment`, collective and augmented cognition): Issue #26;
- field usability round: Issue #28.

### Review Artifact / Sidecar

[`REVIEW_ARTIFACT.md`](REVIEW_ARTIFACT.md)

Explores later review provenance as a separate artifact that references an immutable PoAI decision record without rewriting its Decision Boundary or Knowledge Cutoff.

Core research invariants:

`review context != decision context`

`review finding != historical fact at the original Decision Boundary`

and:

`validity != completeness != truth`

The current Level 3.1d implementation generates an experimental browser-local `PoAIReviewSidecar`. It deliberately remains outside the Genesis PoAI record schema and carries no scalar completeness/trust/intelligence score.

Tracking / review:

- Review Context RFC: Issue #34;
- sidecar implementation: Issue #35;
- machine contract boundary: Issue #36;
- conflicting review plurality: Issue #37;
- review-time horizon / hindsight protection: Issue #38;
- live acceptance checklist: Issue #39.
