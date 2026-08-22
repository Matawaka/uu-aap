# PoAI Materialization Machine Layer v0.1

**Status:** experimental implementation of [`../MATERIALIZATION.md`](../MATERIALIZATION.md).  
**Conformance effect:** none; this layer does not establish PoAI/V or UU-AAP conformance.

This directory contains the first machine-testable implementation of the PoAI Materialization Boundary.

## Artifacts

- `PoAIMaterializationPolicy` — a versioned, scope-relative rule set for recognizing a candidate successor;
- `PoAIMaterializationEvent` — an append-only record of applying one exact policy to one exact candidate.

The current implementation deliberately does **not** introduce a context-free `canonical: true` flag.

`proposal != authority != materialization != canonicality != truth`

## Files

- `schema/materialization-policy.schema.json` — JSON Schema Draft 2020-12;
- `schema/materialization-event.schema.json` — JSON Schema Draft 2020-12;
- `tools/materialization-core.js` — semantic builder/validator using the existing RFC 8785 JCS + SHA-256 binding implementation;
- `examples/synthetic-shipment.materialization-policy.json` — synthetic single-head repository-scope policy;
- `test-materialization.js` — positive and negative machine vectors.

## Synthetic positive vector

The test uses the existing shipment pair:

- `../examples/quasi-existent-future.synthetic.poai.json` — source `R1`;
- `../examples/quasi-existent-future.synthetic.successor.poai.json` — successor template.

Before materialization, the test constructs a candidate whose decision-time state is copied exactly from `R1` for:

- `decision_boundary`;
- `future_target`;
- `availability`;
- `consideration`;
- `authority`.

Later outcome information remains in the successor outcome/versioning layer. This prevents later explanatory edits from becoming silent rewrites of decision-time state.

## Authority Root integration

The authority prerequisite is now derived through the machine layer in [`../authority/`](../authority/README.md), implementing [`../AUTHORITY_ROOTS.md`](../AUTHORITY_ROOTS.md).

The positive path is:

```text
synthetic repository-control evidence
  -> PoAIAuthorityRoot
  -> policy Root Acceptance Rule
  -> PoAIAuthorityGrant
  -> PoAIAuthorityVerificationResult
  -> Materialization authority_evaluation
  -> PoAIMaterializationEvent
```

The Materialization test no longer creates `issuer_entitlement_verified = true` or `authority_verified = true` as unexplained prerequisites. Those booleans are projections of a machine-generated authority verification result whose provenance references are carried into `authority_evaluation.evidence_refs` and the optional root/grant/verification refs.

The current repository-control evidence is still synthetic test input. Real repository-scoped publication and acceptance are tracked in [Issue #110](https://github.com/Matawaka/uu-aap/issues/110).

## Required authority distinction

The policy requires:

`poai.successor.materialization.execute`

The previously field-tested scope:

`poai.successor.materialization.propose`

MUST NOT satisfy that requirement.

The Authority Root layer additionally keeps:

`poai.successor.materialization.execute != poai.materialization.policy.control`.

## Negative vectors

The Materialization test rejects at least:

1. `proposal_scope_used_as_execute_scope`;
2. `candidate_digest_substitution`;
3. `policy_version_substitution` / policy digest substitution;
4. `authority_outside_validity_window`;
5. `authority_target_mismatch`;
6. `non_delegable_authority_redelegated`;
7. `active_stay_ignored`;
8. `single_head_conflict_silently_selected`;
9. `decision_boundary_rewritten_in_successor`;
10. `materialization_claims_truth_certified`.

Authority-origin attacks are tested independently in `../authority/test-authority.js`.

## Run

From repository root:

```bash
node proposals/poai/authority/test-authority.js \
  /tmp/authority-grant.json \
  /tmp/authority-verification.json

node proposals/poai/materialization/test-materialization.js \
  /tmp/materialization-event.json \
  /tmp/materialization-candidate.json
```

Generated authority, materialization and candidate artifacts are schema-validated in CI. Authority and Materialization artifacts are required to remain outside the Genesis decision-record schema.

## Assurance boundary

A successful synthetic event may establish only a policy-relative materialization claim for the declared test scope. It MUST retain:

```text
universal_canonicality_established = false
truth_certified = false
causal_proof_certified = false
legal_responsibility_determined = false
moral_correctness_established = false
poai_v_conformance_established = false
```
