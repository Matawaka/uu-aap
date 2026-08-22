# Pre-materialization required-check smoke test

This documentation-only change exists to verify that repository pull-request validation runs independently of PoAI/CCRP machine-layer path changes.

It intentionally does not modify:

- `proposals/poai/**`;
- `proposals/ccrp/**`;
- `.github/workflows/**`;
- authority, execution, materialization, canonicality or protocol semantics.

The expected pull-request checks are:

- `PoAI Genesis validation`;
- `PoAI Authority Root validation`;
- `CCRP validation`;
- `PoAI CCRP pre-materialization validation`.

Passing these checks demonstrates workflow readiness only. It does not establish materialization, canonicality, truth, causality, legal authority/effect, responsibility, moral correctness or PoAI/V.
