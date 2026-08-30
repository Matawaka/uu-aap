# P1.1 Layered Verifier Presentation Contract v0.1

Status: **additive executable presentation semantics for #796**. It is not UU-AAP Core, not C2PA conformance, not a production verifier, not a public trust badge, and not a protocol-defined truth score.

Canonical predecessor:

`b09f8047140f7966bcb38ce9339b7cc6bc7404a7`

## Why this exists

The P0 interoperability work proved that different layers can return different correct answers about the same decision context. A UI can destroy that separation if it compresses all evidence into one badge, score, color or word such as `verified`.

P1.1 therefore makes the presentation boundary executable before choosing a public deployment surface.

```text
evidence receipts
      ↓
seven-dimensional presentation contract
      ↓
reference HTML renderer
      ↓
human-visible separate claims
```

The presentation layer is a **projection**, not a new source of evidence.

## Normative and executable anchors

P1.1 binds existing repository semantics instead of redefining them.

### UU-AAP SPEC §22

`SPEC.md` Git blob:

`44b91e0e48dee9d928c843bbb304a5c246582da7`

Section 22 requires separate verifier results for schema validity, artifact binding, signature validity, transparency/registry presence, conformance profile, responsibility, review, disputes and unresolved warnings. It also states that the verifier MUST NOT output a protocol-defined single truth score.

P1.1 leaves SPEC unchanged.

### P0.4

`composition.fixture.json` Git blob:

`143609c6d58a978e2eb3570aa9d093dccada092a`

It already proves:

```text
CREDENTIALS_PRESENT
!=
UNAVAILABLE_BEFORE_CUTOFF
!=
HUMAN_PUBLICATION_AUTHORITY
```

### P0.7

`corpus-v0.1.json` Git blob:

`6983cf2fd6e7740127d219a26cc747dd90a95196`

It proves that valid integrity/repository evidence cannot be displayed as `Verified True`, and that signer, AI disclosure, ingredient and action metadata cannot be silently promoted into authorship, responsibility, concept origin or publication authority.

### P0.8

`fixture.json` Git blob:

`75e5655e4d90d4c1381f968338e567962116fad9`

It proves:

```text
resolvable now != available then
availability != consideration
```

## Seven dimensions

A presentation always contains exactly:

1. `integrity`
2. `identity`
3. `provenance`
4. `availability`
5. `authority`
6. `responsibility`
7. `truth`

A dimension does not disappear when evidence is missing. It becomes `NOT_EVALUATED` or `UNKNOWN`.

Each dimension carries:

- a domain-specific `value`;
- an `evaluation` state;
- a `source_layer`;
- `evidence_refs`;
- a human-facing explanation;
- explicit `does_not_establish` boundaries.

This prevents missing evidence from becoming a hidden negative or positive inference.

## Reference fixture

`fixture.json` is deliberately marked:

`synthetic_cross_surface_reference`

It composes already-tested semantics for presentation testing. It does **not** claim that all referenced P0 observations concern one real-world artifact.

The baseline renders:

```text
integrity       VALID
identity        NOT_EVALUATED
provenance      CREDENTIALS_PRESENT
availability    UNAVAILABLE_BEFORE_CUTOFF
authority       HUMAN_PUBLICATION_AUTHORITY
responsibility  SCOPED_RESPONSIBILITY_PRESENT
truth           NOT_ESTABLISHED
```

Related observation:

`consideration = NOT_USED`

No aggregate conclusion is permitted.

## Presentation contract

`build.py` validates the fixture and emits:

`urn:uu-aap:layered-verifier-presentation:0.1`

`presentation.schema.json` validates the emitted representation.

The builder fails closed if:

- a dimension disappears;
- a dimension invents evidence while `NOT_EVALUATED`;
- evaluated dimensions have no evidence references;
- required non-effects disappear;
- an aggregate score/verdict flag becomes true;
- score/verdict-like semantic fields are inserted.

## Reference HTML renderer

`render.py` produces deterministic, semantic HTML.

It uses:

- one `<section data-dimension="...">` per dimension;
- text labels for value, evaluation and source layer;
- visible evidence references;
- visible `does_not_establish` lists;
- separate warning/dispute sections;
- no JavaScript;
- no network access;
- no color-only semantics.

`reference.html` is the exact snapshot used by tests.

The renderer is **not** the final public UI.

## Adversarial presentation tests

`test.py` proves:

```text
integrity != truth
identity != authority
provenance != historical availability
availability != consideration
availability != authority
warning/dispute != artifact invalidity
```

It also proves:

- changing `integrity` does not alter `truth`;
- adding an identity attestation does not alter authority or responsibility;
- credentials can remain present while historical availability is unavailable;
- pre-cutoff availability can become available without consideration or authority changing;
- a dispute can coexist with unchanged integrity;
- identity without evidence remains `NOT_EVALUATED`;
- aggregate trust/truth verdict injection fails closed.

## Non-effects

P1.1 does not:

- modify `protocols/core/**`;
- modify UU-AAP SPEC §22;
- redefine C2PA validation;
- define identity semantics;
- define a new trust model;
- create an overall authenticity/trust/reliability score;
- create an umbrella `verified` badge;
- infer truth from integrity;
- infer authority from identity;
- infer historical availability from provenance;
- infer consideration from availability;
- publish a verifier to GitHub Pages.

## Next decision boundary

After this contract is accepted, a public verifier can reuse it without reinterpreting protocol semantics.

The next deployment choice is intentionally separate:

```text
GitHub Pages reference verifier
vs
embeddable component/library
vs
both
```

That is a distribution/product decision, not a semantic-contract decision.
