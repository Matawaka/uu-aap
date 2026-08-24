# UU-AAP AI Gateway — MCP/equivalent binding and GitHub reference adapter v0.1

This profile binds the provider-neutral AI Gateway v0.1 to tool transports and defines a GitHub reference actuator adapter contract.

It is an **adapter contract**, not an executable actuator and not a new source of authority.

## Position

```text
AI / client
  -> MCP | function-call | JSON-RPC | native-tool | equivalent transport
  -> UU-AAP AI Gateway v0.1
  -> GitHub reference adapter
  -> GitHub actuator API
  -> external observation
  -> GatewayObservationReceipt / Core outcome path
```

The transport and adapter are below the Core decision boundary:

```text
transport != intent
transport != authority
adapter availability != permission
gateway admissibility != ActionPermit creation
adapter invocation != performed action
GitHub observation != causality
```

## Transport neutrality

The gateway contract remains provider-neutral. v0.1 normatively supports a small binding vocabulary:

- `mcp`
- `function_call`
- `json_rpc`
- `native_tool`
- `other`

No transport may define or enlarge authority. A model/runtime may discover or invoke a tool, but tool discoverability is not action authorization.

## GitHub reference surface

The initial reference mapping covers:

- `read_state`
- `create_pr`
- `merge_pr`
- `observe_state`

This PR does not implement those calls. It specifies the envelope that a later executable adapter must satisfy.

## Consequential invocation gate

For `merge_pr`, an invocation is valid only when all of the following are already bound:

1. a matching GatewayRequest;
2. a matching `admissible` GatewayDecisionReceipt;
3. a matching Core `ActionPermit`;
4. explicit action approval when the action requires approval;
5. exact repository;
6. exact PR number;
7. exact expected PR head SHA;
8. exact expected base SHA;
9. explicitly allowed merge method;
10. non-overlapping expected effects and explicit non-effects.

Formally:

```text
tool invocation
  != gateway decision
  != ActionPermit
  != approval

valid merge invocation
  = matching gateway decision
  + matching Core ActionPermit
  + matching action approval
  + exact GitHub target
  + fresh expected frontier
```

## Stale-state rule

A GitHub adapter MUST fail closed when the observed PR head or base frontier no longer matches the values approved and permitted.

```text
expected head SHA mismatch -> do not invoke
expected base SHA mismatch -> do not invoke
repository mismatch -> do not invoke
PR mismatch -> do not invoke
operation mismatch -> do not invoke
```

Translation or transport rebinding MUST NOT refresh stale evidence.

## Scope preservation

The adapter MUST NOT:

- switch repositories;
- switch PR numbers;
- switch from read/create-PR to merge;
- widen an authority scope;
- choose a merge method that was not explicitly bound;
- add extra externally consequential effects;
- infer approval from protocol-mode consent;
- create a Core `ActionPermit`;
- claim that the contract itself performed an action.

## Observation boundary

A `GitHubActuatorObservation` records what an external GitHub source reports after an invocation.

```text
adapter invocation != performed action
external observation != Core ActionReceipt
observed repository transition != causal proof
```

A performed observation requires an external evidence reference. Subsequent Core processing remains responsible for producing the applicable ActionReceipt / OutcomeReceipt / SuccessorStateReceipt.

## Non-effects

This profile does not create intent, authority, responsibility, coordination, ActionPermit, action, truth, causality or liability.

It does not modify frozen `protocols/core/v0.1`, Stack Evolution v0.1, Non-Induced Intent v0.1, or AI Gateway v0.1 semantics.

## Conformance

`validate-adapter.js` checks the positive fixture and fail-closed vectors including:

1. non-admissible gateway decision;
2. missing Core ActionPermit;
3. missing explicit action approval;
4. gateway frontier mismatch;
5. repository broadening;
6. operation substitution;
7. PR substitution;
8. stale PR head;
9. stale base SHA;
10. unauthorized merge method;
11. effect/non-effect overlap;
12. adapter-created authority;
13. adapter-created ActionPermit;
14. transport-defined authority;
15. observation without external evidence;
16. observation target mismatch;
17. observation claiming gateway/contract execution;
18. observation upgraded to causality;
19. protocol-mode consent used as action approval.

## Relationship to #307

This is the second implementation slice of the AI Gateway / Agent-Callable Protocol.

After this profile is accepted, remaining work includes:

- an executable but safely bounded GitHub adapter/reference harness;
- a concrete MCP/equivalent server/client example;
- allowed / denied / approval-required agent scenarios;
- paired evals comparing direct actuator access with gateway-mediated access.

Those later steps MUST consume this contract rather than bypass it.
