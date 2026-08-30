# P1.12 Disposition Integrity Distribution Surface v0.1

P1.12 publishes the merged P1.11 deterministic disposition-integrity verifier as a browser-local Pages surface without defining a second integrity contract.

The deployed page copies the historical P1.11 browser core byte-for-byte and calls `UUAAPDispositionIntegrity.verifyDispositionIntegrity`. It exposes canonical P1.11 example input/result JSON and adds only a text-safe local UI shell plus EN/RU presentation labels.

Core invariant:

```text
public integrity verification surface != publication authority
canonical rematerialization equality != truth
integrity receipt != identity/authority/responsibility
```

Historical bindings are recorded in `source-bindings.json`. P1.12 does not edit Stable Core, SPEC, CONTESTABILITY or P1.10/P1.11 semantic implementations.
