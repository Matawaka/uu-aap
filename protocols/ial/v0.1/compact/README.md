# IAL Compact Envelope + read-only CLI v0.1

**Status:** experimental product-facing IAL profile  
**Tracking:** Issue #524  
**Origin frontier:** `b4faf8e759e5839b6d5ddf9ce461231b2d85375c`  
**Origin tree:** `10f3145563fef126eef9c7d2307d7a7afc44fcf8`

## Purpose

The Compact Envelope makes the existing Intent/Action Language consumable by product tools through one small, deterministic, provider-neutral surface:

```text
parse -> validate -> inspect -> STOP
```

It is a preflight wrapper around an intent/action boundary candidate. It does not replace the full IAL handoff chain and it does not provide an execution surface.

```text
IAL Compact Envelope != ResponsibilityHandoffAcceptance
IAL Compact CLI != Actuator
Inspection Receipt != ActionPermit
```

## First independent consumers

The v0.1 conformance vectors bind two separately defined products:

1. **Маркетолог Пессимиста** — E0 local claim inspection;
2. **Честный найм** — E1 display candidate for a fictional human-review packet.

The product contract path, version and content hash are exact evidence bindings. They do not transfer authority from the product to IAL or from IAL to the product.

```text
Consumer Binding != Authority Transfer
Product Semantics != Reverse Core Dependency
```

## Files

- `compact-envelope.schema.json` — structural contract for one input envelope;
- `inspection-receipt.schema.json` — deterministic read-only inspection result;
- `ial-compact.js` — CLI and reusable JavaScript functions;
- `test-compact.js` — E0-E3 positive checks and fail-closed mutations;
- `examples/marketer-pessimist-e0.envelope.json` — exact E0 product vector;
- `examples/honest-hiring-e1.envelope.json` — exact E1 product vector.

## Compact envelope

The envelope carries only the externally relevant preflight facts:

```text
exact frontier
+ exact Product Contract identity
+ declared intent / scope / non-goals
+ target
+ E0-E3 boundary flags
+ current responsibility and optional handoff candidate
+ evidence references
+ requested operation class
+ fixed no-execute controls
+ assertions / non-effects
+ deterministic content hash
```

It intentionally does not carry an accepted handoff or downstream authority/admission artifact. All authority-reference fields are nullable and fixed to `null` in this profile.

```text
Present Field != Established Authority
Nullable Reference != Permission to Infer a Reference
```

## Identity

The content hash is:

```text
sha256(
  UTF8(
    recursively-key-sorted compact JSON of the envelope
    with identity.content_hash replaced by ""
  )
)
```

This is a local IAL Compact v0.1 identity rule, not a universal canonical-JSON claim.

## E0-E3 inspection behavior

### E0 — internal action

Required shape:

```text
observable_effect = false
responsibility_handoff = false
materialization_commitment = false
operation_class = local_analysis
external_mutation_requested = false
```

Inspection result:

```text
status = IAL_NOT_REQUIRED
responsibility_boundary_required = false
```

The envelope may be parsed as a transient product/transport input, but no IAL responsibility-handoff artifact should be inferred or retained merely because parsing succeeded.

### E1 — observable output under unchanged responsibility

Required shape:

```text
observable_effect = true
responsibility_handoff = false
materialization_commitment = false
operation_class = display_candidate
```

Inspection result remains:

```text
responsibility_accepted = false
authority_established = false
execution_admitted = false
```

The receipt identifies a boundary and requires the downstream Action Gate to remain separate.

### E2 — responsibility handoff candidate

E2 requires:

- a named receiving party;
- a non-empty exact handoff scope;
- the existing full IAL offer/acceptance/attestation chain downstream.

The compact envelope itself keeps:

```text
acceptance_ref = null
responsibility_accepted = false
```

### E3 — materialization candidate

E3 identifies a durable/canonical commitment candidate and therefore requires downstream:

- exact authority evidence;
- Action Gate / execution admission;
- materialization permission;
- precondition revalidation;
- observation and reconciliation.

The Compact CLI establishes none of them.

```text
E3 Materialization Candidate != Materialization Permission
Validation Success != Commit
```

## CLI

### Help

```bash
node protocols/ial/v0.1/compact/ial-compact.js help
```

### Parse JSON syntax and emit deterministic key order

```bash
node protocols/ial/v0.1/compact/ial-compact.js parse \
  protocols/ial/v0.1/compact/examples/marketer-pessimist-e0.envelope.json
```

### Validate schema-equivalent shape, semantics, product binding presence and content hash

```bash
node protocols/ial/v0.1/compact/ial-compact.js validate \
  protocols/ial/v0.1/compact/examples/marketer-pessimist-e0.envelope.json
```

### Inspect boundary requirements

```bash
node protocols/ial/v0.1/compact/ial-compact.js inspect \
  protocols/ial/v0.1/compact/examples/honest-hiring-e1.envelope.json
```

### Read from stdin

```bash
cat envelope.json | node protocols/ial/v0.1/compact/ial-compact.js validate -
```

The only accepted commands are:

```text
parse
validate
inspect
help
```

`execute` and every other command fail closed.

## Runtime non-effects

The CLI:

- performs no network access;
- imports no process-spawning or network module;
- writes no file;
- invokes no provider or adapter;
- performs no repository mutation;
- creates no ActionPermit;
- accepts no responsibility;
- admits no execution;
- permits no materialization;
- observes no external outcome.

Output is written only to stdout. Errors are written to stderr as `IAL_COMPACT_REJECTED`.

## Inspection receipt

Every successful inspection fixes these stronger claims to `false`:

```text
responsibility_accepted
authority_established
action_permit_established
execution_admitted
materialization_permitted
external_effect_observed
canonical_state_established
```

Requirements vary by elevation level, but a requirement is not a satisfied prerequisite.

```text
Downstream Gate Required != Downstream Gate Passed
```

## Required invariants

```text
IAL Envelope != Responsibility Acceptance
IAL Expression != Authority
IAL Expression != Execution Admission
Validation Success != ActionPermit
Inspection Receipt != External Effect
Consumer Binding != Authority Transfer
Private Reasoning != Required Payload
E0 Parsing != Responsibility Artifact Creation
E1 Observability != External Mutation Authority
E2 Handoff Candidate != Accepted Handoff
E3 Materialization Candidate != Materialization Permission
```

## Validation

```bash
node protocols/ial/v0.1/test-ial.js /tmp/ial-e2-handoff-result.json
node protocols/ial/v0.1/compact/test-compact.js /tmp/ial-compact
```

The dedicated CI also:

- validates both JSON Schemas;
- verifies exact origin commit/tree;
- verifies the two Product Contract paths, versions and hashes;
- exercises file and stdin CLI modes;
- validates emitted E0-E3 inspection receipts;
- proves that the `execute` command is rejected;
- guards the CLI against network, subprocess and filesystem-write APIs;
- confirms the checkout remains unchanged.

## Relationship to the next transport increment

The Compact Envelope is the semantic input surface. A later AI Transport Reference CLI/SDK may carry the envelope and downstream Core/authority receipts through provider-neutral adapters.

That later layer must preserve:

```text
Transport != Authority
Envelope Transported != Envelope Admitted
Provider Response != Observed Outcome
Unknown Outcome != Permission to Retry
```

This increment does not pre-authorize that transport implementation.
