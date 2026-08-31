# Public Review Repository Discovery v0.2

This is a read-only successor to `tooling/public-review-intake-observation/v0.1/`.

## Why it exists

v0.1 intentionally observes only Public Review issues #1–#7. That gives a precise targeted intake surface, but the public review instructions also allow independently opened GitHub issues. A useful external submission could therefore exist elsewhere in the repository while v0.1 correctly reports no external comment on #1–#7.

v0.2 closes only that **repository Issues discovery gap**.

```text
repository-wide observation != admission
external account != verified human identity
external account != independence / standing / expertise / authority
source presence != relevance
source presence != truth
known historical source != new source
new source observed != normative change
```

## Included source surface

The live collector reads all public GitHub issue objects and top-level issue comments in `Matawaka/uu-aap`, for both open and closed issues.

It explicitly excludes:

- pull requests and PR conversation comments;
- Discussions;
- commit comments;
- email and social media;
- any private/non-GitHub source.

A later successor may add another channel, but v0.2 does not silently treat all repository activity as Public Review evidence.

## Source classes

Project-account sources are counted as `PROJECT_ACCOUNT_SOURCE`; bot sources as `AUTOMATION_SOURCE`; deleted/missing accounts as `UNATTRIBUTED_SOURCE`. None of those become external-account candidates.

A different non-bot account is only an external-account source candidate. The receipt preserves the source kind, issue number/state, GitHub source id, source URL, account label/type, author association, GitHub App mediation when present, timestamps and exact UTF-8 body SHA-256.

No source body is interpreted for correctness or relevance by this layer.

## Historical source registry

Core Pilot 002 already observed, admitted and dispositioned one exact source:

- issue #422 comment `5471862585`;
- account label `84dnnvbdvp-debug`;
- body SHA-256 `23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8`;
- accepted lineage #845 → #846 → #849.

v0.2 must observe that exact source and classify it as `KNOWN_HISTORICAL_EXTERNAL_SOURCE`. If the source id/account/body binding drifts or disappears from the repository-wide observation, the collector fails closed rather than silently reclassifying history.

Any other different-account issue body/comment becomes only:

`NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED`

This means **new to this explicit historical registry**, not newly written at the moment of the run and not automatically eligible review evidence.

## Receipt states

`NO_NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED` means the exact historical external-source registry was found and no other different-account issue body/comment was observed.

`NEW_EXTERNAL_ACCOUNT_SOURCE_OBSERVED` means at least one other different-account issue body/comment was observed. It does not make admission, disposition, relevance, identity, independence, standing, expertise, authority or truth decisions.

## Runtime and cost boundary

The workflow runs deterministic tests on pull requests and performs one live read-only discovery after accepted push to `main`. It may also be invoked manually through `workflow_dispatch`.

There is deliberately no cron/schedule. Runtime permissions are limited to `contents: read` and `issues: read`. The only live output is a workflow artifact/receipt.

## Non-effects

No issue/comment mutation, reviewer contact, identity profile, reputation score, admission, disposition, Core/SPEC/RESPONSIBILITY/schema change, release/tag, publication authority, ActionPermit, C2PA reclassification or Workbench activation is created by v0.2.
