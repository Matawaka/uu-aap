# KONTUR Game Companion — Runtime / Transport Binding Challenge v0.1

Status: **synthetic, non-executing**.

This layer sits after the Separate Authority Grant Boundary. It answers only one question: whether an active bounded externalization grant has enough *referenced binding material* to be presented for a separate runtime/transport binding review.

It does not create a runtime binding, transport binding, network connection, endpoint credential, send permit, delivery attempt, or live KONTUR activation.

## Placement

`... → Authority Review Receipt → Bounded Authority Grant → Runtime / Transport Binding Challenge → separate binding review/receipt still required → no send`

## Preconditions

Only `BOUNDED_GRANT_ISSUED` is bindable. `GRANT_NOT_ISSUED`, `GRANT_REVOKED`, `GRANT_EXPIRED`, and `NOT_APPLICABLE` cannot start a binding request.

A binding request is restricted to the exact granted scope and capability and may reference only:

- a synthetic runtime descriptor;
- a synthetic one-way response transport descriptor;
- a synthetic endpoint descriptor;
- runtime and transport attestation references;
- explicit scope/capability match assertions;
- a fresh grant lifecycle check confirming the grant is neither revoked nor expired.

Raw endpoint locators, credentials, secrets, network enablement, user-surface enablement, send permission, background/proactive messaging, cross-session binding, persistent binding, and scope/capability expansion are forbidden.

## Challenge states

- `NOT_APPLICABLE`
- `BINDING_NOT_REQUESTED`
- `RUNTIME_DESCRIPTOR_REQUIRED`
- `TRANSPORT_DESCRIPTOR_REQUIRED`
- `ENDPOINT_DESCRIPTOR_REQUIRED`
- `RUNTIME_ATTESTATION_REQUIRED`
- `TRANSPORT_ATTESTATION_REQUIRED`
- `SCOPE_MATCH_REVIEW_REQUIRED`
- `CAPABILITY_MATCH_REVIEW_REQUIRED`
- `LIFECYCLE_CHECK_REQUIRED`
- `READY_FOR_BINDING_REVIEW`

The strongest state is deliberately **not** `BOUND`, `CONNECTED`, `LIVE_READY`, or `SEND_ALLOWED`.

## Core boundaries

- `Active Grant != Runtime Bound`
- `Active Grant != Transport Bound`
- `Binding Requested != Binding Authorized`
- `Descriptor Present != Descriptor Sufficient`
- `Endpoint Descriptor != Endpoint Validation`
- `Endpoint Descriptor != Credential`
- `Attestation Present != Attestation Sufficient`
- `Runtime Attestation != Runtime Identity Proven`
- `Transport Attestation != Transport Identity Proven`
- `Scope Match Asserted != Scope Binding Validated`
- `Capability Match Asserted != Capability Binding Validated`
- `Ready for Binding Review != Bound`
- `Binding Review Ready != Send Permit`
- `Binding Review != Network Enablement`
- `Grant Scope != Arbitrary Endpoint Scope`
- `Revoked Grant != Bindable Authority`
- `Expired Grant != Bindable Authority`
- `Binding Digest != Connection`

## Non-effects

The challenge must keep all of the following false:

- binding authorization;
- runtime/transport binding creation;
- live runtime enablement;
- external transport binding;
- network and user-surface enablement;
- send permit / send authority;
- response authority creation;
- external effects and delivery attempts;
- transport invocation and delivery receipts;
- ActionPermit / successor permit;
- payload persistence;
- credential or secret material creation;
- proactive/background messaging;
- autonomous gameplay/account control;
- profiling/cross-game scope;
- persistent binding;
- Stable Core promotion.

The runtime remains `AUTHORITY_PLANE_ONLY_NOT_BOUND`.
