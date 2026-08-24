# Human Activation Review HAR-M3 Decision-ID Packet-Binding Hardening v0.1

Status: implementation candidate for targeted re-audit.

## Audit finding addressed

The HAR-M3 targeted re-audit of canonical main `7a085ffa8c724777ef2c0b38e60350bdfb8c11cf` verified complete prior-decision validation but found one remaining Medium defect:

```text
syntactically valid review_packet_binding.artifact_ref changed
+ old packet digest retained
+ old decision_id retained
-> ACCEPTED
```

The prior `decision_id` seed included only `review_packet_binding.digest.value`, so the human-readable/typed packet reference was not independently committed by the decision identity.

## New bounded identity derivation

The decision-ID seed now includes the RFC8785/JCS SHA-256 digest of the **complete typed review-packet binding**:

```text
{
  artifact_type,
  artifact_ref,
  digest: {
    canonicalization,
    digest_algorithm,
    digest_encoding,
    value
  }
}
```

Both decision construction and prior-decision revalidation use the same complete-binding identity component.

Therefore changing any of these while retaining the old `decision_id` must fail closed, including an otherwise syntactically valid `artifact_ref` substitution.

## Permanent regressions

A dedicated regression suite proves:

- a valid prior decision for packet A can coexist with a valid later decision for distinct packet B;
- packet `artifact_ref` substitution with the old decision ID is rejected specifically by decision-ID binding validation;
- packet digest substitution with the old decision ID is rejected specifically by decision-ID binding validation.

## Boundary

This is identity binding of the review decision artifact only.

```text
complete packet binding committed by decision_id
!= packet content truth
!= reviewer identity authentication
!= globally complete decision history
!= distributed nonce uniqueness
!= Human Activation Review approval
!= activation intent
!= preflight
!= execute command
!= KONTUR activation
```

Formal Human Activation Review remains disallowed until an independent targeted re-audit verifies this successor and a separate closure-evidence record is canonicalized.
