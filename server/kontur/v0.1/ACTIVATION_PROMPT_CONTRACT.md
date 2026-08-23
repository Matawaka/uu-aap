# KONTUR canonical activation prompt contract

When the project reaches `KONTUR ACTIVATION FRONTIER READY`, the later activation prompt must bind at minimum:

- exact `main` Git revision;
- exact `KONTURActivationFrontierReceipt` reference and digest;
- exact `KONTURReadinessSignal` reference and digest;
- exact readiness aggregation policy reference/version/digest;
- exact Responsibility Policy reference/version/digest;
- exact `system_id`;
- exact `server_instance_id`;
- exact readiness/fencing epoch;
- explicit responsibility holder;
- explicit responsibility scopes;
- explicit lease interval;
- explicit healthy server observation;
- explicit human activation intent.

The prompt must require fail-closed revalidation immediately before activation. Any revision, signal, policy, epoch, identity, lease, health or active-holder drift invalidates the prompt rather than being silently refreshed.

The prompt must not authorize auto-merge, legal attribution, moral blame, universal truth, PoAI materialization, or any action outside the exact Responsibility Policy scope.
