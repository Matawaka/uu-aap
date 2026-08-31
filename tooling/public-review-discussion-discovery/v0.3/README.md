# Public Review Discussion Discovery v0.3

This layer observes the two GitHub Discussions that the accepted repository already declares as broad public-review channels:

- Discussion #8 — UU-AAP broad design review;
- Discussion #10 — PoAI primary RFC discussion.

It is an **observation layer only**.

```text
Discussion source observed
  != source admitted
  != source relevant
  != source true
  != reviewer identity established
  != reviewer standing/expertise/authority established
  != protocol disposition
  != normative change
```

## Scope

v0.3 reads exactly:

- the body of Discussions #8 and #10;
- all top-level comments;
- all replies to those comments.

The collector uses GitHub GraphQL because Discussions are not exposed through the repository's REST Issues endpoints. Both top-level comment pagination and reply pagination are explicit and fail closed on cursor loops or malformed pagination state.

No other Discussion number is observed by this version. Issues remain covered separately by `tooling/public-review-intake-observation/v0.1/` and `tooling/public-review-repository-discovery/v0.2/`.

## Output

The receipt records per Discussion:

- observed closed/answered metadata;
- top-level comment and reply counts;
- project-account, bot, unattributed and external-account source counts.

For every different-account source it preserves:

- Discussion number;
- source kind (`DISCUSSION_BODY`, `DISCUSSION_COMMENT`, `DISCUSSION_REPLY`);
- GraphQL node id;
- canonical public URL;
- public account label/type when present;
- GitHub author association;
- timestamps exposed by GitHub;
- SHA-256 of the exact source body.

It deliberately does not create reviewer profiles or scalar scores.

## Runtime boundary

The workflow has only:

```text
contents: read
discussions: read
```

There is no schedule/cron. PR runs execute only deterministic tests and source-binding checks. Live Discussion observation runs only after an accepted push to `main` or an explicit manual `workflow_dispatch`.

The live receipt is uploaded as a workflow artifact. No Discussion or comment is mutated.

## Historical binding

The implementation origin is exact `main`:

`bef77bddd4fa6430bb16f14e52f1d5fee1aeb786`

The implementation receipt binds the exact accepted source documents declaring Discussions #8/#10 and the exact accepted v0.2 issue-discovery layer. v0.3 is additive; v0.2 continues to exclude Discussions under its original semantics.

## Non-claims

A successful run does not prove:

- human/legal identity;
- independence;
- expertise or standing;
- authority;
- relevance or truth of a comment;
- completeness of all possible external review channels;
- external validation or certification;
- release, publication or action authority.

GitHub's `closed` or `isAnswered` state is observed metadata only and is not a UU-AAP review disposition.
