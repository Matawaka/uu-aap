# Protocol Capability Attestation v0.1

**Status:** experimental repository-scoped reproducible attestation layer  
**Registry dependency:** `urn:uu-aap:protocol-registry:v0.1`  
**Negotiation predecessor:** `protocols/negotiation/v0.1/`  
**Initial attested implementation:** repository CCRP v0.1 reference implementation

## Purpose

Capability Negotiation v0.1 deliberately compares only self-declared capabilities. This layer adds a separate evidence state for a narrower claim: a specific implementation artifact set can be re-checked against the exact conformance tests bound into an immutable registered protocol release.

The chain is:

```text
self-declared capability
  -> exact registered protocol release
  -> exact implementation artifact blobs
  -> exact dependency blobs
  -> exact conformance-test blobs
  -> constrained executable test commands
  -> verifier re-execution
  -> reproducible_conformance_evidence | verification_failed
```

This does **not** turn a passing test suite into authority or universal proof of production behavior.

```text
reproducible conformance evidence
  != production deployment identity
  != universal operational capability
  != authority
  != context admission
  != execution admission
  != materialization permission
```

## Attestation model

An attestation binds:

- an exact implementation subject and its Git blob identities;
- an exact protocol/version resolvable through Protocol Registry v0.1;
- the immutable release tag, commit and release-manifest blob;
- external dependency blobs used by the implementation;
- explicit conformance levels;
- one exact conformance test blob per attested level;
- one constrained `node <test-path>` execution per test;
- a policy requiring the verifier to re-run every declared test.

The verifier accepts no arbitrary shell command. In v0.1 each test runner must be exactly:

```text
executable = node
args = [test_path]
```

This prevents an attestation from substituting a different command while claiming evidence for a bound test artifact.

## Files

- `capability-attestation.schema.json` — structural contract;
- `attestations/ccrp-reference-implementation.v0.1.json` — initial CCRP C0-C5 attestation;
- `verify-attestation.js` — registry/release/blob verifier and conformance re-run engine;
- `test-attestation.js` — positive and fail-closed vectors.

## Verification semantics

The verifier checks:

1. exact protocol/version resolution through the registry;
2. logical URI, release tag, commit and manifest blob equality;
3. release-manifest membership and byte identity for implementation artifacts;
4. release-manifest membership and byte identity for external dependencies;
5. release-manifest membership and byte identity for every conformance test;
6. exact one-to-one coverage of attested conformance levels by test evidence;
7. constrained command binding to the declared test path;
8. actual execution of every declared test with required exit code `0`.

Any registry drift, release drift, missing level, duplicate level, artifact drift, dependency drift, test drift or command substitution fails closed.

## Initial CCRP evidence

The repository attestation covers explicit levels `C0` through `C5` and re-runs the exact C0-C5 test artifacts already bound by `poai-ccrp-v0.1`.

Passing verification means only that the exact repository implementation/dependency state visible to the verifier reproduced the expected conformance-test outcomes for the exact immutable CCRP v0.1 release binding.

## Scope boundary

This layer does not establish:

- factual truth or causal proof;
- legal identity or legal authority;
- identity of any production deployment;
- absence of defects outside the declared tests;
- universal accreditation or certification;
- universal operational capability;
- context/execution admission;
- PoAI/V conformance;
- permission to materialize an external action.
