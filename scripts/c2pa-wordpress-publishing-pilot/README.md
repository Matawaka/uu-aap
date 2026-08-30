# C2PA / CAWG / PoAI / UU-AAP WordPress Publishing Pilot v0.1

Status: **#778 P0.6 semantic/interface acceptance** against a real ContentAuth WordPress publishing surface. This is not a live certificate-backed deployment, not an independent C2PA conformance claim, not a new C2PA assertion namespace, and not a trust/reputation score.

Predecessor frontier: `f397ab9b8e46d5b082f62bee4c99615711cb3340` (#786, evidence-informed C2PA semantic boundary after P0.1–P0.5).

## Why this pilot exists

P0.6 asks whether a practical publishing surface can compose:

```text
publication artifact
  -> C2PA product/provenance surface
  -> CAWG organisational identity
  -> C2PA 2.4 AI disclosure
  -> standard external-reference digest
  -> external UU-AAP publication-governance record
```

without collapsing signer identity, organisational identity, authorship, AI participation, publication authority, scoped responsibility, or factual truth.

The target is the real `contentauth/wp-plugin` interface rather than a UU-AAP-specific CMS implementation.

## Pinned upstream surface

```text
repository: contentauth/wp-plugin
commit:     4126f1c4b57d56862b1ca4667549e99ddd9de3fe
version:    0.1.0
```

The pilot pins the exact source blobs used to establish the interface contract:

```text
README.md                              1647fa4fbc7ce5296333a4d05a7eb3c917c6d143
signing-service/src/server.js          dec734c629fb157f1bfafc591c51c2f30a9cb50b
signing-service/src/signer.js          c5b85c1c78a6e17eda3141904ebaca04a3a92859
signing-service/src/cawg.js            179c1ce49fec3e042300d9d2dc43afd9e49fee4d
signing-service/src/reader.js          bb9b49d477b393a9f94abf54a2429c3737451990
```

At that exact upstream frontier:

- WordPress delegates C2PA operations to a separate Node.js signing service;
- `/v1/sign` accepts `product`, `cawg_org`, or `both` signature modes;
- `/v1/sign` also accepts `extra_assertions` and passes them through to the signing logic;
- the signer always constructs a `c2pa.actions` assertion containing `c2pa.published`;
- `both` causes the signer to add a `cawg.identity` organisational assertion;
- the signer appends caller-supplied extra assertion objects rather than replacing the built-in provenance/identity assertions;
- `/v1/read` exposes a plain JSON-safe manifest projection.

These are source-contract observations pinned to one immutable upstream SHA. They are not claims about every future release.

## Request-level composition

`build-request.py` constructs a deterministic projection of the upstream `POST /v1/sign` request.

It uses:

```text
signature_type = both
org_name       = Example Public Interest Press
org_url        = https://publisher.example/
```

and adds two C2PA 2.4 assertions through the upstream `extra_assertions` interface:

### AI disclosure

```text
label = c2pa.ai-disclosure
modelType = c2pa.types.model
humanOversightLevel = human_validated
```

The assertion records AI participation/oversight. The pilot explicitly rejects the following promotion:

```text
human_validated -> human authorship
human_validated -> publication authority
human_validated -> scoped responsibility
```

### External governance reference

The exact bytes of `external-governance-record.json` are SHA-256 hashed and inserted into a standard `c2pa.external-reference` assertion using the same hashed-reference approach established by P0.2.

```text
external UU-AAP publication-governance record
      -> exact bytes
      -> SHA-256
      -> c2pa.external-reference
      -> publication signing request
```

The detailed governance record therefore remains external. Private prompts and private deliberation are not embedded.

## Semantic separation under test

The external governance record deliberately assigns different meanings to different actors:

```text
C2PA product/claim-generator surface -> publishing software provenance
CAWG organisational identity        -> publisher-org-1 identity
UU-AAP authorship                    -> author-1
UU-AAP publication authority        -> editor-1
UU-AAP scoped responsibility        -> editor-1:publication_decision
C2PA AI disclosure                   -> ai-1 participation, human_validated
AI authority                         -> recommend only
factual truth                        -> NOT_ESTABLISHED
```

This preserves the boundary even though the upstream CAWG source uses ordinary-language wording about an organisation being responsible for content. A CAWG identity assertion may be evidence about organisational identity/association; it is not, by itself, the UU-AAP record of a particular human's authority or a scoped responsibility relation.

Similarly, the upstream `creator_name` field feeds a C2PA claim-generator label. The pilot does not treat that field name as evidence of UU-AAP authorship.

## Required safe result

```text
C2PA product surface        -> SOFTWARE_PRODUCT_PROVENANCE
CAWG identity surface       -> PUBLISHER_ORG_IDENTITY
AI disclosure               -> HUMAN_VALIDATED_AI_PARTICIPATION
c2pa.published action       -> PUBLISHED_OPERATION_PROVENANCE
external governance binding -> DIGEST_MATCH_REQUIRED
authorship                  -> author-1
publication authority       -> editor-1
scoped responsibility       -> editor-1:publication_decision
AI authority                -> RECOMMEND_ONLY
factual truth               -> NOT_ESTABLISHED
contestability              -> AVAILABLE
```

No single badge or aggregate score is permitted to stand in for these dimensions.

## Failure-closed vectors

CI deliberately mutates the composition and requires rejection of at least these unsafe states:

1. external governance bytes no longer match the embedded hash;
2. publisher organisational identity is promoted into the UU-AAP publication-authority actor;
3. CAWG identity is promoted into scoped responsibility;
4. `human_validated` AI disclosure grants the AI `approve_publication` authority;
5. claim-generator label is treated as the declared author;
6. `c2pa.published` is treated as proof of the publication decision/authority;
7. factual truth is promoted from `not_established` because provenance/identity assertions exist;
8. an aggregate trust/reputation score is introduced.

## What this acceptance does and does not prove

This pilot completes the **P0.6 semantic/interface acceptance criterion**: publication authorization is machine-represented separately from signer/product provenance, organisational identity, authorship, AI participation, and factual truth on a practical open publishing interface.

It does **not** claim:

- that this fixture was sent to a production WordPress deployment;
- that a trusted production certificate was used;
- that the constructed extra-assertion request has been live-signed by this exact upstream deployment;
- independent C2PA conformance of UU-AAP;
- independent CAWG conformance of UU-AAP;
- that CAWG identity is meaningless or non-authoritative in its own specification;
- that publication authorization establishes factual truth.

A later deployment-grade pilot can execute the same semantic contract with real certificates and artifacts without changing the actor/claim boundaries defined here.

## Run locally

```bash
python scripts/c2pa-wordpress-publishing-pilot/build-request.py \
  scripts/c2pa-wordpress-publishing-pilot/external-governance-record.json \
  scripts/c2pa-wordpress-publishing-pilot/pilot.fixture.json \
  /tmp/p0-6-sign-request.json

python scripts/c2pa-wordpress-publishing-pilot/validate-pilot.py \
  scripts/c2pa-wordpress-publishing-pilot/pilot.fixture.json \
  scripts/c2pa-wordpress-publishing-pilot/external-governance-record.json \
  /tmp/p0-6-sign-request.json
```

## Boundary

No `protocols/core/**` change. No custom UU-AAP C2PA namespace. No new cryptography. No new identity system. No prompt dump. No universal trust score.
