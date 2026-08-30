# P1.13 Portable Disposition Integrity Capsule v0.1

P1.13 packages the already-merged P1.12/P1.11 browser verification dependency closure into one relocatable directory.

The capsule contains local copies of the P1.3, P1.4, P1.8, P1.9, P1.10 and P1.11 browser validators, the P1.12 text-only UI, canonical example input/result, historical source bindings, and a deterministic SHA-256/byte-length manifest.

The builder consumes an already validated verifier site and emits `verifier/integrity-capsule/`. The generated `index.html` contains no parent-directory dependencies, so the capsule can be copied independently and opened from its new location.

`verify_manifest()` requires the exact manifest file set and exact bytes. Added, removed or modified capsule payload files fail closed.

The manifest is not producer authentication. A passing capsule establishes only that the local copy matches its embedded byte inventory and that the historical deterministic integrity verifier can run over the bundled input.

```text
portable capsule != trusted producer
manifest match != truth
canonical rematerialization equality != identity/authority/responsibility
portable verification != publication/action authority
```

P1.13 does not modify Stable Core, SPEC, CONTESTABILITY, P1.11 or P1.12 semantics and does not authorize a package registry, custom domain, signing identity, external action or publication decision.
