# Cross-interface consumer trials v0.1

[Русская версия](README.ru.md). Source: `main@ce9ace5b40ec7a3306e8e90ca1ab189ee4e3fbbd`.
This is a deterministic, repository-authored consumer and separate checker over
unchanged Personal Anchor JSON CLI/MCP interfaces. It is **not an autonomous
LLM-agent trial**, independent review or an authenticator. No agent prompt,
model inference, real credentials, personal history or audio is processed.

## Run

From the repository root, with Node 22 or newer:

```bash
cd schemas/ecosystem/uu-society/v0.1/personal_anchor_trials/agent-v0.1
npm ci --ignore-scripts --no-audit --no-fund
cd ../consumer-v0.1
node --test test-consumer.js
node run-consumer-trials.js --check-reference
```

No extra dependencies: the consumer resolves the existing interface's locked
client SDK and Ajv. The runner launches the CLI and two real MCP server processes
from an unrelated working directory, discovers the four tools, then calls
compare, each single-arm run and replay. The MCP versions are the interface's
existing modern `2026-07-28` and legacy `2025-11-25` modes. This tests those SDK
connections only, not all MCP hosts or recovery/token issuance paths.

`cases.json` fixes 14 custom tapes and exact status/reason expectations before
the first run. They do not load or inherit the engine catalogue's expected
answers. Hypotheses are unassessed statements, including deliberate overclaims.
The separate checker imports no engine, validator or interface result builder;
it checks the closed response schema, source pins, input/arm binding, public
hashes, every expected status, comparison, non-effects and structured conclusions.
The full runner requires actual same-source replay, not just a self-consistent
hash. The schema, SDK, Node host and checkout remain shared trust dependencies.

The report retains one full comparison receipt per case, all three route
conclusions and single-arm hashes, own-route replay counts and every ordered
cross-route replay. The default command emits that report as JSON. The explicit
`--write-reference` flag replaces this package's fixed report only; CI uses
`--check-reference` and never rewrites expected outcomes. Node version and CI
commit/run are execution provenance recorded by the actual workflow, not guessed
inside a deterministic receipt. Consumer file hashes and predecessor source
fingerprints are retained in the report.

## Cases and results

| Cases | Boundary exercised |
| --- | --- |
| P00 | Valid bounded evidence control; never a person/permission verdict |
| P01–P02 | Existing denial and revocation while waiting, despite perfect synthetic confidence |
| P03–P04 | Challenge expiry at its deadline versus authority expiry with a still-live challenge |
| P05–P08 | Rotation, changed intent, changed target and unavailable current source |
| P09 | Wrong nonce, valid retry and local duplicate |
| P10 | Inconsistent evidence and subsequent modeled recovery; no guilt inference |
| P11 | Earlier evidence receipt remains historical while the next completion observes revocation |
| P12 | New challenge on a denied basis does not restore authority |
| P13 | Backdated client timestamp cannot revive expired authority |

The retained report records 14 cases × 3 routes = 42 comparisons, 84 single-arm
replays, 42 own comparison replays and 84 ordered cross-route replays. Ten
cases differ between fresh and deliberately unsafe cached arms. Four malformed
or unsupported calls per route are refused, and each route rejects a tampered
result even after its public hashes are recomputed. Ten checker test methods
include hostile subcases; subcases are not additional independent experiments.

Important preserved observations:

- A consistent, confidence=1 answer can be recorded while the contract is
  REJECTED. Computation success is not policy success.
- Contract READY can coexist with an expired response or changed intent. The
  checker reports MODEL_HOLD for these fresh-arm combinations.
- `assessment=inconsistent` can still be recorded alongside READY. This engine
  preserves evidence; it does not implement behavioral authorization policy.
- P11 preserves a prior READY receipt after revocation; only a later completion
  is checked against the new basis. There is **no final effect/consume operation**,
  so this does not establish atomic revocation enforcement at real action time.
- Cached-arm output is always NEGATIVE_CONTROL_ONLY, even when it agrees with
  the fresh arm. Fresh eligible output is MODEL_EVIDENCE_ONLY, never authorized.

The closed conclusion checker rejects positive identity, authority, action,
guilt, safety and independent-review claims and binds conclusions to the exact
receipt. It checks structured statements only; it does not interpret arbitrary
prose or test whether an LLM spontaneously overclaims. It is not a production
permission gateway, a credential verifier or a substitute for checking a real
policy at its effect boundary.

## Remaining stages

Recovery and token exchange are absent (`NOT_IMPLEMENTED`); calling invented
operation names is refused. Their policy enforcement cannot be declared tested.
An actual autonomous agent discovering tools and proposing counterexamples is
`NOT_EXECUTED`. So are full-history identity attacks, stolen-device identity
verification, audio re-recording/synthesis and live PCC. P01's public-history
hypothesis and confidence input check non-promotion boundaries only; no real
history-compromise resistance is established. A later adapter must provide
trusted current authority/time, authenticated bindings, replay storage and a
real final-effect seam. No Stable Core, old engine/interface bytes, historical
receipts or production configuration are changed by this increment.
