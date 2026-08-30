# C2PA Hashed External Reference × UU-AAP fixture v0.1

Status: **experimental interoperability fixture; not C2PA conformance and not a registered UU-AAP assertion namespace**.

Related roadmap: `#778` P0.2. Predecessor executable boundary: `#779` / `e3972ad78e99f0efa1a1e252805e70e477dc97a2`.

## Purpose

Demonstrate the narrowest useful binding between a released C2PA asset and an external UU-AAP governance record while keeping the detailed governance record outside the asset.

C2PA 2.4 already defines `c2pa.external-reference`. Its hashed variant carries an external `url`, hash algorithm and byte-string hash. When the optional `label` field is absent, the referenced material may be arbitrary external data rather than a JUMBF assertion.

This fixture therefore deliberately does **not** invent `org.uu-aap.*` C2PA assertion semantics.

## Composition

```text
external UU-AAP JSON record
        |
        | exact bytes -> SHA-256
        v
c2pa.external-reference
  location.url
  location.alg = sha256
  location.hash
  location.dc:format = application/json
  location.size
        |
        v
C2PA claim + asset hard binding + signature
        |
        v
released asset
```

The external record remains separately interpretable as UU-AAP data. The C2PA layer binds which bytes are referenced; it does not convert the signer into the UU-AAP author, decision authority, publication authority or responsible actor.

## Gathered, not created

The fixture sets `created: false` for `c2pa.external-reference`.

In the `c2pa-rs` Builder model, `created: false` represents a gathered assertion while `created: true` attributes the assertion to the signer. C2PA 2.4 recommends external-reference assertions in the gathered set. The fixture follows that lower-claim posture.

This does not mean the external record is true or independently reviewed. It only avoids silently strengthening signer attribution.

## Exact-byte binding

`build-config.js` hashes the exact bytes of `fixtures/external-uu-aap-record.json`. Reformatting or otherwise changing the external JSON changes the digest.

Run the deterministic preparation step:

```bash
node scripts/c2pa-external-reference/build-config.js \
  scripts/c2pa-external-reference/fixtures/external-uu-aap-record.json \
  /tmp/c2pa-external-reference-manifest.json
```

`verify-reference.js` then:

1. requires the C2PA report to remain `Valid` or `Trusted` under the existing P0.1 live-report gate;
2. finds exactly one `c2pa.external-reference` assertion;
3. verifies URL, algorithm, media type and byte length;
4. recomputes SHA-256 over the supplied external record;
5. compares the recomputed digest with the digest bound inside C2PA;
6. fails closed if a different/tampered external record is supplied.

## What this does not prove

```text
hash match != truth
hash match != authorship
hash match != decision authority
hash match != publication authority
hash match != responsibility
hash match != PoAI decision-time availability
resolvable today != available before a historical decision
```

A future PoAI layer may reference the same bound external object while separately establishing discoverability, reachability, authorization, contextualization and delivery before a Decision Boundary / Knowledge Cutoff.

## Acceptance

CI uses pinned official `c2patool v0.27.16` with its FOR-TESTING-ONLY development signer to:

- create a deterministic source PNG;
- build a C2PA manifest containing the standard hashed external-reference assertion;
- sign/embed the manifest;
- re-read and validate the resulting asset;
- verify the external record hash matches;
- modify a copy of the external record and prove that resolution fails closed.

The development signer exists only to make the fixture reproducible. No production identity or trust claim is made.

## Next interface

Once this fixture is stable, P0.2 can be used as the base for two independent follow-ups:

- SDK round-trip preservation across Swift/Android/other implementations;
- optional mapping into CAI custom-rubric/conformance tooling as an **application interoperability test**, not as a new C2PA conformance requirement.
