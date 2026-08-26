# UU-AAP Product Contract v0.1

**Status:** experimental reusable product-boundary profile  
**Tracking:** Issue #514  
**Baseline frontier:** `55dda89ac681e2c7ffbc90f00fe33852c35e8c65`

## Purpose

A Product Contract turns a named product idea into an explicit, reviewable boundary before deep implementation.

It describes:

```text
Product identity and exact version
→ user outcome and anti-goals
→ actors and responsibilities
→ evidence and provenance
→ data boundaries
→ possible effects and non-effects
→ human gates
→ failure / uncertainty / reconciliation
→ contestability
→ receipts and success criteria
→ dependency and IP object boundaries
```

The contract is descriptive. It does not execute a product and does not grant authority.

## Core invariants

```text
Product Contract != Product Runtime
Product Contract != ActionPermit
Described Effect != Authorized Effect
Dependency Edge != Authority Transfer
Product Success != Stable-Core Requirement
Contract Acceptance != Responsibility Acceptance
Contract Version != Future Version
IP Object Boundary != Registration Outcome
```

A product may consume Core, IAL, transport, KONTUR or protective services. That dependency does not transfer authority or responsibility and does not allow product-specific semantics to become a reverse dependency of Core.

## Files

- `product-contract.schema.json` — JSON Schema Draft 2020-12 structural contract;
- `templates/product-contract.template.json` — reusable, intentionally unbound template;
- `examples/local-evidence-review.example.json` — exact-frontier, local no-effect example;
- `validate_product_contract.py` — schema, semantic, hash and fail-closed validation.

## Document classes

### `template`

The template is intentionally unbound:

```text
frontier.binding = template_unbound
revision = UNBOUND_TEMPLATE
portfolio_product = false
```

Placeholder instructions are permitted only in this document class.

### `example`

An example is bound to an exact repository frontier but is not a portfolio product. The included example performs only local evidence classification and has an empty `external_effects` list.

### `product_contract`

A real product contract must:

- bind to an exact 40-character Git revision;
- remove every placeholder;
- identify the exact product version;
- preserve all authority, data, uncertainty and IP non-effects;
- remain separately reviewed from runtime implementation.

## Identity

The contract hash is:

```text
sha256(
  UTF8(
    canonical-json(
      product-contract with identity.content_hash replaced by ""
    )
  )
)
```

The v0.1 canonical representation is recursively key-sorted JSON with compact separators and UTF-8 text. This is a local Product Contract v0.1 identity rule, not a universal canonical-JSON claim.

Changing any product boundary requires a new hash and successor review.

## Evidence and data

Every evidence input requires provenance and declares:

- source class;
- referenced data classes;
- minimum sufficiency;
- freshness policy;
- absence handling.

The schema fixes these boundaries:

```text
Missing Evidence != Negative Evidence
Available Evidence != Permission to Inspect
Stored Relation != Permitted Correlation
Available Evidence != Active Knowledge
```

Data classes declare collection, minimization, retention, disclosure, correction and deletion behavior. Cross-context correlation and identity resolution are denied by default.

## Effects

Local analysis effects must carry:

```json
"external_effect": false
```

External effects may be described only when they remain denied by default and require all of:

- a separately valid `ActionPermit`;
- a fail-closed human gate;
- exact-frontier revalidation;
- a separate bounded actuator;
- idempotency or single-use evidence;
- `observe_before_retry`;
- no automatic retry after `UNKNOWN`.

The Product Contract itself fixes:

```text
execution_authorized = false
action_permit_created = false
responsibility_accepted = false
stable_core_promotion_authorized = false
legal_outcome_established = false
```

## Human gates and contestability

Every contract has at least one human gate. Gate owners must be human or organizational roles. An AI system or software component cannot become an authority source merely by appearing in the actor list.

Every contract also declares a challenge and correction path. Corrections create a successor state rather than silently rewriting predecessor evidence.

## Failure and uncertainty

The contract must include `UNKNOWN` and `CONFLICT`, identify terminal states and name a reconciliation owner.

```text
UNKNOWN != SUCCESS
CONFLICT != AUTOMATIC RETRY
CORRECTION != HISTORY DELETION
```

## Dependencies

Every dependency fixes:

```text
authority_transfer = false
responsibility_transfer = false
reverse_core_dependency = false
```

This permits shared infrastructure without turning transport, runtime or protective review into an authority source.

## IP boundary

The IP section lists exact included and excluded artifacts. It cannot claim future versions, registration or another legal outcome.

```text
Exact Artifact Scope != General Idea Ownership
Application Filing != Registration
Current Version != Future Version
```

## Validation

```bash
python -m pip install "jsonschema>=4.22,<5"
python schemas/product-contract/v0.1/validate_product_contract.py
```

Expected result:

```text
UU-AAP Product Contract v0.1 validation: PASS
(2 positive fixtures; 50 fail-closed mutations rejected)
```

The negative suite rejects authority amplification, missing human roles, provenance loss, fail-open gates, hidden correlation, unsafe retry, dependency authority transfer, reverse Core dependencies, IP overclaim and content-hash substitution.

## Intended next consumers

After this reusable layer is merged, separate contracts can be created in the roadmap order:

1. Маркетолог Пессимиста;
2. FREESHIELD;
3. Честный найм;
4. KONTUR Product Family.

Each remains a separate review and human merge gate. This profile does not pre-authorize those contracts or their runtimes.
