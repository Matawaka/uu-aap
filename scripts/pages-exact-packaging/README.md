# P1.19 Exact Finalized Pages Packaging v0.1

P1.19 closes a packaging-boundary mismatch discovered by the first live P1.18 observer. P1.17 validated a P1.16-finalized tree containing `.nojekyll`, but `actions/upload-pages-artifact@v4` archived the directory with `--exclude=".[^/]*"`. The resulting exact `github-pages` artifact therefore omitted `.nojekyll` while retaining a P1.16 envelope that declared it.

P1.19 does **not** weaken or rewrite P1.16. It changes only the mechanical packaging step so the `github-pages` artifact contains the exact already-validated P1.16 tree.

```text
P1.16 finalized tree
  -> P1.16 verify-only
  -> P1.19 canonical artifact.tar (all files, including .nojekyll)
  -> independent extraction
  -> P1.16 verify-only again
  -> upload-artifact(name=github-pages, artifact.tar)
  -> existing deploy-pages owner
```

The packager emits regular-file tar members in canonical relative-path order, fixes archive metadata that is irrelevant to public file bytes, forbids symlinks/traversal, and requires the source file set to equal `P1.16 envelope files + pages-integrity-envelope.json` exactly.

The resulting tar SHA-256 is useful as packaging evidence but is not a producer signature or trusted timestamp.

## Non-effects

```text
archive fidelity != producer authentication
archive digest != trusted timestamp
archive fidelity != truth/identity/authority/responsibility
exact packaging != publication/action authority
```

P1.19 leaves Stable Core, SPEC, CONTESTABILITY and the historical P1.16 finalizer unchanged. It does not add a deployment owner or change who may publish; it only removes an unintended byte-dropping transformation in the existing mechanical deployment path.
