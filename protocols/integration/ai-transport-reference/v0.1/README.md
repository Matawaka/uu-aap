# UU-AAP AI Transport Reference CLI/SDK v0.1

**Status:** experimental local reference transport profile  
**Issue:** #587  
**Origin frontier:** `7b712abe8f70e51468a24eecc97d61c0927603f8`  
**Origin tree:** `c4cd20c03e41bd0c53d685262f4684597566f056`  
**Predecessors:** IAL Compact v0.1 and AI Gateway v0.1

## Purpose

This increment is the first provider-neutral transport productization layer after IAL Compact.

It answers one deliberately narrow question:

> Can an already-valid IAL responsibility-boundary expression and an already-valid AI Gateway assessment be packaged, revalidated and inspected through one exact-frontier transport representation without the transport becoming an authority source, Action Gate, provider invocation or actuator?

The v0.1 answer is implemented as a **local evidence packet** and import-safe JavaScript SDK/CLI.

```text
IAL Compact Envelope
-> canonical IAL inspection
-> AI Gateway request
-> AI Gateway decision
-> AI Transport Reference Packet
-> validate / inspect
-> STOP
```

There is no delivery step in this profile.

## Boundary

Canonical distinctions:

```text
Transport Packet != Transport Delivery
Transport Validation != Network Send
Transport != Authority
Transport != Responsibility Acceptance
Transport != ActionPermit
Transport != Execution Admission
IAL Inspection != Gateway Decision
Gateway Decision != Core Receipt
Consumer Binding != Authority Transfer
Exact Frontier Binding != Frontier Refresh
Provider Neutrality != Provider Invocation
```

The transport packet is evidence-bearing data. It is not a transport session, provider call, actuator request or execution capability.

## Reused predecessor APIs

The implementation imports and directly reuses:

- `protocols/ial/v0.1/compact/ial-compact.js`
- `protocols/integration/ai-gateway/v0.1/validate-gateway.js`

It does not duplicate either predecessor's responsibility or Gateway validation semantics.

As part of #587, the Gateway validator receives one library-seam refactor only: its historical conformance fixture executes under direct invocation, while `require()` becomes silent and does not load the fixture. Direct validation behavior and negative vectors remain the predecessor contract.

```text
Import Safety != Semantic Relaxation
Library API != New Authority
```

## AITransportReferencePacket

`transport-packet.schema.json` defines the packet.

A packet contains:

- exact repository frontier;
- product identity;
- complete IAL Compact Envelope;
- its deterministic canonical IAL inspection receipt;
- one AI Gateway request;
- the corresponding AI Gateway decision;
- fixed local-only transport controls;
- explicit assertions and non-effects;
- a deterministic packet content hash.

The packet does not trust the embedded predecessor receipts merely because they are present.

Runtime validation re-runs:

```text
IAL.validateEnvelope()
IAL.inspectEnvelope()
Gateway.validateRequest()
Gateway.validateDecision()
```

and then verifies the cross-layer bindings.

## Exact-frontier rule

All layers in one reference packet must resolve to one repository revision:

```text
packet.frontier.revision
= IAL envelope frontier.revision
= Gateway request.frontier
= Gateway decision.frontier
= every carried Gateway/Core evidence ref frontier
```

The packet cannot refresh or infer a successor frontier.

The IAL frontier's `repository`, `revision` and `observed_at` are copied exactly into the packet.

## Consumer binding

The packet binds one product contract identity:

```text
packet.consumer.product_id
= IAL consumer.product_id

packet.consumer.product_version
= IAL consumer.product_version

packet.consumer.product_contract_hash
= IAL consumer.product_contract_hash
```

The Gateway subject is additionally required to bind the same product and IAL envelope:

```text
urn:uu-aap:product:<product_id>:<envelope_id>
```

Substituting a different product label without changing and revalidating the predecessor chain fails closed.

## v0.1 operation surface

The reference profile accepts Gateway operations:

```text
inspect
qualify
```

with results:

```text
inspect -> inspected | denied
qualify -> qualified | denied
```

It rejects Gateway `authorize` and external-effect carriage in this profile.

Required Gateway action properties are:

```text
read_only = true
external_effect = false
requires_approval = false
approval_ref = null
```

The reason is architectural, not permanent: v0.1 proves evidence transport before provider delivery or action authority is introduced.

## ActionPermit boundary

The local reference profile rejects an `ActionPermit` in either the Gateway request Core refs or Gateway decision evidence refs.

This is stricter than the general AI Gateway contract and intentional for this increment.

```text
Core Evidence Carriage != ActionPermit Carriage
ActionPermit Carriage != Execution Admission
```

A later exact-frontier execution transport profile, if justified by product evidence, must define its own action-authority boundary rather than inheriting it accidentally from this packet.

## First two product consumers

The conformance suite consumes the two canonical IAL Compact product examples:

1. `marketer-pessimist` at E0;
2. `honest-hiring` at E1.

The test does not modify the committed predecessor fixtures. It clones each IAL envelope in memory, binds the clone to the #587 origin frontier, recomputes its canonical IAL hash through `IAL.rehash()`, and then constructs a local read-only Gateway pair.

### Маркетолог Пессимиста

```text
E0 local analysis
-> Gateway inspect
-> inspected
-> local transport packet
-> inspection receipt
-> STOP
```

No publication, campaign send, advertising account access or provider invocation is enabled.

### Честный найм

```text
E1 observable human-review candidate
-> Gateway qualify
-> qualified
-> local transport packet
-> inspection receipt
-> STOP
```

No applicant ranking, rejection, hiring action, ATS mutation, messaging or real applicant processing is enabled.

## Core-carrying compatibility vector

A third fully synthetic vector adds one exact-frontier `StateReceipt` reference to the read-only Gateway pair.

The transport inspection may report its receipt type as carried evidence, but still fixes:

```text
authority_created = false
responsibility_accepted = false
action_permit_created = false
execution_admitted = false
action_permit_present = false
```

This proves the minimal statement needed by the roadmap:

> the reference transport can preserve Core evidence without transforming Core evidence into transport authority.

It does not prove execution interoperability.

## CLI

The CLI exposes only:

```text
validate
inspect
help
```

Examples:

```bash
node protocols/integration/ai-transport-reference/v0.1/reference-transport.js validate packet.json
node protocols/integration/ai-transport-reference/v0.1/reference-transport.js inspect packet.json
cat packet.json | node protocols/integration/ai-transport-reference/v0.1/reference-transport.js inspect -
```

The CLI has no command named or equivalent to:

```text
send
execute
invoke
publish
merge
delete
mutate
grant
permit
activate
```

`readInput()` may read a local file or stdin. The protocol requires no filesystem write.

## SDK

Import:

```js
const Transport = require('./protocols/integration/ai-transport-reference/v0.1/reference-transport.js');
```

Main functions:

```text
validatePacket(packet)
createPacket({ packetId, ialEnvelope, gatewayRequest, gatewayDecision })
inspectPacket(packet)
validationReceipt(packet)
computeContentHash(packet)
rehash(packet)
runCli(argv)
```

Importing the SDK must:

```text
write stdout = false
write stderr = false
read packet/fixture/product files = false
invoke provider = false
use network = false
```

`createPacket()` creates only an in-memory local representation after predecessor validation. It does not deliver the packet.

## Inspection receipt

`inspectPacket()` returns `AITransportReferenceInspectionReceipt`.

It exposes enough information to verify:

- packet identity and hash;
- exact frontier;
- product identity;
- IAL envelope/hash/elevation/status;
- Gateway request/hash/operation/result;
- carried Core receipt type names;
- absence of ActionPermit;
- absence of delivery, authority creation, responsibility acceptance and execution admission.

It intentionally does not expose private reasoning.

## Fail-closed vectors

The conformance suite rejects at least:

1. cross-product consumer substitution;
2. stale packet frontier;
3. altered IAL inspection receipt;
4. altered Gateway request after hashing;
5. Gateway decision authority overclaim;
6. external-effect carriage;
7. provider binding in the local reference profile;
8. delivery request;
9. stale carried Core evidence;
10. ActionPermit carriage;
11. Gateway `authorize` operation;
12. forbidden `send` CLI command.

It also validates positive E0, E1 and Core-StateReceipt carriage cases.

## Import-safety tests

Two explicit import boundaries are tested:

1. AI Gateway v0.1 import;
2. AI Transport Reference v0.1 SDK import.

The tests capture stdout/stderr and track direct `fs.readFileSync` calls during import.

The historical Gateway conformance suite is then executed explicitly to prove that moving fixture loading behind the library boundary did not remove its direct validator coverage.

## CI

The dedicated workflow re-runs:

- IAL Compact conformance;
- IAL schema/runtime parity;
- AI Gateway historical conformance;
- AI Gateway import-safety;
- AI Transport Reference conformance;
- AI Transport schema/runtime parity;
- AI Transport import-safety;
- CLI help surface.

Changes to IAL Compact or AI Gateway v0.1 therefore re-test this dependent layer.

## Non-goals

v0.1 does not:

- send a packet over a network;
- call OpenAI, ChatGPT, MCP, GitHub or another provider/runtime;
- select a provider;
- create a provider adapter;
- call an actuator;
- request or perform an external effect;
- carry or create an `ActionPermit`;
- establish authority;
- accept responsibility;
- admit execution;
- infer intent;
- refresh a frontier;
- certify truth, causality, legality or liability;
- process real applicant data;
- activate KONTUR;
- merge, release or tag repository state.

## Successor boundary

The next layer may add a concrete provider-neutral delivery adapter only after this local representation is merged and independently re-audited.

A successor must preserve:

```text
Transport Packet
-> Delivery Attempt Candidate
-> provider/runtime boundary
-> observation
```

without collapsing:

```text
Delivery Attempt != Delivery Success
Delivery Success != External Effect
Provider Response != ActionReceipt
Transport Retry != Authority Renewal
```

No successor authority is implied by this v0.1 packet.
