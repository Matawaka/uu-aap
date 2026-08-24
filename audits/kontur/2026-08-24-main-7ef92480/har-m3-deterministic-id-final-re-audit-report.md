# KONTUR HAR-M3 deterministic-ID final re-audit — main `7ef92480f36507594e0c9886bff3b7640383e549`

Date: 2026-08-24

## A. Exact audited frontier

- Canonical `refs/heads/main`: `7ef92480f36507594e0c9886bff3b7640383e549`
- Tree: `b53db6b2376b81107ed9e8d160947a27b26265a3`
- Direct parent: `14a8213a67980e530d89d6e8d3aee5a3b446d46a`
- GitHub signature: verified, reason `valid`, verified at `2026-08-24T06:48:27Z`
- Revision gate: PASS at audit observation time.

This audit is bound to the exact merged successor of PR #305. It does not silently retarget to a later `main`.

## B. Targeted finding

The previous re-audit recorded one remaining Medium finding in HAR-M3: Human Activation Review `decision_id` identity used a raw `|`-joined tuple. Because contract-permitted `reviewer_ref` and declaration nonce values may contain `|`, coordinated reviewer/outcome/nonce changes could preserve the serialized identity seed, retain the old deterministic ID, and bypass nonce-history detection.

PR #305 was the bounded remediation candidate for that finding.

## C. Remediation surface

PR #305 changed only:

- `.github/workflows/kontur-har-m3-canonical-decision-id-seed-v0.1-validation.yml`
- `audits/kontur/2026-08-24-main-7f6ac9c8/har-m3-canonical-decision-id-seed-remediation-v0.1.json`
- `server/kontur/v0.1/HAR_M3_CANONICAL_DECISION_ID_SEED_HARDENING.md`
- `server/kontur/v0.1/human-activation-review.js`
- `server/kontur/v0.1/test-human-activation-review-decision-id-binding.js`

No Activation Executor, Activation Preflight, Responsibility Kernel, Durable Responsibility Ledger, repository permission model, or canonical-origin implementation was changed by the remediation.

## D. Canonical typed decision identity

PASS.

Both decision construction and prior-decision revalidation call the same `decisionIdentityDigest` path. The identity input is an RFC8785/JCS-canonicalized typed object containing:

- explicit identity-seed type/version;
- complete `review_packet_binding`;
- `reviewer_ref`;
- decision outcome;
- human declaration nonce;
- `reviewed_at`;
- observed current Git revision;
- `observed_at`.

The identifier is derived as:

```text
SHA-256(RFC8785-JCS(identity_object))
```

Human Activation Review decision identity no longer depends on raw delimiter framing.

## E. Prior-history and replay ordering

PASS.

Every supplied prior decision is fully revalidated before it participates in nonce and packet replay checks. Its deterministic `decision_id` must reproduce from the complete typed identity object. A coordinated field substitution that retains an old ID therefore fails as `decision_id binding mismatch` before it can be used to hide a nonce reuse.

Direct nonce reuse remains rejected fail-closed.

## F. Historical delimiter-collision regression

PASS.

The permanent regression suite deliberately constructs two distinct semantic reviewer/outcome/nonce tuples whose historical raw pipe-joined representation is identical. Under the canonical typed seed, the two resulting decision IDs are required to differ.

The suite also verifies:

- coordinated reviewer/outcome/nonce substitution retaining an old ID is rejected;
- the original nonce cannot be reused after a valid prior decision;
- earlier complete packet-ref/digest binding regressions remain preserved.

## G. Executed CI evidence and tree equivalence

PASS with explicit provenance boundary.

PR #305 head commit:

- head SHA: `6017b079ff9e4e09186fc76185d0f8f528a97037`
- tree SHA: `b53db6b2376b81107ed9e8d160947a27b26265a3`

Merged canonical main:

- main SHA: `7ef92480f36507594e0c9886bff3b7640383e549`
- tree SHA: `b53db6b2376b81107ed9e8d160947a27b26265a3`

The source trees are byte-identical by Git tree identity.

Dedicated GitHub Actions run `32698637475` (`KONTUR HAR-M3 Canonical Decision ID Seed v0.1 validation`) completed successfully on the PR head tree. Its `validate` job `97345532707` completed successfully, including:

1. syntax checks;
2. Human Activation Review regression suite;
3. decision-ID canonical-seed regression suite;
4. canonical typed decision identity framing verification;
5. bounded remediation-record verification;
6. activation/repository-mutation guard;
7. clean-checkout verification.

Because the tested PR head and merged main have the same Git tree SHA, this is executed evidence for the exact source tree now present at the audited main frontier. It is not represented as proof that a separate push-triggered run executed against the merge commit SHA itself.

## H. Audit environment limitation

The audit environment could not independently clone GitHub into its local execution container because outbound DNS resolution was unavailable. No dependency, test, or policy check was bypassed to compensate for that limitation.

The unavailable local clone is not treated as a failure of the repository. The bounded conclusion relies on exact GitHub revision/tree provenance, merged source inspection, permanent regression construction, and the successful dedicated CI run on the byte-identical tree.

## I. Previous HAR-M3 findings

- malformed/incomplete prior decision history: `closed_verified`
- packet `artifact_ref` / complete packet-binding decision-ID binding: `closed_verified`
- delimiter-joined deterministic decision-ID seed: `closed_verified` by this re-audit

No remaining Medium finding was observed in the targeted HAR-M3 replay/deterministic-ID surface.

## J. Remaining Low observations

Unchanged and not promoted by this audit:

- `reviewer_ref` is declared identity, not cryptographic authentication;
- relative timestamp ordering is builder-enforced rather than independently schema-enforced;
- GitHub Actions retention constrains long-term availability of hosted execution evidence.

These observations do not reopen the remediated HAR-M3 Medium findings.

## K. Remaining High/Critical findings

None observed in the targeted surface.

## L. Aggregate closure boundary

This re-audit permits preparation of a separate aggregate closure evidence artifact for the original Human Activation Review Medium findings.

It does **not** itself make that aggregate closure artifact canonical, and it does not authorize Formal Human Activation Review before the aggregate closure evidence is separately reviewed and merged.

## M. KONTUR state

KONTUR remains inactive.

- no real Human Activation Review Decision;
- no activation intent;
- no live preflight;
- no execute command;
- no live executor invocation;
- `kernel_activated = false`;
- no live responsibility state;
- no responsibility acceptance;
- no execution authority;
- no repository permission expansion or bypass;
- no repository ownership or canonical-origin mutation.

## N. Final bounded conclusion

`HAR_M3_DETERMINISTIC_ID_REAUDIT_PASS`

The delimiter-collision / nonce-history-bypass Medium finding is independently verified closed at the exact audited source tree. Aggregate Human Activation Review closure evidence may now be prepared as a separate successor step. Formal Human Activation Review and KONTUR activation remain disallowed by this audit record itself.
