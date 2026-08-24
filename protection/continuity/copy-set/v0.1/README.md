# UU-AAP Continuity Copy Set Attestation v0.1

**Status:** experimental continuity evidence layer  
**Scope:** local, non-authoritative assessment of whether a declared set of repository copies presents enough fresh, hash-bound evidence for human continuity review.

This layer operationalizes the existing `protection/continuity/v0.1/reference.continuity-policy.json` requirements without changing that policy and without depending on KONTUR execution.

## Why this exists

Continuity v0.1 already requires:

- at least 3 independent copies;
- at least 2 independent custodians;
- at least one offline copy;
- no shared credentials;
- capture cadence no older than 7 days;
- verification cadence no older than 30 days;
- metadata backup;
- anti-canonicality boundaries.

A policy requirement is not evidence that the requirement is currently met.

This layer therefore introduces a bounded evidence question:

```text
policy says copies should exist
!= copies are attested

copies are attested
!= copies are fresh

copies are fresh
!= pairwise independence is evidenced

pairwise independence is evidenced for review
!= universal physical independence proven
```

## Input model

`copy-set-attestation.schema.json` binds one assessment to:

- an explicit `as_of_utc` time;
- one exact source `main` commit and tree;
- the unchanged Continuity v0.1 policy thresholds;
- one or more declared copy records;
- pairwise independence evidence records.

Each copy record includes opaque identifiers only. It MUST NOT contain passwords, tokens, recovery codes, private keys, device secrets, precise home addresses, or other credentials.

A copy record carries:

- `copy_id`;
- declared storage and custodian domains;
- declared access/credential domain label;
- offline flag;
- exact source main/tree binding;
- capture and verification timestamps;
- capture-manifest and verification-evidence SHA-256 values;
- metadata-backup presence;
- explicit `shared_credentials_declared=false`.

## Freshness

A copy is eligible for the current review set only when all of the following are true:

```text
captured_at <= verified_at <= as_of
as_of - captured_at <= 7 days
as_of - verified_at <= 30 days
copy main/tree == assessed source main/tree
metadata backup present
shared credentials not declared
```

Future timestamps fail closed.

## Pairwise independence evidence

Different storage labels alone are not enough.

For every pair in a proposed 3-copy review subset, the assessor requires a fresh `support` independence attestation with a SHA-256 evidence reference. A fresh `contradict` record for that pair blocks the pair. `indeterminate` never counts as support.

The assessor also requires different declared storage domains inside the selected subset and rejects reused non-null credential-domain labels.

This remains deliberately weaker than a physical-independence claim:

```text
distinct declared storage domains != physical separation proven
supporting evidence references != evidence truth certified
review-eligible copy set != disaster survival guaranteed
```

## Result

`copy_set_assessor.py` emits one of two states:

- `copy_set_review_eligible`
- `copy_set_insufficient`

The strongest positive meaning is:

> the declared, fresh, hash-bound evidence satisfies the reference policy thresholds strongly enough to proceed to human continuity review.

It does **not** mean continuity is guaranteed.

## Security and authority boundary

The input schema requires all of these to remain false:

```text
physical_independence_proven
continuity_guaranteed
canonical_successor_claimed
authority_transferred
rescue_authorized
failover_authorized
external_execution_authorized
kontur_activation_authorized
```

Therefore:

```text
copy_set_review_eligible != rescue authorized
copy_set_review_eligible != failover authorized
copy_set_review_eligible != canonical successor
copy_set_review_eligible != repository ownership transfer
copy_set_review_eligible != KONTUR readiness
copy_set_review_eligible != KONTUR activation
```

The assessor performs no network access, Git mutation, provider mutation, credential retrieval, rescue action, CHSP transition, or KONTUR call.

## Synthetic example

`reference.copy-set-attestation.json` is intentionally synthetic. Its custodian, storage, and evidence labels are examples only and MUST NOT be interpreted as claims about real operators or real backup locations.

Validate locally:

```bash
python3 protection/continuity/copy-set/v0.1/copy_set_assessor.py \
  protection/continuity/copy-set/v0.1/reference.copy-set-attestation.json
```
