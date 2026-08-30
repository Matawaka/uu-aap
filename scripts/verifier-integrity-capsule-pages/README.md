# P1.14 Portable Integrity Capsule Pages Distribution v0.1

P1.14 is a distribution-only successor over accepted P1.13. It wires the historical portable disposition-integrity capsule into the repository's existing single GitHub Pages artifact and deployment owner.

The P1.13 capsule builder and verifier are reused unchanged. P1.14 does not define a new integrity contract, semantic dimension, producer identity, authority rule, or publication/action permission.

The validated Pages build order is:

```text
P1.2 reference + P1.3-P1.12 browser surfaces
-> existing localization passes
-> historical P1.13 capsule builder
-> historical P1.13 manifest verification
-> single Pages artifact upload/deploy
```

The resulting public artifact contains `verifier/integrity-capsule/` and the root landing links to it. The capsule remains independently relocatable because all of its runtime dependencies are local to that directory.

P1.14 also asserts repository-wide that only the historical P1.2 distribution workflow contains `actions/deploy-pages`.

```text
portable capsule != trusted producer
publicly reachable capsule != authoritative publication decision
manifest match != truth/identity/authority/responsibility
Pages deployment != publication/action authority grant
```

No Stable Core, SPEC, CONTESTABILITY, P1.11, P1.12, or P1.13 semantic implementation is modified by this layer.
