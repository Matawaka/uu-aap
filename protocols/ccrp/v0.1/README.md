# CCRP v0.1 — Release Binding Layer

**Status:** release candidate  
**Protocol:** Concurrent Context Reconciliation Protocol (CCRP) v0.1  
**Repository:** `Matawaka/uu-aap`  
**Frozen predecessor:** `poai-ccrp-exp-v0.1` → `33215e251310105e2fac591b17ae2d90522488d9`

## Purpose

This directory promotes CCRP v0.1 from proposal/checkpoint space into a stable, machine-readable release-facing layer without rewriting the frozen experiment or silently copying implementation files into a second divergent tree.

The release unit is therefore a **content-addressed binding graph**:

```text
release manifest
  -> repository path
  -> exact Git blob SHA
  -> artifact role
  -> CCRP conformance level
  -> external dependency bindings
```

`proposals/ccrp/` remains the historical development lineage.

`protocols/ccrp/v0.1/release-manifest.json` is the release inventory that binds the exact bytes to be frozen by the release tag.

## Why bindings instead of copies

Several CCRP C5 and pre-materialization components intentionally consume PoAI authority and materialization modules through repository-relative dependencies. Blindly copying those files into a new directory would either break those dependency paths or create a second implementation tree that could drift from the historically validated source.

The release layer therefore uses:

```text
repository_path + git_blob_sha
```

For every bound artifact, the validator requires:

```bash
git hash-object <path>
```

to equal the manifest's `git_blob_sha`.

This preserves byte identity while allowing a release to enumerate the complete machine-readable protocol surface.

## Files in this release layer

- `release-manifest.json` — machine-readable release inventory and lineage binding;
- `release-manifest.schema.json` — structural JSON Schema contract;
- `validate-release.js` — semantic and Git-object binding validator.

The manifest binds:

- the CCRP v0.1 specification;
- C0-C5 JSON Schemas;
- reference implementation modules;
- conformance tests and examples;
- the historical implementation checkpoint;
- existing CCRP/PoAI integration workflows;
- the PoAI authority/materialization dependencies consumed by C5.

## Release sequence

1. Merge the PR that introduces this release binding layer.
2. Verify all existing required checks plus `CCRP release binding validation`.
3. Create immutable tag `poai-ccrp-v0.1` at the merge commit.
4. Publish the GitHub Release from that exact tag.
5. In a successor PR, update `docs/CANONICAL-STATE.md` and integrity navigation with the exact tag-to-commit binding.

Until steps 3-4 are complete, this directory remains a **release candidate**, not a claim that the immutable release already exists.

## Non-claims

Promotion into a release layer does not establish factual truth, causal proof, legal identity, legal authority, legal responsibility, moral correctness, universal canonicality, PoAI/V conformance, or a materialization event.

It establishes a repository-scoped, machine-verifiable binding between a named protocol release candidate and the exact artifacts that constitute it.
