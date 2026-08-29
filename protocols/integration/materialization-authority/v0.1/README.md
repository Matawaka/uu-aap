# Materialization Authority v0.1

`MaterializationAuthorityReceipt` is a dedicated evidence-bound layer between scoped authority evidence and policy-relative successor recognition.

It exists to preserve:

`Scoped Authority Evidence != Materialization Authority`

`Materialization Authority != Execution Authority`

`Materialization Authority != Universal Canonicality`

A positive result, `AUTHORIZED_IN_SCOPE`, means only that the supplied scoped authority evidence supports the exact subject, action, predecessor→successor target and the explicit materialization policy **id + version + scope** at the stated evaluation time. Policy scope is a required receipt field so a downstream recognition consumer cannot silently widen a repository/resource-local authorization into another policy domain.

The evaluator is fail-closed on missing policy scope, missing support, target/action scope mismatch, dispute, expiry and revocation. Historical receipts remain provenance-bearing and are not rewritten by later policy or authority changes.

This profile is synthetic/read-only. It performs no repository mutation, runtime activation, release/tag operation, successor write, permission change, external effect, legal-status determination, truth claim or liability determination.
