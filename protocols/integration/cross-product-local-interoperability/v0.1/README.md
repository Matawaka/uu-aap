# Cross-Product Local Interoperability v0.1

**Status:** experimental local read-only integration scenario  
**Issue:** #591  
**Origin frontier:** `c3056d552bfa8f07a01e571a6d17c7ed04f1f3d1`  
**Origin tree:** `0f05fde119e60f230ea469132d48fe19887386e8`  
**Predecessors:** IAL Compact v0.1, AI Gateway v0.1, AI Transport Reference v0.1

## Purpose

This profile implements the remaining Phase C requirement for one local interoperability scenario consumed by at least two independent products.

It does **not** add a new Core primitive, transport primitive, provider adapter, execution surface or shared product runtime.

The scenario composes two already-supported product lanes:

```text
Маркетолог Пессимиста
  -> IAL E0
  -> Gateway inspect
  -> AI Transport Reference packet

Честный найм
  -> IAL E1
  -> Gateway qualify
  -> AI Transport Reference packet

both lanes
  -> independent Transport revalidation
  -> shared-infrastructure check
  -> product-isolation check
  -> CrossProductLocalInteropReceipt
  -> READ_ONLY_INTEROPERABILITY_REVIEW_ONLY
  -> STOP
```

The proof target is deliberately narrow:

> The same IAL + AI Transport infrastructure can carry two different product semantics at one exact repository frontier without merging their identities, evidence, authority, responsibility or state.

## Why this is distinct from AI Transport conformance

AI Transport Reference v0.1 already contains two independent product vectors:

- `marketer-pessimist` E0;
- `honest-hiring` E1.

Those vectors establish that each product can independently use the transport profile.

This profile adds one typed composition boundary that validates both lanes together and produces one deterministic receipt about:

```text
shared infrastructure reuse
+
exact shared frontier
+
product identity isolation
+
product evidence isolation
+
semantic distinction
```

It does not reinterpret either product.

## Canonical product lanes

### Маркетолог Пессимиста

Exact binding:

```text
product_id = marketer-pessimist
product_version = 0.1
product_contract_hash = sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6
IAL elevation = E0
requested operation class = local_analysis
Gateway operation = inspect
Gateway result = inspected
```

Scenario role:

```text
local_claim_inspection
```

No publication, campaign send, provider invocation, advertising-account access or external mutation is introduced.

### Честный найм

Exact binding:

```text
product_id = honest-hiring
product_version = 0.1
product_contract_hash = sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae
IAL elevation = E1
requested operation class = display_candidate
Gateway operation = qualify
Gateway result = qualified
```

Scenario role:

```text
fictional_human_review_candidate
```

No ranking, rejection, hiring action, ATS mutation, messaging or real applicant processing is introduced.

## Exact-frontier rule

Both lanes must bind exactly the scenario evaluation frontier:

```text
repository
revision
observed_at
```

The production validator requires:

```text
scenario.evaluation_frontier
= marketer transport frontier
= honest-hiring transport frontier
```

The scenario does not refresh or infer a frontier.

The predecessor historical frontiers embedded in the committed source fixtures remain historical. The conformance harness clones the fixtures in memory, rebinds those clones to the issue origin frontier and recomputes their existing IAL identities through the predecessor API.

```text
Historical Fixture Frontier != Scenario Evaluation Frontier
Scenario Rebinding != Historical Fixture Rewrite
```

## Predecessor reuse

The production module imports:

```text
protocols/integration/ai-transport-reference/v0.1/reference-transport.js
```

For every lane it reruns:

```text
Transport.validatePacket(packet)
Transport.inspectPacket(packet)
```

Therefore a scenario cannot substitute its own summary for the IAL or Gateway semantics already enforced by AI Transport.

```text
Composition != Reimplementation
Embedded Summary != Trusted Predecessor Result
```

## Isolation checks

A positive scenario requires two distinct values for all of:

```text
product_id
transport_packet_id
IAL envelope_id
Gateway request_id
```

It additionally requires zero shared product-evidence digests across the two IAL envelopes.

The scenario v0.1 also forbids carried Core receipts, carried intent references and Gateway decision evidence refs. This keeps the first cross-product proof focused on product/infrastructure compatibility rather than cross-product evidence exchange.

```text
Interoperability != Evidence Exchange
Compatibility != Shared State
```

A successor profile may study explicitly typed evidence exchange only under a separate contract and review gate.

## Shared infrastructure

A positive receipt may state:

```text
IAL protocol = IAL
IAL version = 0.1
IAL profile = compact-envelope-v0.1
Transport protocol = UU-AAP-AI-TRANSPORT-REFERENCE
Transport version = 0.1
Transport profile = local-evidence-packet-v0.1
exact_frontier_shared = true
local_only = true
read_only = true
```

These are compatibility facts, not authority facts.

## Positive claims

The strongest allowed positive claims are:

```text
local_cross_product_interoperability_observed = true
shared_infrastructure_reused = true
exact_frontier_shared = true
product_identity_isolation_preserved = true
product_semantics_remain_distinct = true
```

No stronger interoperability or operational claim is inferred.

## Mandatory false claims

Every receipt keeps false:

```text
product_semantics_merged
cross_product_data_shared
cross_product_state_shared
authority_transferred_between_products
responsibility_transferred_between_products
authority_created
responsibility_accepted
action_permit_created
execution_admitted
transport_delivery_performed
provider_invoked
external_effect_performed
successor_authority_created
stable_core_promotion_established
universal_interoperability_established
```

## Canonical non-effects

```text
Shared Infrastructure != Shared Product Semantics
Cross-Product Interoperability != Cross-Product Data Sharing
Cross-Product Interoperability != Cross-Product State Sharing
Cross-Product Composition != Authority Transfer
Cross-Product Composition != Responsibility Transfer
Transport Reuse != Provider Invocation
Transport Inspection != Network Delivery
Interoperability Receipt != ActionPermit
Interoperability Receipt != Execution Admission
Local Scenario != External Effect
Product Compatibility != Stable-Core Promotion
Bounded Interoperability != Universal Interoperability
```

## Scenario controls

The input fixes:

```text
local_only = true
read_only = true
network_access_required = false
filesystem_write_required = false
transport_delivery_available = false
provider_invocation_available = false
cross_product_data_sharing = false
cross_product_state_sharing = false
authority_transfer_available = false
responsibility_transfer_available = false
action_permit_available = false
execution_available = false
external_effect_available = false
automatic_retry = false
```

Any weakening fails closed.

## CLI / SDK

The production surface exposes only:

```text
validate
inspect
help
```

Examples:

```bash
node protocols/integration/cross-product-local-interoperability/v0.1/local-interoperability.js validate scenario.json
node protocols/integration/cross-product-local-interoperability/v0.1/local-interoperability.js inspect scenario.json
```

The CLI may read JSON from a file or stdin. It performs no filesystem write.

Commands such as these are rejected:

```text
send
execute
share
merge
activate
publish
```

## Receipt identity

Both scenario and receipt use a local deterministic content identity:

```text
sha256(
  UTF8(
    recursively-key-sorted compact JSON
    with top-level content_hash replaced by ""
  )
)
```

This is a profile-local deterministic identity rule and not a universal canonicalization claim.

## Conformance

`test-local-interoperability.js` constructs both Transport packets in memory from the committed IAL product fixtures and validates the positive composition.

It rejects, among other vectors:

- unknown scenario fields;
- duplicate/substituted product lanes;
- product-contract hash substitution;
- E0/E1 lane packet substitution;
- Gateway operation substitution;
- mixed exact frontiers;
- provider binding;
- delivery requests;
- cross-product data/state-sharing enablement;
- authority/responsibility-transfer enablement;
- ActionPermit/execution/external-effect enablement;
- duplicate packet or Gateway request identities;
- shared product-evidence digests;
- every prohibited receipt claim;
- unknown receipt claims;
- actuating CLI commands.

## Phase C boundary

This scenario is intended to satisfy the local two-product interoperability requirement without turning Phase C into an execution phase.

The strongest successor after a positive receipt is:

```text
READ_ONLY_INTEROPERABILITY_REVIEW_ONLY
```

The next product work belongs to separately reviewed MVP/pilot increments.

## Non-effects

This profile does not:

- send a network packet;
- invoke a provider;
- publish marketing content;
- process a real applicant;
- mutate an ATS, mailbox, calendar or advertising account;
- activate KONTUR;
- accept responsibility;
- create authority;
- create or carry an ActionPermit;
- admit execution;
- perform an external effect;
- create successor authority;
- promote anything into Stable Core;
- establish universal interoperability;
- release, tag or merge automatically.
