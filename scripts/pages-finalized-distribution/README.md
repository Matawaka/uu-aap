# P1.17 Finalized Pages Deployment v0.1

P1.17 is a distribution-only successor over accepted P1.16. It changes the existing single physical GitHub Pages owner so the uploaded/deployed artifact is the exact P1.16-finalized tree rather than the raw P1.15 composition root.

The pipeline remains:

```text
validated verifier + PoAI docs
  -> P1.15 composed-pages
  -> historical P1.16 finalize_pages.py
  -> finalized-pages/pages-integrity-envelope.json
  -> P1.16 verify-only(finalized-pages)
  -> upload-pages-artifact(finalized-pages)
  -> existing single deploy-pages owner on main only
```

P1.17 does not modify the P1.16 finalizer, its adversarial test, or its standalone workflow. It source-binds those accepted historical bytes and advances only deployment integration plus dedicated distribution gates.

The exact directory passed to `actions/upload-pages-artifact` must therefore contain both the P1.15 composition receipt and the P1.16 integrity envelope. The raw P1.15 `composed-pages` directory is an intermediate and must not be uploaded after P1.17.

## Non-effects

Deploying integrity-bound bytes does not authenticate a producer, establish an external timestamp or trust anchor, establish truth, identity, authority or responsibility, or create/expand publication/action authority. The existing repository owner already possessed the mechanical GitHub Pages deployment path; P1.17 only changes the validated bytes supplied to that path.

No Stable Core, SPEC or CONTESTABILITY change. No new deploy owner. No custom domain, package registry, candidate selection, semantic promotion or action gate.
