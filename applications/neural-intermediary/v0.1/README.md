# Neural Service Intermediary v0.1

Experimental application profile above UU-AAP; executable offline concept.
Base: `Matawaka/uu-aap@260e325619ffd2eed12c43f982c369e6468d5f07`.

This prototype separates corporate information flows, bounds incoming pressure,
compares typed observations under an explicitly declared correlation model, and
prepares scoped summaries for human review. It makes no provider calls.

## Run

From repository root, Python 3.12+ and Node 22+:

```sh
python -I -B applications/neural-intermediary/v0.1/cli.py demo
python -I -B applications/neural-intermediary/v0.1/cli.py demo --format html > /tmp/intermediary-demo.html
python -I -B applications/neural-intermediary/v0.1/test_core.py
python -I -B applications/neural-intermediary/v0.1/test_bundle.py
python -I -B applications/neural-intermediary/v0.1/test_cli.py
python -I -B applications/neural-intermediary/v0.1/test_mutations.py
python -I -B applications/neural-intermediary/v0.1/test_workshop.py
node applications/neural-intermediary/v0.1/test_projection.js
node protocols/integration/rerc/v0.1/test-rerc.js
```

No dependency installation is needed. HTML has no scripts, external resources,
evidence-controlled links or untrusted source notes.

For explicit local files:

```sh
python -I -B applications/neural-intermediary/v0.1/cli.py evaluate policy.json observations.json
python -I -B applications/neural-intermediary/v0.1/cli.py pack policy.json observations.json evidence-NEW.zip
python -I -B applications/neural-intermediary/v0.1/cli.py replay evidence-NEW.zip --policy-sha256 <SHA256-of-original-policy-bytes> --bundle-sha256 <separately-retained-ZIP-SHA256>
```

`example.policy.json`, `example.observations.json` and `fixtures.base()` supply synthetic inputs. Pack uses exclusive output
creation; replay never extracts archive members. The caller must supply a policy
pin separately. A digest establishes integrity relative to selected bytes, not
source authentication. CLI exit 0 means the operation completed; inspect the
decision field for DISPUTED, INSUFFICIENT_EVIDENCE or PRESSURE_LIMITED.

## Architecture and implemented behavior

- `core.py`: strict bounded input contract, flow scope checks, egress candidate,
  correlation components, freshness, disagreement, pressure, selected-summary join.
- `check.py`: separate graph-traversal implementation of finite report invariants;
  imports neither producer nor its decision logic.
- `bundle.py`: deterministic data-only archive, original input byte preservation,
  explicit policy pin, fresh reassessment and separate checker on replay.
- `projection.js`: directly imports accepted RERC v0.1 unchanged. Duplicate
  same-sensor/value relation edges may leave the operational graph; original nodes,
  source payload references, suppressed edges and reconstruction remain available.
- `isolation.py`: a fixed Linux/bubblewrap synthetic probe. Tests a host-positive
  loopback endpoint, a different network namespace, a read-only mount, stripped
  synthetic environment secret and unchanged parent canary. No arbitrary launcher.
- `fixtures.py`, `test_*.py`, `test_projection.js`: positive and hostile synthetic
  controls including rehashed report lies, echo sources and forbidden cross-flow joins.

The RERC adapter consumes normalized, policy-validated data. It does not replace
the Python admission boundary or classify the truth of free text. `projection.js`
is an internal representation tool; its restore result is not a business verdict.

## Decision semantics

`CORROBORATED_UNDER_DECLARED_MODEL` requires one fresh non-unknown value, complete
selected sensor coverage, no unknown independence labels, no pressure violation,
and at least the policy quorum of distinct correlation components.

Sensors sharing provider, operator, model family OR source root are connected;
transitive connections across the complete configured inventory also count.
Metadata is supplied by the caller-controlled policy, never by a sensor response.
It remains declared, not authenticated. Undisclosed common upstream sources can
still produce false agreement. More model calls do not by themselves add evidence.

Any fresh contrary value yields DISPUTED even from one source and even after an
overloaded stream. Repetition cannot raise quorum. Missing/future/stale/unknown
observations cannot silently produce a complete result. A batch above the total
budget is refused in full rather than truncating a potentially contrary suffix.
This conservative rule can reduce availability; optional-sensor policies are future
work requiring separate explicit semantics.

`join_reports` needs an explicit same-tenant purpose and a fixed inventory of
report hashes selected by the caller after verification. It joins only status/value
summaries, not raw compartments. READY_FOR_HUMAN_REVIEW never authorizes a purchase,
message, disclosure or model call. Report pins are caller trust inputs, not digital
signatures or authentication.

## Isolation observation

```sh
python -I -B applications/neural-intermediary/v0.1/isolation.py
```

Exit 2 / UNAVAILABLE is a valid non-passing capability observation. No fallback to
an unrestricted child is allowed. Local managed-environment observation on
2026-10-03: `UNAVAILABLE / HOST_PREFLIGHT_DENIED`; the host denied creation of the
positive-control socket. OS isolation was therefore **not qualified here**.

Even PROBE_PASS_BOUNDED only covers the fixed probe. The profile has CPU/address
space/file-size limits but is not a general native-code executor with qualified
process-tree containment, GPU limits, hostile-kernel defense or provider access.

## Trust and production gaps

This is a stateless offline reference. It does not authenticate tenant identity,
sensor identity, policy ownership, source lineage or recorder origin. It does not
implement TLS, tenant-key encryption, persistent queues, distributed quotas,
revocation, identity/SSO, live providers, secret storage, model training or a
production sandbox. Scope tags prevent accidental mixing inside this API; they
are not an access-control system against an attacker who controls all inputs.

Free text is retained as opaque evidence and not interpreted or executed. The
prompt-injection scenario demonstrates this non-interpreting boundary only, not
resistance of an actual LLM to injected instructions.

Finite checker diversity and authored report mutations are not independent human
review, universal verifier correctness or certification. Original evidence may
contain private material; the archive belongs in its authorized tenant environment.

No Core/SPEC change, D/T/V/R upgrade, UU VERIFIED mark, release, live adapter,
HA-1 acceptance, HA-2 completion, Workbench activation or provider authority follows.

Full Russian concept and business model:
[`docs/architecture/NEURAL-INTERMEDIARY-2026-10.ru.md`](../../../docs/architecture/NEURAL-INTERMEDIARY-2026-10.ru.md).

## Small custom fabrication workshop pilot

The selected pilot is a small workshop producing custom composite constructions
for building and advertising, with a milling machine, welding equipment, two or
three employees, and one person coordinating most business processes.

`workshop.py` adds an offline order-review profile: unresolved customer requirements,
conflicting drawing revisions, incomplete internal costs, client-question drafts
and a separate workshop handoff. It does not infer engineering suitability,
machine capacity, dates, taxes or a sales price. Model agreement cannot confirm
a customer requirement. Caller-declared confirmation is not authenticated approval.

```sh
python -I -B applications/neural-intermediary/v0.1/cli.py workshop applications/neural-intermediary/v0.1/workshop-example.json --audience owner --format html > /tmp/workshop-owner.html
python -I -B applications/neural-intermediary/v0.1/cli.py workshop applications/neural-intermediary/v0.1/workshop-example.json --audience client
python -I -B applications/neural-intermediary/v0.1/cli.py workshop applications/neural-intermediary/v0.1/workshop-example.json --audience workshop
```

Use `workshop-intake.json` as a blank local form. Keep real orders outside the
public repository. `workshop-example.json` contains invented dimensions, dates
and prices only. Amounts are integer hundredths of explicitly selected
RUB/USD/EUR/KZT; no company currency or tax treatment is inferred. Missing costs
are not zero and estimates are not a complete confirmed total. Technical text
still needs a human disclosure review before handoff. Source references are local
aliases, not verified evidence retrieval; this case format is not a `bundle.pack`
input. Changing a drawing requires a new case revision and manual revalidation.

Pilot procedure, flow boundaries, business metrics and open questions:
[`WORKSHOP-PILOT-2026-10.ru.md`](../../../docs/architecture/WORKSHOP-PILOT-2026-10.ru.md).
