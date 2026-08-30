# Matawaka Workbench — external implementation frontier

**Status:** independent local implementation record  
**Canonical UU-AAP Core status:** **not Core; no conformance or promotion claim**  
**Durable continuity thread:** issue #804

Matawaka Workbench is developed as a local Windows/WPF implementation that consumes and tests UU-AAP-shaped evidence and authority boundaries. This directory records its externally observable development frontier so the project is not dependent on one chat session or one local UI history.

This directory does **not** make the Workbench source tree part of Stable Core, does not grant authority over `Matawaka/uu-aap`, and does not imply that a Workbench-local receipt is a canonical UU-AAP receipt.

## Current accepted local frontier

As of 2026-08-30:

- Workbench version: `0.27.0`
- accepted tag: `workbench-v0.27-accepted`
- accepted local HEAD: `8cdea04c2304f8589e9120d0451efa9e7e6b2f2b`
- post-acceptance control status: `TRANSPORT_ADVERSARIAL_CONTROLS_PASSED`
- main Workbench repository remained unchanged during the v0.27 control matrix
- source v0.26 independence receipt SHA-256: `c94bbb3ec3b7ec577f1199bffadde02ac84bac9c52139b74ccb73e064793a543`
- bound source transport ZIP SHA-256: `692d0dfb375dd07c482f80accb0bf3250fe6f10332506dcb6fb35fee250ecdf8`

The detailed v0.27 evidence checkpoint is recorded in `TRANSPORT-ADVERSARIAL-CONTROLS-v0.27.md` and in issue #804.

## Next bounded layer

The next implementation target is **v0.28 Transport Adversarial Evidence Closure**.

Its purpose is to close one exact positive/negative transport-evidence pair:

```text
v0.26 exact copied-transport independence proof
+
v0.27 exact adversarial refusal matrix
+
shared exact transport SHA-256 binding
->
v0.28 byte-bound transport adversarial evidence closure
```

The closure is evidence-only. It must not create evidence-materialization authority, recovery authority, automatic recovery, source mutation, network authority, catalog authority, Agent Execute authority, producer authentication, cross-machine/cross-OS portability, production recovery, Stable Core promotion, or interface-registry promotion.

See `TRANSPORT-ADVERSARIAL-EVIDENCE-CLOSURE-v0.28.md`.

## Publication boundary

At this checkpoint, GitHub preserves the **frontier, evidence identifiers, refusal semantics, authority boundary, and v0.28 design**. The exact local Workbench v0.27 source bytes are not yet present in this repository. Therefore this publication is a durable implementation record, **not yet a source-complete backup of `K:\Matawaka\Workbench`**.

A future source publication must preserve this separation explicitly rather than silently importing the Workbench implementation into UU-AAP Core.