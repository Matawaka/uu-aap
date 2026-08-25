# Network / User Surface Activation Challenge v0.1

Status: `SYNTHETIC_NON_EXECUTING`

This layer follows Runtime / Transport Binding Materialization v0.1. It consumes only a local `SYNTHETIC_BINDING_MATERIALIZED` receipt and asks whether the bounded binding has enough *presented contract references* to proceed to a separate externalization review.

It does **not** enable a network, expose a user surface, invoke transport, create credentials, authorize sending or activate a live runtime.

## Placement

`... -> Bounded Binding Grant -> Local Synthetic Binding Materialization -> Network/User Surface Activation Challenge -> separate externalization review -> no external connection`

## Challenge progression

- `NOT_APPLICABLE`
- `ACTIVATION_NOT_REQUESTED`
- `NETWORK_CONTRACT_REQUIRED`
- `USER_SURFACE_CONTRACT_REQUIRED`
- `ROLLBACK_CONTRACT_REQUIRED`
- `DELIVERY_AUDIT_SINK_REQUIRED`
- `BINDING_FRESHNESS_RECHECK_REQUIRED`
- `READY_FOR_EXTERNALIZATION_REVIEW`

The strongest state means only that four bounded contract/evidence references are present and the current materialized binding plus its grant were rechecked as current.

## Inputs

The request is limited to:

- scope `THIS_MATERIALIZED_BINDING_ONLY`;
- capability `REVIEW_EXTERNAL_DELIVERY_SURFACE_ACTIVATION`;
- network mode `DECLARED_CONTRACT_ONLY`;
- user-surface mode `DECLARED_CONTRACT_ONLY`;
- SHA-256 references for network contract, user-surface contract, rollback contract and delivery-audit sink;
- a fresh current-binding/current-grant recheck.

Raw endpoints, credentials, secrets, send permission, transport invocation, delivery attempts, persistent/cross-session activation, background/proactive messaging, account control, profiling and scope/capability expansion are forbidden inputs.

## Boundaries

- `Materialized Binding != External Connection`
- `Activation Requested != Activation Authorized`
- `Network Contract Present != Network Enabled`
- `User Surface Contract Present != User Exposure`
- `Rollback Contract Present != Safe Activation Proven`
- `Audit Sink Reference != Delivery Receipt`
- `Binding Freshness Rechecked != Future Freshness`
- `Ready for Externalization Review != Externalized`
- `Externalization Review Ready != Send Permit`
- `Local Binding Ref != Endpoint Credential`
- `Contract Reference != Contract Sufficiency`
- `Network/User-Surface Challenge != Transport Invocation`
- `Challenge Digest != Connection`

## Non-effects

Even at `READY_FOR_EXTERNALIZATION_REVIEW` all of the following remain false:

- network/user-surface enablement;
- live runtime/external transport binding;
- send permit/send authority/response authority;
- external effect authorization;
- transport invocation and delivery attempt;
- credentials, secrets and bearer material;
- ActionPermit and successor permit;
- persistence;
- proactive/background messaging, autonomous gameplay, account control and profiling;
- persistent/cross-session/cross-game activation;
- Stable Core promotion.

`runtime_connectedness` remains `LOCAL_SYNTHETIC_BINDING_ONLY_NOT_EXTERNAL`.

## Validation

`validate.py` deterministically reconstructs seven materialized bindings from the synthetic integrated conversation chain, walks every challenge stage, verifies non-materialized predecessors are ineligible, and applies fail-closed mutations against provenance, contract refs, freshness, scope/capability, credentials, network/send effects, forged activation states and connectedness overclaims.
