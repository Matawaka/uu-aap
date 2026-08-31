# P1.18 Post-Deployment Byte Observability v0.1

P1.18 observes the public GitHub Pages surface **after** the existing P1.17 deployment has completed and compares publicly served bytes with the exact `github-pages` workflow artifact that triggered the deployment.

The observer does not trust the public site as its own expectation source. It downloads the exact workflow artifact, extracts the P1.16-finalized tree, validates the retained `pages-integrity-envelope.json`, then requires the public envelope bytes and every envelope-listed public payload byte to match the artifact by byte length and SHA-256.

## Boundary

```text
successful deploy-pages != observed public byte equality
observed public byte equality != producer authentication
runner observation time != trusted timestamp
public reachability != future availability guarantee
byte equality != truth/identity/authority/responsibility
post-deployment observation != publication/action authority
```

The observer is read-only with respect to the repository and Pages deployment. Its only external operations are downloading the already-produced GitHub Actions artifact, HTTP GETs against the fixed Pages origin, and uploading the bounded CI observation receipt.

A bounded retry window exists only for Pages/CDN propagation after the deployment job reports success. Cross-origin redirects fail closed. Cache-busting query parameters and `Accept-Encoding: identity` are used only to observe the representation bytes served for each manifest path.

## Receipt

A passing receipt uses `urn:uu-aap:post-deployment-byte-observation:0.1` and records the triggering workflow run/head, expected artifact id/digest, expected envelope/tree digests, every observed path/status/byte count/SHA-256, retry attempts, and explicit non-effects.

`observed_at_utc` is ordinary runner-local metadata and explicitly is not a trusted timestamp.
