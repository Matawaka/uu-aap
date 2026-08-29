# Component Manifest v0.1 conformance scope

Positive vectors:

- Core v0.1 can be described with zero dependencies and a local canonicalization rule.
- AI Transport Reference v0.1 can be described with typed runtime-import/evidence dependencies without creating authority or external effects.

Negative vectors reject:

- unknown dependency edge kinds;
- authority/effect overclaims in the first slice;
- missing mandatory non-effects;
- repository path escape;
- content-hash tampering.

Import-safety coverage proves that loading the validator module does not load a manifest or fixture and produces no stdout/stderr output.

The first slice does not claim that all UU-AAP components are representable without future schema evolution. It establishes a minimal metadata seam for the next read-only dependency/impact graph.
