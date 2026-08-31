# P1.15 Unified Pages Composition v0.1

P1.15 reconciles the repository-level GitHub Pages ownership collision discovered by P1.14.

Historical state had two independent `actions/deploy-pages` workflows targeting the same `github-pages` environment:

- the verifier distribution workflow uploaded the validated verifier artifact;
- the PoAI workflow uploaded `docs/`.

Those artifacts could replace each other depending on deployment order. P1.15 changes deployment mechanics only; it does not merge their semantic contracts.

## Composition rule

One validated physical Pages artifact is built as:

```text
docs/**                      -> / (byte-preserved)
validated verifier/verifier/** -> /verifier/** (byte-preserved)
validated verifier/.nojekyll -> /.nojekyll
validated verifier/index.html -> /verifier-start.html (byte-preserved relocation)
pages-composition-receipt.json -> composition evidence only
```

The only intentional source-path collision is `index.html`. The PoAI `docs/index.html` remains the composed root. The former verifier root landing is preserved byte-for-byte as `verifier-start.html`, where its relative `verifier/...` links continue to resolve correctly from the same URL directory depth.

Any additional docs/verifier path collision, any `docs/verifier/**` occupation, any unexpected verifier top-level file, any symlink, or any post-composition byte/path drift fails closed.

## Deployment ownership

After P1.15:

- `.github/workflows/verifier-distribution-surface-v0.1.yml` is the only physical `actions/deploy-pages` owner;
- it triggers for both verifier-source and `docs/**` changes and always rebuilds both surfaces before deployment;
- `.github/workflows/poai-pages.yml` remains a PoAI source-validation workflow but no longer uploads or deploys a Pages artifact.

Therefore a docs-only change cannot erase the verifier tree, and a verifier-only change cannot erase PoAI docs: either kind of change goes through the same full composition path.

## Evidence receipt

`compose_pages.py` writes a deterministic receipt containing source file counts/tree digests, the explicit root collision resolution, and non-effects. The receipt is not a trust badge.

```text
Pages deployment ownership != publication/action authority
public URL reachability != semantic authority
composed artifact != merged semantic contract
PoAI docs != verifier result
verifier integrity != truth/identity/authority/responsibility
```

## Historical bindings

`source-bindings.json` pins the exact P1.14 predecessor main, both historical Pages workflows, the PoAI root/Level 3 entry files, the verifier root builder, and the P1.14 distribution test. P1.15 is a deployment-integrity successor; Stable Core, SPEC, CONTESTABILITY, historical verifier semantics, and PoAI record semantics are not rewritten.
