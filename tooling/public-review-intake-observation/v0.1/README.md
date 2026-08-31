# Public Review Intake Observation v0.1

This tool observes the current targeted UU-AAP Public Review issue surfaces **#1–#7** and emits a machine-readable receipt without making an admission, disposition, identity, authority or truth decision.

## Why this exists

After Core Pilot 002 Run 001, the project has one successfully processed external-source counterexample, but broader Public Review remains open. The next bottleneck is therefore not another semantic Core layer; it is the ability to notice genuine external participation without collapsing observation into acceptance.

The observer makes that boundary executable.

## Exact source set

`surfaces.json` pins:

```text
Matawaka/uu-aap issues #1, #2, #3, #4, #5, #6, #7
```

v0.1 intentionally excludes:

- Core Pilot 002 issue #422, whose first admitted source already has its own preserved evidence chain;
- arbitrary newly opened repository issues;
- GitHub Discussions;
- pull requests;
- email/social channels.

A broader source collector requires a successor rather than silently widening this one.

## Classification

For comments on the seven pinned issues:

```text
login == Matawaka
  -> PROJECT_ACCOUNT_COMMENT

user.type == Bot
  -> AUTOMATION_COMMENT

any other account
  -> EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED
```

The third state means only that a comment from another account was observed on a targeted Public Review surface. The receipt preserves comment ID/URL, account metadata, app mediation when present, and SHA-256 of the exact comment body.

It does **not** establish:

```text
account identifier -> human identity
AuthorAssociation -> independence
app mediation -> synthetic or human authorship
submission -> standing/expertise/authority
submission -> truth
observation -> admission
admission -> disposition
```

## Receipt states

- `NO_EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED`
- `EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED`

Both are valid observations. The first is not a failure; the second is not an accepted claim.

Every receipt fixes these fields:

```text
verified_human_identity = false
independence_established = false
standing_established = false
expertise_established = false
authority_established = false
claim_truth_established = false
admission_decision = NOT_MADE
disposition_decision = NOT_MADE
```

## Runtime

Offline tests are deterministic. A live observation is read-only and uses GitHub's public API with `contents: read`/repository metadata access from the workflow token.

The workflow has:

- PR validation for implementation changes;
- a one-time live observation when the observer itself is accepted to `main`;
- optional `workflow_dispatch` for a later human/operator-requested check;
- **no cron/schedule**.

The live JSON is stored as a workflow artifact. It does not mutate any review issue and is not a protocol release.

Local/live invocation:

```bash
python collector.py --output public-review-observation.json
python collector.py --validate public-review-observation.json
```

`GITHUB_TOKEN` or `GH_TOKEN` is optional for public API reads but recommended for rate limits.

## Relationship to Core Pilot 002 and B+C

Run 001 remains the historical evidence that exposed a responsibility-status declaration-provenance gap. Stage B and Stage C/RA1 are accepted bounded successors to that finding. This observer does not reopen or reinterpret any of them.

The current chain stays:

```text
availability / observation
  != admission
  != interpretation
  != disposition
  != normative change
  != authority
```

## Non-effects

No reviewer contact, identity profile, reputation score, admission, disposition, Core/SPEC/RESPONSIBILITY/base-schema mutation, recurring schedule, release/tag/publication/action authority, or Workbench reactivation is created by this tool.
