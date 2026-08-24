# UU-AAP AI Gateway / Agent-Callable Protocol v0.1

**Status:** experimental integration profile  
**Issue:** #307  
**Stable Core:** `protocols/core/v0.1`  
**Current predecessor frontier:** `b294fa12ef1b95287fb8ae721f6290e9b5544aa5`

## Purpose

Expose the stable UU-AAP stack to agents through a small provider-neutral interface without turning the gateway into a new authority source or actuator.

The initial surface is:

```text
inspect -> qualify -> authorize -> observe
```

These are gateway operations, not replacements for Core primitives.

```text
gateway assessment != Core receipt
gateway authorize != ActionPermit creation
gateway observe != action performance
protocol-mode consent != blanket future consent
```

## Anti-overhead rule

Harmless reasoning and read-only inspection may use the lightweight path. An externally consequential action must cross the accountable action boundary.

```text
internal reasoning / read-only inspection -> lightweight
external effect -> exact frontier + Core receipts + Action Gate evidence
```

## Agent-discoverable capability

`capability-manifest.schema.json` defines a provider-neutral capability descriptor suitable for MCP or equivalent tool registries. It advertises the four operations and effect classes, but grants no authority merely by being discoverable.

## Gateway request

`GatewayRequest` binds:

- operation: `inspect`, `qualify`, `authorize`, or `observe`;
- request id, subject and exact frontier;
- action metadata;
- requested effects and explicit non-effects;
- Core receipt references when applicable;
- intent-evidence references as evidence only;
- approval reference when required.

Required action metadata:

- `read_only`;
- `external_effect`;
- `reversible`;
- `requires_approval`;
- `authority_scope`;
- `expected_effects`;
- `explicit_non_effects`.

Expected effects and explicit non-effects MUST NOT overlap.

## Core boundary

For an `authorize` request involving an external effect, the gateway MUST require exact-frontier references to:

- `StateReceipt`;
- `IntentReceipt`;
- `AuthorityReceipt` or `ResponsibilityReceipt`;
- `CoordinationReceipt`;
- `ActionPermit`.

An `IntentEvidenceReceipt` may be referenced separately but MUST NOT substitute for `IntentReceipt`.

If `requires_approval = true`, an approval reference is also required.

The gateway may report that an action is admissible because the required Core evidence already exists. It does not create the admissibility itself.

## Gateway decision receipt

`GatewayDecisionReceipt` records the gateway assessment:

- `inspected`;
- `qualified`;
- `admissible`;
- `denied`;
- `approval_required`.

An `admissible` external-effect decision is valid only when a matching `ActionPermit` is already referenced on the exact frontier.

Mandatory non-effects keep false:

- `intent_created`;
- `intent_inferred`;
- `authority_created`;
- `authority_expanded`;
- `responsibility_accepted`;
- `coordination_completed`;
- `action_permit_created`;
- `action_performed_by_gateway`;
- `frontier_refreshed`;
- `truth_certified`;
- `causality_proven`;
- `liability_established`;
- `universal_canonicality_established`.

## Observe operation

`GatewayObservationReceipt` binds post-actuator evidence. It may record that an external effect was observed, but MUST distinguish:

```text
effect observed != effect performed by gateway
actuator observation != Core ActionReceipt
observed outcome != causality
```

For a performed external effect it must reference actuator evidence plus a Core `ActionReceipt`. `OutcomeReceipt` and `SuccessorStateReceipt` references may be included when available.

The frontier roles are deliberately asymmetric and MUST remain explicit:

- `predecessor_frontier` is the exact frontier on which the request, ActionPermit and Core `ActionReceipt` are bound;
- `observed_frontier` is the post-actuator frontier used by actuator evidence, `OutcomeReceipt` and `SuccessorStateReceipt`;
- a Core `ActionReceipt` MUST NOT be relabelled onto the successor frontier merely because the effect was later observed there.

```text
ActionReceipt frontier = predecessor frontier
OutcomeReceipt frontier = observed successor frontier
SuccessorStateReceipt frontier = observed successor frontier
```

This preserves the Core invariant that action execution remains linked to the permit that authorized it while outcome and successor-state evidence describe what was observed after execution.

## Consent and approval

Consent to use the gateway or protocol mode does not grant blanket action authority.

```text
protocol-mode consent != action approval
action approval != authority expansion
approval for one action != approval for successor actions
```

Approval references are action-scoped and frontier-bound.

## Provider neutrality

The profile does not require OpenAI, ChatGPT, MCP, GitHub, KONTUR, or another vendor/runtime. Those systems may expose or consume the profile through adapters.

## v0.1 non-goals

This contract-only increment does not:

- call an actuator;
- merge, publish, delete, or mutate external state;
- create a GitHub adapter;
- create an MCP server;
- grant authority;
- accept responsibility;
- create intent or an ActionPermit;
- certify truth, causality, legality, or liability.

Reference actuator adapters and paired agent evals remain later deliverables under #307.

## Conformance

`validate-gateway.js` rejects at least:

1. external-effect authorize without `ActionPermit`;
2. external-effect authorize without Core `IntentReceipt`;
3. `IntentEvidenceReceipt` substituted for Core `IntentReceipt`;
4. approval-required action without approval reference;
5. stale/mismatched Core receipt frontier;
6. overlapping expected effects / explicit non-effects;
7. read-only action falsely marked external effect;
8. gateway decision creating authority;
9. gateway decision creating `ActionPermit`;
10. admissible decision without matching request permit;
11. observe-performed external effect without actuator evidence;
12. observe-performed external effect without Core `ActionReceipt`;
13. Core `ActionReceipt` relabelled onto the successor frontier;
14. actuator evidence relabelled onto the predecessor frontier;
15. observation claiming gateway performed the action;
16. observation upgrading outcome to causality;
17. protocol-mode consent treated as blanket action approval;
18. unknown provider-specific mandatory dependency.

The dedicated workflow re-runs Core, extension composition, stack evolution, Non-Induced Intent and AI Gateway validators.
