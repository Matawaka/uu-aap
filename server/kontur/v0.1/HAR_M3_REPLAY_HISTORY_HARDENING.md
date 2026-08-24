# Human Activation Review HAR-M3 Replay-History Hardening v0.1

Status: implementation candidate for targeted re-audit.

## Audit finding addressed

The targeted re-audit of canonical main `cf4abd3932048bbcfa30c157fa887cf434b2be5e` found that replay-history validation accepted materially incomplete prior `KONTURHumanActivationReviewDecision v0.1` entries.

The previous guard validated only a small subset of each prior entry before reading its nonce and packet digest.

## New fail-closed contract

Every supplied prior decision entry is now fully validated before it can participate in replay evaluation.

Validation requires the complete bounded decision contract:

- exact top-level keys;
- exact schema/type/version;
- decision ID shape and deterministic binding;
- complete review-packet binding including artifact ref and RFC8785/JCS SHA-256 digest;
- reviewer reference;
- supported decision outcome;
- exact confirmation set and approval semantics;
- exact human declaration, token, nonce, and explicit flag;
- complete review context;
- observed/reviewed/expiry timestamp ordering;
- complete-history assertion and replay-guard claims;
- safe-effect/outcome coupling;
- complete decision claims with all authority/activation overclaims false.

Only after the full prior entry passes validation may the current decision compare:

- prior nonce vs current nonce;
- prior packet digest vs current packet digest.

## Permanent negative vectors

The regression suite rejects at least:

- the exact materially incomplete history shape reproduced by the audit;
- unexpected prior-decision top-level fields;
- semantic decision/safe-effect tampering.

## Boundary

This change strengthens only local complete-history replay validation.

```text
complete prior-decision validation
!= globally complete history proven
!= distributed nonce uniqueness
!= reviewer identity authentication
!= Human Activation Review approval
!= activation intent
!= preflight
!= execute command
!= KONTUR activation
```

Formal Human Activation Review remains disallowed until a separate targeted HAR-M3 re-audit verifies this remediation and a closure record is merged.
