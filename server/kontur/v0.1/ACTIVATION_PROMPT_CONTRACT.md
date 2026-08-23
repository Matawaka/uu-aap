# KONTUR canonical activation prompt contract

When the project reaches `KONTUR ACTIVATION FRONTIER READY`, the activation prompt must bind at minimum:

- exact canonical `main` Git revision;
- exact `KONTURActivationFrontierReceipt` reference and RFC8785-JCS/SHA-256 digest;
- exact `KONTURReadinessSignal` reference and digest;
- exact readiness aggregation policy reference/version/digest;
- exact Responsibility Policy reference/version/digest;
- exact `KONTURActivationPolicy` reference/version/digest;
- exact `KONTURActivationExecutionPolicy` reference/version/digest;
- exact Durable Responsibility Ledger Policy reference/version/digest;
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

That separate human step must create a typed `KONTURActivationExecuteCommand v0.1` with:

- exact current Git revision;
- exact activation-intent binding;
- exact fresh-preflight binding;
- exact Activation Execution Policy binding;
- exact holder/scopes/fencing epoch/lease;
- a new one-shot execute nonce distinct from the earlier activation-intent nonce;
- a short validity interval defined by the execution policy;
- explicit final human execute declaration.

The final execute command is still not activation. It must keep `kernel_activated=false` and `local_kontur_activation_completed=false`.

Only the `KONTUR Activation Executor` may consume that command. It must:

1. revalidate the command and predecessor frontier;
2. require a fresh preflight, readiness, health and lease;
3. recover the Durable Responsibility Ledger and require empty genesis state;
4. call the Responsibility Kernel `activate` transition exactly once;
5. atomically commit the resulting genesis state into the Durable Responsibility Ledger;
6. recover the authoritative ledger head from disk;
7. require exact active state/holder/scope/epoch equality;
8. only then emit `KONTURActivationExecutionReceipt`.

A Kernel return alone is insufficient. A durable commit without successful recovery verification is also insufficient for a positive execution receipt.

If a durable genesis entry already exists after an ambiguous failure, the prompt/executor must not retry genesis activation. Recovery of the existing ledger state is required instead.

For test-only execution, `live_kontur_activated` must remain false. A future live execution receipt may set it true only after the exact durable commit + recovery sequence succeeds under the canonical bound frontier.

The prompt must not authorize auto-merge, automatic retry, auto-activation, legal attribution, moral blame, universal truth, distributed consensus, PoAI materialization, or any action outside the exact Responsibility Policy scope.
