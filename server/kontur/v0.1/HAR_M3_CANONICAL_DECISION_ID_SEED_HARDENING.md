# HAR-M3 Canonical Decision-ID Seed Hardening v0.1

This change addresses the Medium finding recorded by the targeted re-audit of canonical main `7f6ac9c8ac007c14449c31383f5e70d5a4093881` and then canonicalized by PR #304.

## Finding

The Human Activation Review decision identifier was derived from a raw pipe-delimited tuple. Because `reviewer_ref` and the human declaration nonce may themselves contain `|`, two different contract-valid tuples could serialize to the same byte string. The reproduced attack coordinated reviewer, outcome, and nonce changes, retained the same `decision_id`, and could bypass nonce-history detection.

## Remediation

Decision identity is now represented as a typed object containing every identity-relevant field:

- complete `review_packet_binding`;
- `reviewer_ref`;
- `decision`;
- human declaration nonce;
- `reviewed_at`;
- observed current Git revision;
- `observed_at`.

The object also carries an explicit identity-seed type/version. The identifier digest is:

```text
SHA-256(RFC8785-JCS(identity_object))
```

No delimiter framing is used for Human Activation Review decision identity.

## Regression boundary

The permanent regression suite constructs two different semantic tuples that are intentionally identical under the historical pipe-join representation. The new implementation requires their decision IDs to differ. It also verifies that a coordinated prior-entry substitution preserving the old ID is rejected before replay evaluation and that direct nonce reuse remains rejected.

## Non-effects

This remediation does not authorize or perform:

- Human Activation Review approval;
- activation intent creation;
- live preflight;
- execute-command creation;
- KONTUR activation;
- responsibility acceptance;
- execution-authority grant;
- permission expansion or bypass;
- repository ownership transfer;
- canonical-origin mutation.

The remediation is a candidate only. The finding remains open until a separate targeted read-only re-audit verifies the merged successor.
