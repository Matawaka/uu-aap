# Public Review Observation Checkpoint v0.1

This directory retains two exact live observation receipts that would otherwise depend on expiring GitHub Actions artifacts.

It combines only the observation state of already accepted GitHub review surfaces:

- repository-wide GitHub Issues / issue comments from Public Review Repository Discovery v0.2;
- declared broad-review Discussions #8 and #10 from Public Review Discussion Discovery v0.3.

The checkpoint status is:

```text
NO_NEW_EXTERNAL_REVIEW_SOURCE_OBSERVED_ON_DECLARED_GITHUB_SURFACES
```

That status is deliberately narrow.

```text
no new source observed on covered GitHub surfaces
  != no external review exists anywhere
  != future absence
  != external validation
  != certification
  != release authority
```

## Retained exact receipts

### Repository-wide Issues

`repository-issues-live-receipt.json` is a byte-for-byte copy of the inner JSON file from:

- workflow run `33370805576`;
- artifact `9749967593`;
- artifact ZIP SHA-256 `e738af95fca1a83ed07b739e206b1aafaea4adb4ebd816ec11dde6a6d28cbad6`;
- run head `bef77bddd4fa6430bb16f14e52f1d5fee1aeb786`.

Retained receipt SHA-256:

`9958c1601b129aeeff144ca8ee27f06cf013eb4fd4cc91ad17e9d8569835d307`

The receipt observed one already-processed historical external source — exact #422 comment `5471862585` — and zero new external-account issue sources.

### Declared Discussions

`declared-discussions-live-receipt.json` is a byte-for-byte copy of the inner JSON file from:

- workflow run `33373077522`;
- artifact `9750806770`;
- artifact ZIP SHA-256 `f3c96d249f87b8f538719702856ee635b1f9a3a3621f1f01eefb502ed39a2b2b`;
- run head `88f5896ac60c59e0a3449196466c3ea9dcd9ea87`.

Retained receipt SHA-256:

`d9973d1bad2f0aecbee8f20bddd2149de2bbb5101b5d9b6d04918482d6ef47f4`

It observed exactly Discussions #8 and #10, including body/comment/reply coverage, with zero external-account Discussion sources at that observation time.

## Why retain repository copies?

The Actions artifacts have finite retention. Their transport digests remain useful historical bindings, but expiry must not erase the machine-readable observation evidence itself.

Retaining the inner JSON bytes does **not** extend the original observation window, authenticate a producer, create trusted time, or transform an artifact into authority.

## Validation

`validate_checkpoint.py`:

1. verifies exact SHA-256 for both retained JSON files;
2. validates each retained receipt using its accepted predecessor validator;
3. verifies exact historical #422 and Discussion #8/#10 boundaries;
4. checks accepted observer source-blob bindings at the checkpoint origin;
5. validates `checkpoint.json` and refuses scope/authority/truth/admission/disposition escalation.

`test_checkpoint.py` contains hostile mutations for byte drift, historical-source rewrite, source-count rewrite, global-absence claims, scope expansion and authority/effect escalation.

The checkpoint CI is repository-local after checkout. It performs no live GitHub observation and creates no recurring schedule.

## Non-claims

This checkpoint does not establish reviewer identity, independence, standing, expertise, claim relevance, claim truth, external validation, certification, publication authority, ActionPermit, legal effect or future availability of any review channel.
