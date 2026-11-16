# Agent interface for Personal Anchor trials v0.1

Tracking #1047. PR #1046 was integrated into main at
`d6981d76671bef191d4a49696472c10fbe40402b`. Engine pins retain the original reviewed
source `0e0f8924c6df4cc9b8b4a0055a1ea3c275ef4a0b`; its tree matches the merged
predecessor. This interface candidate targets main.
The interface provides a JSON CLI and a local MCP stdio server over the same
unchanged offline lifecycle experiment. [Русская версия](README.ru.md).

The reusable [Component Manifest](component-manifest.json) binds actual
implementation commit `ce55816ab7d9be50626af2c75d576d971b6c21e0`. It is additive
engineering metadata; its validation does not run or attest the component.

## Run from a checked-out repository

Requires Node.js 22 or newer. From the repository root:

```bash
cd schemas/ecosystem/uu-society/v0.1/personal_anchor_trials/agent-v0.1
npm ci --ignore-scripts --no-audit --no-fund
node agent-cli.js < examples/describe.request.json
node agent-cli.js < examples/compare.request.json
node agent-cli.js < examples/custom.request.json
node examples/mcp-client.js
```

The CLI accepts exactly one UTF-8 JSON document on stdin, ending at EOF, and
writes exactly one JSON response on stdout. Exit status is 0 for COMPLETED and 2
for ERROR. It does not accept command arguments or forward reference-write flags.
Paths are resolved relative to the package, so caller cwd does not matter.

To connect an MCP host, configure it to launch `node` with the absolute path to
`mcp-server.js`. The host owns the process and connection; this package does not
start an HTTP endpoint or publish a registry entry. The example client discovers
tools, describes the experiment, compares L02 and replays its receipt from a
separate process connection.

## Tools

| Operation | Arguments | Result |
| --- | --- | --- |
| `experiment.describe` | Empty object | Machine manifest, limits, self-contained argument/response schemas, source binding and 16-case catalogue |
| `experiment.run` | `scenario_id` or `scenario`, plus `arm`; optional `hypothesis` | One-arm receipt |
| `experiment.compare` | `scenario_id` or `scenario`; optional `hypothesis` | Two-arm receipt and differences |
| `experiment.replay` | `receipt` | Same-source local reproduction result |

Request example:

```json
{"interface_version":"0.1","operation":"experiment.compare","arguments":{"scenario_id":"L02"}}
```

For a custom case, provide an ASCII id and a bounded event array instead of
`scenario_id`. Allowed events are issue, advance, backlog, revoke, rotate,
change_intent, change_target, source_unavailable and complete. See
`examples/custom.request.json` and `contract.schema.json`.

Both selection modes are mutually exclusive. Unknown fields and caller-supplied
`expected`, code, commands, paths, URLs and authority effects are rejected.
Each call creates new model state. This is a complete event tape interface, not
a persistent session service.

## Result and receipt semantics

`execution_status` reports whether the computation completed, independently of
`response_status` and `contract_status`. COMPLETED may contain a rejected
response or a rejected action contract. The cached arm is a deliberately unsafe
comparison. Matching its reference expectation is not a safe-action verdict.

Reference expectations come only from the pinned repository catalogue. Custom
cases always report `NO_TRUSTED_EXPECTATION`, even if their id equals a reference
id. Caller hypotheses are retained as `UNASSESSED_CALLER_STATEMENT`; prose is not
executed and does not decide reference conformance.

Receipts bind the accepted parsed input, source-file digests and actual outputs.
Replay checks structure and digest, checks the same source binding, recomputes
the observations, comparison and reference disposition, and compares the whole
receipt. Changing an output and recomputing its public hashes still fails replay.
Changing the input and producing a genuinely matching new receipt is a new
experiment, not a forged issuer-authentication event.

Canonicalization is component-local sorted JSON over accepted parsed values;
it does not claim universal canonical JSON or preservation of original JSON
whitespace/number spellings. No receipt is signed. Successful replay establishes
local consistency/reproduction, not issuer identity, independent review,
trusted time, personhood, real authority, causal continuity or deployment safety.
All real end-to-end PCC/biometric statuses remain NOT_EXECUTED.

`engine-pins.json` binds six exact predecessor files. The interface fingerprint
binds executable interface files, schema, machine manifest and lockfile. Loaded
processes reject subsequent source-file drift and require restart. The lockfile
does not itself attest an installed host or arbitrary dependency modifications.

## Validation and limits

```bash
npm test
node ../lifecycle-v0.1/run-lifecycle-trials.js --check-reference
```

18 interface tests cover all reference cases, custom cases, corrected-hash
tampering, source drift, stateless isolation, strict CLI parsing, schema/budget
failures and actual SDK client/server subprocess calls. MCP negotiation is tested
with SDK 2.4.0 in modern 2026-07-28 and legacy 2025-11-25 modes; no other host or
implementation compatibility is claimed by those tests.

Logical requests are limited to 512 KiB, custom scenarios to 64 KiB, receipts to
384 KiB, depth to 32 and nodes to 20,000. Engine limits remain 128 events, 64
retained requests and 256 receipts per arm. JSON responses are capped at 1 MiB;
MCP frame buffering is capped at 1 MiB. Excess capacity is an error, not PASS.

The CLI rejects duplicate decoded keys, invalid UTF-8, non-finite numbers,
negative zero, unsafe integers and unpaired surrogates. MCP framing/parsing is
owned by the locked SDK; the core validates decoded arguments. SDK schema errors
may be returned as MCP tool errors before the JSON core runs; valid calls and
core errors otherwise use the same structured envelope.

Tool annotations are descriptive hints. Actual scope is enforced by fixed
operations, closed schemas, data-only events and a computation-only engine. No
arbitrary shell, file loading, network destination, reference rewrite, real
biometric data collection, live permit consumption or actuator is exposed.

Official transport/schema references:
[MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools),
[SDK stdio factory](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio),
[SDK JSON Schema adapter](https://ts.sdk.modelcontextprotocol.io/v2/advanced/schema-libraries).
