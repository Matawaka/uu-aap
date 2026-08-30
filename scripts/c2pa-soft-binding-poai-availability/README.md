# P0.8 Durable Soft-Binding Resolvability × PoAI Decision-Time Availability v0.1

Status: **additive executable interoperability composition for #794**. This is not a new C2PA binding protocol, not a TrustMark implementation, not UU-AAP Core, and not a claim that present-day resolvability rewrites historical evidence availability.

Canonical predecessor:

`7353084b9a78b6c3d478cfc81732773d5d0f2441`

## Question

P0.8 asks one narrow temporal question:

> If a standard C2PA soft binding successfully resolves to a retained manifest now, does that prove the manifest or its evidence was available to a decision-maker before an earlier Decision Boundary?

P0.8 requires the answer to remain **no unless independent pre-cutoff resolution and delivery evidence exists**.

```text
soft binding present
        ↓
manifest resolves now
        ≠
manifest delivered before historical cutoff
        ≠
manifest considered before decision close
```

## Reused PoAI boundary

P0.8 does not define a new time or availability model. It binds the exact merged P0.4 fixture:

- `scripts/c2pa-agent-composition/composition.fixture.json`;
- Git blob `143609c6d58a978e2eb3570aa9d093dccada092a`.

The reused Decision Boundary is:

```text
opened_at         2026-08-30T08:50:00Z
knowledge_cutoff  2026-08-30T09:00:00Z
closed_at         2026-08-30T09:05:00Z
```

P0.4 already separates `temporal_fit`, `delivery`, overall availability, consideration, authority and truth. P0.8 only supplies a different provenance/retrieval mechanism to those semantics.

## Standard soft-binding reference surface

### Adobe TrustMark

Pinned reference:

`adobe/trustmark@0ed40cbe8188f664fd9cbbeacd969807de27440a`

The pinned `c2pa/README.md` explains the Durable Content Credential pattern: when embedded manifest data is removed, a watermark-carried TrustMark identifier can act as a key for looking up retained C2PA manifest data. It explicitly calls that identifier a **soft binding**.

The pinned `c2pa/c2pa_watermark_example.py` emits:

```text
label = c2pa.soft-binding
alg   = com.adobe.trustmark.Q
```

P0.8 inspects this source contract but does not download TrustMark models or run watermark inference.

### C2PA soft-binding algorithm registry

Pinned registry:

`c2pa-org/softbinding-algorithm-list@a9d9699097785b6ffa8e46cefba21f366308fa06`

The registry contains:

```text
identifier          4
alg                 com.adobe.trustmark.Q
type                watermark
decodedMediaTypes   image
```

The registry identifier and the soft-binding block value are not treated as identity, authority, truth, or a PoAI availability receipt.

### C2PA specification source

The reference source frontier is pinned to:

`c2pa-org/specifications@9c58c8c27044e44e8601f6ab13f1bcac1376eb1f`

This is a reference anchor only. P0.8 does not redefine C2PA soft-binding resolution semantics.

## Baseline executable scenario

`fixture.json` contains a standard-shaped soft-binding assertion and a deterministic resolver history.

```text
08:55  soft-binding lookup -> NOT_FOUND
09:00  PoAI knowledge cutoff
09:04  consideration -> NOT_USED
09:05  decision closes
09:30  repository ingests manifest
10:00  same soft binding -> RESOLVED
```

Expected receipt:

```text
current resolution        SOFT_BINDING_RESOLVES_NOW
historical temporal_fit   unavailable
historical delivery       unavailable
PoAI availability         UNAVAILABLE_BEFORE_CUTOFF
consideration             NOT_USED
truth                     NOT_ESTABLISHED
authority                 UNCHANGED
responsibility            UNCHANGED
```

The result is intentionally non-scalar.

## Why repository ingestion is separate

A repository may possess a manifest without the decision-maker receiving it.

Therefore P0.8 keeps these events distinct:

```text
repository_ingestion
resolution
 delivery_to_decision
consideration
```

An ingestion timestamp alone never creates `delivery` or `consideration` evidence.

## Counterfactual suite

`test.py` proves the baseline result is causal rather than hard-coded.

### Pre-cutoff resolution, no delivery

```text
RESOLVED before cutoff
+ delivered_to_decision = false
-> temporal_fit = available
-> delivery = unavailable
-> overall = UNAVAILABLE_BEFORE_CUTOFF
```

### Pre-cutoff resolution + delivery

```text
RESOLVED before cutoff
+ delivered_to_decision = true
-> AVAILABLE_BEFORE_CUTOFF
```

Even then:

```text
availability != consideration
```

The explicit `NOT_USED` consideration observation remains unchanged.

### Historical delivery, current resolution failure

A later resolver failure does not erase prior historical availability:

```text
AVAILABLE_BEFORE_CUTOFF
+ current NOT_FOUND
-> historical availability stays AVAILABLE_BEFORE_CUTOFF
```

### Early repository ingestion alone

Moving repository ingestion before the cutoff does not establish delivery or consideration and therefore does not make the resource decision-time available.

## Typed receipt

`validate.py` emits:

`urn:uu-aap:c2pa-soft-binding-poai-availability-receipt:0.1`

The receipt keeps separate:

- standard soft-binding label, algorithm and opaque value;
- current resolver state;
- Decision Boundary;
- successful pre-cutoff resolution events;
- pre-cutoff delivery events;
- historical availability;
- consideration evidence;
- repository ingestion;
- truth/authorship/authority/responsibility non-effects.

`receipt.schema.json` validates that structure.

## Invariants

```text
identifier present != manifest delivered
resolvable now != available then
repository ingestion != decision-time delivery
repository ingestion != consideration
current lookup success != historical reliance
availability != consideration
soft-binding resolution != truth
soft-binding resolution != authorship
soft-binding resolution != authority
soft-binding resolution != responsibility
```

## CI boundary

The workflow:

1. runs the deterministic baseline and counterfactual suite;
2. validates the typed receipt schema;
3. re-runs the merged P0.4 validator unchanged;
4. proves the exact P0.4 fixture Git blob is still bound;
5. clones only pinned public TrustMark, soft-binding registry, and C2PA specification source frontiers read-only;
6. validates that TrustMark and the registry expose the expected standard soft-binding surface;
7. checks `protocols/core/**` is untouched and the checkout remains clean.

There is deliberately no live third-party resolution dependency. Network reachability today is not used as a substitute for historical resolver evidence.

## Non-effects

P0.8 does not:

- create a UU-AAP C2PA namespace;
- create a new soft-binding algorithm;
- execute TrustMark ML inference;
- treat a watermark as identity;
- infer delivery from identifier presence;
- infer historical availability from current resolution;
- infer consideration from repository ingestion or availability;
- infer truth, authorship, authority or responsibility from resolution;
- create a trust, reputation, confidence, or compatibility score;
- modify UU-AAP Core.
