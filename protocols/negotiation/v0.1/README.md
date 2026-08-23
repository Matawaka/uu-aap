# Protocol Capability Negotiation v0.1

**Status:** experimental repository-scoped negotiation layer  
**Registry dependency:** `urn:uu-aap:protocol-registry:v0.1`  
**Initial registered protocol:** CCRP v0.1

## Purpose

Protocol Registry v0.1 answers **which exact immutable protocol release a logical identity resolves to**. It intentionally does not answer whether another participant declares support for that release or whether its declared profile satisfies a caller's requirements.

This layer adds that next distinction:

```text
protocol resolution
  != capability declaration
  != capability compatibility
  != verified operational capability
  != authority
  != context admission
  != execution admission
  != materialization permission
```

A participant can publish a machine-readable capability declaration. Another participant can express exact requirements. The negotiator compares the two only after resolving every protocol identity through Protocol Registry v0.1.

## Exact negotiation chain

```text
requirement
  -> protocol_id + exact version
  -> registry exact resolution
  -> immutable logical URI + release commit
  -> matching declared capability
  -> explicit conformance-level set inclusion
  -> declared_compatible | incompatible
```

No step may silently select `latest`, a version range, a newer version, or an inferred conformance level.

## Files

- `capability-declaration.schema.json` — structural contract for a participant's declaration;
- `capability-requirement.schema.json` — structural contract for exact capability/dependency requirements;
- `negotiation-result.schema.json` — result contract;
- `negotiate.js` — deterministic semantic negotiator;
- `test-negotiation.js` — positive and fail-closed vectors;
- `examples/full-ccrp-capability.json` — self-declared CCRP C0-C5 support;
- `examples/partial-ccrp-capability.json` — self-declared CCRP C0-C3 support;
- `examples/require-ccrp-c0-c4.json` — exact CCRP v0.1 C0-C4 requirement.

## Declaration semantics

Capability declarations are explicitly `self_declared` in v0.1. They bind each claimed protocol capability to:

- exact `protocol_id`;
- exact `version`;
- deterministic registry `logical_uri`;
- immutable registered `release_commit`;
- explicitly listed conformance levels.

The negotiator rejects a declaration when its URI, release commit or declared conformance level disagrees with the registry.

This prevents a participant from saying "CCRP 0.1" while silently referring to different bytes, but it does **not** prove that the participant's implementation actually behaves as declared.

## Requirement semantics

Requirements distinguish:

- `requirements` — capabilities the peer must declare;
- `dependency_requirements` — exact protocol capabilities that must also be present for the requested interaction.

Both are resolved by exact protocol/version identity. v0.1 does not solve dependency graphs or choose versions. It only checks whether every explicitly named dependency requirement is already satisfied by the declaration.

## Conformance matching

Conformance levels use literal set inclusion:

```text
required_levels subset_of declared_levels
```

No hierarchy is inferred.

Therefore a declaration containing only `C5` does not automatically satisfy a requirement for `C0`. If a participant supports both, it must declare both.

## CLI

```bash
node protocols/negotiation/v0.1/negotiate.js \
  protocols/negotiation/v0.1/examples/full-ccrp-capability.json \
  protocols/negotiation/v0.1/examples/require-ccrp-c0-c4.json
```

Exit codes:

- `0` — `declared_compatible`;
- `2` — well-formed but incompatible / unresolved exact requirement;
- non-zero exception — malformed input or declaration/registry binding violation.

## Fail-closed policy

v0.1 rejects or returns incompatible for:

- `latest` or version ranges;
- unknown exact protocol/version identities;
- duplicate exact capability declarations;
- registry logical-URI drift;
- release-commit drift;
- conformance levels not present in the registered release;
- missing required capability levels;
- missing exact dependency requirements.

## Scope boundary

This layer establishes only deterministic comparison of **machine-readable declarations** against exact registered requirements.

It does not establish:

- factual truth;
- causal proof;
- legal identity or legal authority;
- verified operational capability;
- accreditation;
- universal protocol compatibility;
- automatic dependency solving;
- context or execution admission;
- PoAI/V conformance;
- permission to materialize an external action.

Core invariant:

```text
declared_compatible != authorized != admitted != materialization_permitted
```