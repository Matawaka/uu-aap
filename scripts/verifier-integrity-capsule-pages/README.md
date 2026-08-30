# P1.14 Portable Integrity Capsule Pages Distribution v0.1

P1.14 is a distribution-only successor over accepted P1.13. It wires the historical portable disposition-integrity capsule into the verifier's existing single validated GitHub Pages artifact and deployment owner.

The repository also has a pre-existing independent PoAI docs Pages workflow. P1.14 does not modify or replace that unrelated historical surface; its ownership invariant is specifically that the verifier has only the P1.2 distribution workflow as its deployment owner.

The P1.13 capsule builder and verifier are reused unchanged. P1.14 does not define a new integrity contract, semantic dimension, producer identity, authority rule, or publication/action permission.

The validated verifier Pages build order is:

```text
P1.2 reference + P1.3-P1.12 browser surfaces
-> existing localization passes
-> historical P1.13 capsule builder
-> historical P1.13 manifest verification
-> single verifier Pages artifact upload/deploy
```

The resulting public verifier artifact contains `verifier/integrity-capsule/` and the root landing links to it. The capsule remains independently relocatable because all of its runtime dependencies are local to that directory.

P1.14 asserts that it introduces no new `actions/deploy-pages` workflow and that the verifier continues to deploy only through `.github/workflows/verifier-distribution-surface-v0.1.yml`.

```text
portable capsule != trusted producer
publicly reachable capsule != authoritative publication decision
manifest match != truth/identity/authority/responsibility
Pages deployment != publication/action authority grant
```

No Stable Core, SPEC, CONTESTABILITY, P1.11, P1.12, or P1.13 semantic implementation is modified by this layer.
