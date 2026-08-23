# KONTUR canonical activation prompt contract

When the project reaches `KONTUR ACTIVATION FRONTIER READY`, the activation prompt must bind at minimum:

- exact canonical `main` Git revision;
- exact `KONTURActivationFrontierReceipt` reference and RFC8785-JCS/SHA-256 digest;
- exact `KONTURReadinessSignal` reference and digest;
- exact readiness aggregation policy reference/version/digest;
- exact Responsibility Policy reference/version/digest;
- exact `KONTURActivationPolicy` reference/version/digest;
- exact `system_id`;
- exact `server_instance_id`;
- exact readiness/fencing epoch;
- explicit responsibility holder;
- explicit responsibility scopes;
- explicit lease interval;
- exact healthy server observation reference/digest;
- explicit human activation intent and unique intent nonce.

The prompt must first construct a typed `KONTURActivationIntent v0.1` from those exact values.

Immediately before any eventual kernel execution it must produce a fresh `KONTURActivationPreflightReceipt v0.1` under the exact activation policy. The preflight must revalidate revision, frontier, signal, policies, identity, epoch, holder, scopes, lease, health and absence of a parallel active holder/current responsibility state.

A positive preflight may establish only:

`human_execute_step_may_proceed = true`

It is not activation and must retain:

- `kernel_activated = false`
- `responsibility_state_created = false`
- `responsibility_accepted = false`
- `execution_authority_granted = false`

The preflight evaluator must not import or call the Responsibility Kernel.

Any revision, signal, policy, epoch, identity, holder, scope, lease, health or active-holder drift invalidates the prompt rather than being silently refreshed. A stale or invalid prompt requires a successor frontier/intent as appropriate.

Only after a successful fresh preflight may a **separate explicit human execution step** be presented. The prompt must not fuse preflight and activation into one automatic operation.

The prompt must not authorize auto-merge, legal attribution, moral blame, universal truth, PoAI materialization, or any action outside the exact Responsibility Policy scope.
