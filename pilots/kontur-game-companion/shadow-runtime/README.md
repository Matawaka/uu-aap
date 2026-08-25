# KONTUR Game Companion — Shadow Runtime / Null Transport Harness v0.1

Status: **synthetic, non-executing, no external transport**.

This layer exercises the computed Game Companion pipeline in a runtime-like loop without connecting it to a user-facing transport. It consumes a `Synthetic Dispatch Decision`, builds the exact payload shape that a later runtime adapter could inspect, and terminates that payload in an in-memory null sink.

## Pipeline

`Session State + PLAYER Event -> Candidate Envelope -> Pre-Text Policy Receipt -> Synthetic Candidate -> Interaction Receipt -> Synthetic Dispatch Decision -> Shadow Runtime Payload -> In-Memory Null Sink`

The final arrow is deliberately **not** a network or delivery action.

## Decisions

For `DISPATCH_ELIGIBLE`, the harness creates a shadow payload and records `NULL_SINK_CAPTURED`. This means only that the exact payload can be assembled and consumed by the local synthetic sink.

For `HOLD`, the harness records `HELD_NO_CAPTURE`. For `DROP`, it records `DROPPED_NO_CAPTURE`. Neither path materializes a shadow payload.

## Boundaries

- `Shadow Execution != External Execution`
- `Would Dispatch != Sent`
- `Null Sink Receipt != Delivery Receipt`
- `Shadow Payload != Transport Invocation`
- `Payload Capture != User Exposure`
- `Runtime Shape != Runtime Connectedness`
- `Dispatch Eligible != Transport Permission`
- `Captured Text != Published Text`
- `Shadow Digest != Authority`
- `Null Sink != External Channel`

A shadow capture fixes all of the following to false:

- `network_request`
- `external_transport_bound`
- `user_visible`
- `user_delivery_enabled`
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

The only sink is `IN_MEMORY_NULL_SINK`. The harness rejects any live runtime flag, external transport binding, user delivery enablement, send permit, network enablement, or non-null sink.

## Payload comparison

For an eligible candidate the shadow payload includes the exact synthetic response text plus the candidate, Interaction Receipt, and Dispatch Decision digests. The validator checks that the text and text digest are byte-for-byte identical to the materialized candidate. This tests the final payload shape without sending it.

The payload is ephemeral test data (`payload_persisted=false`) and creates no durable player profile or cross-game memory.

## Freshness

The Shadow Runtime does not re-authorize stale candidates. It accepts the already validated Dispatch Decision. A later turn, cancellation, supersession, inactive session, or safety hold is handled upstream by the Dispatch Gate and therefore results in no shadow payload.

## Non-effects

This package does not invoke a language model, open a socket, make a network request, call a live KONTUR endpoint, send a response, control a game account, create an ActionPermit, create a successor permit, grant response/send authority, profile the player, optimize engagement/retention, promote the pilot into Stable Core, deploy code, or alter repository permissions.

The harness exists to prove a negative boundary: the pipeline can reach a realistic payload assembly step while external delivery remains impossible in this slice.
