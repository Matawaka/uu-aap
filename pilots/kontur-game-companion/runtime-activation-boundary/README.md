# KONTUR Game Companion — Runtime Activation Boundary v0.1

Status: **synthetic / non-executing / no live transport**

This layer sits after the merged Shadow Runtime / Null Transport Harness and answers a narrower question than dispatch:

> what can be proven about readiness to consider a future live runtime without converting shadow evidence into runtime authority?

It is an **activation-readiness assessment**, not an activation mechanism.

## Placement

`... → Interaction Receipt → Synthetic Dispatch Decision → Shadow Runtime / Null Sink → Activation Readiness Assessment`

The assessment consumes a valid shadow result. It does not consume or create a live transport handle.

## Assessment states

- `SHADOW_ONLY_CONFIRMED` — the null-sink path is valid and no live-precondition evidence has been supplied.
- `PRECONDITIONS_REVIEW` — one or more synthetic readiness proofs are present, but the technical bundle is incomplete.
- `EXTERNAL_AUTHORIZATION_REQUIRED` — all technical proof flags are present, but externalization authority is still absent and must remain absent inside this layer.
- `NOT_APPLICABLE` — upstream shadow execution did not produce a capturable eligible payload.

There is deliberately no `LIVE_READY`, `ACTIVATED`, or equivalent state.

## Technical proof flags

The assessment may record synthetic evidence for:

- transport-contract verification;
- user-surface contract verification;
- rollback-path verification;
- live-policy parity verification;
- audit/delivery-receipt sink contract verification.

These are **proof flags only**. They do not bind a transport, enable a surface, create a delivery receipt, or authorize an external effect.

## Authority boundary

`externalization_authority_present` is required to remain `false` in this v0.1 layer. Any attempt to set it true is rejected fail-closed.

If every technical proof flag is true, the strongest possible result is:

`EXTERNAL_AUTHORIZATION_REQUIRED`

not activation.

## Core invariants

- `Shadow Readiness != Live Readiness`
- `Technical Readiness != Externalization Authority`
- `Externalization Authority != Send Permit`
- `Activation Assessment != Activation`
- `Null Sink Parity != Transport Parity`
- `Transport Contract != Bound Transport`
- `User Surface Contract != User Exposure`
- `Rollback Plan != Safe Activation`
- `Audit Sink Contract != Delivery Receipt`
- `Readiness Digest != Authority`
- `External Authorization Required != Authorization Granted`
- `Live Preconditions Complete != Live Runtime Enabled`

## Non-effects

Every assessment fixes the following to false:

- `live_runtime_enabled`
- `live_runtime_bound`
- `external_transport_bound`
- `user_surface_enabled`
- `network_enabled`
- `send_permit`
- `send_authority`
- `response_authority_created`
- `external_effect_authorized`
- `delivery_attempted`
- `transport_invoked`
- `delivery_receipt_created`
- `action_permit_created`
- `successor_permit_created`
- `payload_persisted`
- `stable_core_promotion`

The layer is evidence-only and remains outside Stable Core.

## Purpose

This boundary prevents a future implementation from treating successful shadow execution as an implicit license to connect transport. Any later live adapter must cross a separate, explicit authority boundary with fresh evidence and a separately specified Action/Externalization gate.
