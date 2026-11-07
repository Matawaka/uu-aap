# Matawaka Harness Assurance — design v0.1

**Status:** DESIGN_DRAFT_READY_FOR_REVIEW; non-normative tooling/integration design.  
**Tracking:** #1012. **Source frontier:** `260e325619ffd2eed12c43f982c369e6468d5f07`.  
**Operational implementation:** NOT_IMPLEMENTED. **Target/control probes:** NOT_EXECUTED.

This records the user-selected conclusions from the supplied harness documents and channel excerpt and continues the design with a finite first consumer. It is not another Stable Core primitive, trust root, permit issuer, autonomous executor or general orchestration framework.

Read with [design-contract.json](design-contract.json), [probe-matrix.json](probe-matrix.json), [sources.json](sources.json), and the [scoped roadmap](../../../roadmaps/HARNESS-ASSURANCE-2026-09-26.md).

## 1. Source status and decision register

S1–S5 and R1–R4 are identified in sources.json. S1–S4 are user-supplied documents; S5 is a user-supplied channel excerpt without individual post identifiers. Their reported tests, review counts, cost savings and quality comparisons were not independently reproduced. This package republishes no raw third-party documents, transcripts, credentials or private product data. Document byte hashes identify the supplied editions; they do not authenticate authorship or verify the described implementation.

| ID | Source observation | Selected design disposition |
| --- | --- | --- |
| D01 | S1/S2: rules have carriers and observable failure | ADOPT WITH ADAPTATION: attach invariant/control relationships to existing Component Manifest identities; do not create another general component registry. |
| D02 | S1/S2: heartbeats, self-tests and known bad cases | ADOPT WITH ADAPTATION: separate liveness, actual invocation and bounded mutation sensitivity. No one field proves all three. |
| D03 | S5: the middle of the pipeline can be skipped | ADOPT: derive obligations from pinned policy and compare expected stages with independently collected observations. |
| D04 | S5: test-file Git order as evidence of TDD | REPLACE AS PROOF: use expected-RED and GREEN execution evidence on bound snapshots. Git order is supplemental history only. |
| D05 | S3: isolated pretask/test/code/review roles and revised contracts | ADOPT WITH ADAPTATION: pin contracts, record disputes, revalidate dependent evidence; context separation is not operator independence. |
| D06 | S1/S2: session rotation and handover | ADOPT WITH ADAPTATION: continuation checks, fencing, preserved stop and unresolved effects; neither comprehension nor renewed authority is inferred. |
| D07 | S2/S5: conditional capabilities, small active memory | ADOPT WITH ADAPTATION: reversible operational projection and coverage of mandatory context; unused protective controls are not automatically removed. |
| D08 | S3: risk tiers and bounded review/token/time budgets | ADOPT WITH ADAPTATION: semantic risk overrides line count; exhaustion means incomplete, not relaxed acceptance. |
| D09 | S1/S2/S5: operational journals and learning from defects | ADOPT: one finding -> proposed detector -> independent review -> scoped qualification -> separately authorized installation. |
| D10 | S1/S2: broad permissions and fail-open guard | REJECT for authority/effect boundaries. Advisory failure may be reported as degraded; it must not authorize an action. |
| D11 | S5: cache share, x2/x3 savings/quality, cheap model matching expensive model | HYPOTHESES ONLY. No quality, cost, novelty or operational-superiority conclusion. |
| D12 | S5: doing everything through a model, copying personality | DO NOT ADOPT as a requirement. Automate reproducible mechanics; retain meaningful human decisions. Personal-context research is separate and private. |
| D13 | R1–R4: reusable substrate and historical limitations already exist | REUSE FIRST. No general identity algorithm, new Core, workflow narrowing or product resumption follows from this design. |

These dispositions are project design choices, not claims that the external author implemented the stronger mechanisms.

## 2. Scope and reuse boundary

The proposed first implementation, HA-1, is a pure offline reducer:

`pinned obligation policy + supplied evidence bundle -> per-requirement assessment + bounded report`

It neither obtains live evidence nor executes the commands described by evidence. It has no shell, network, provider credentials, signing authority or target mutation. HA-2 may later add one separately scoped read-only evidence adapter; this is not silently part of HA-1.

Reuse candidates:

- **Component Manifest (R2):** component identity, dependencies, declared commands, source frontier and effect ceilings. The proposed carrier view adds control-to-invariant/applicability references without replacing component identity.
- **Generated Conformance Runner (R3):** process/output observations. Its existing v0.1 is predecessor-only, requires prior command-set parity and explicitly is not an OS sandbox. Do not broaden its admission or describe its receipts as target qualification.
- **Receipt Runtime and existing identity profiles:** retain producer-specific projection semantics. Selection of a shared function requires the existing differential/substitution process; no universal rehashing of old receipts.
- **CCRP / existing handoff and liveness surfaces:** candidates for typed dependency and continuation mapping, not an assertion that their existing schemas already implement this design. Exact adapter compatibility remains to be demonstrated.
- **RERC (R4):** a precedent for reversible operational reduction and non-suppressible protective relations. This is not evidence that it already implements token memory, semantic sufficiency or a provider cache.

The Observatory is the observer/reducer part of this profile. Only a separately authorized existing authority/effect system can consume its report as one input. `BOUNDED_WORKFLOW_EVIDENCE_SATISFIED` is never an ActionPermit or a release decision.

## 3. Evidence is multidimensional

Retain six dimensions rather than a score or a new linear assurance ladder:

1. **carrier_binding:** what implementation/configuration is meant to hold the rule;
2. **liveness_observation:** what health/challenge observation exists and how fresh it is;
3. **actual_invocation:** what control ran for this exact task, attempt and subject;
4. **mutation_sensitivity:** which named invalid cases this revision rejected, and which benign cases it allowed;
5. **process_coverage:** which predeclared obligations are supported or missing;
6. **outcome_observation:** what was observed after an operation, distinct from request acceptance.

For each dimension retain method, scope, producer attribution, trust assumptions, freshness, reproduction conditions and limitations. Deterministic replay is not a formal proof. Repeated probabilistic NO_FINDINGS is not absence of defects. Two contexts, accounts, models or signatures do not establish independent operators.

An independently authenticated producer may attest that it recorded certain bytes/events. Whether that producer is trusted for execution, ordering or coverage is a separate relying-party policy. A self-declared `producer_ref`, a hash chain or an agent-written JSONL file cannot establish that trust.

## 4. Obligations first, observations second

Before the observed attempt, the selected policy must identify task class, applicable stages, required controls, accepted evidence methods, environment, risk floor, effect ceiling and budgets. HA-1 does not prove the historical creation time of that policy; it verifies supplied bindings under an explicit recorder/trust model.

An evidence dependency **DAG** is used because test and review observations can be parallel. A standard-code example is defined in design-contract.json:

`contract_frozen -> contract_reviewed -> expected_red_observed -> implementation_recorded`

`implementation_recorded -> green_observed + code_reviewed -> evidence_reduced -> ready_for_human_decision`

This is one selected workflow profile, not a universal mandate to perform TDD for every edit. A non-semantic edit can omit inapplicable stages only through explicit pinned-policy applicability evidence. A one-line auth/configuration change cannot become trivial merely because it is small.

Every stage observation must bind the task, attempt, stage, exact subject snapshot, contract, policy, control revision, environment, evidence references, prerequisite references, producer, session epoch and sequence reference. Hash algorithm and identity projection must be explicit. Wall-clock strings alone do not establish causality or trusted time.

The stage graph states dependency requirements; observing a valid graph does not prove physical execution. A trusted recorder/admission mechanism must establish any stronger happens-before claim. Required stages must not be inferred solely from the same log being assessed. A valid suffix can hide omitted activity.

`NOT_OBSERVED` is not `DID_NOT_HAPPEN`. Missing evidence prevents a stronger result, but must not become an invented allegation of non-execution.

## 5. TDD and contract revision

The narrow supported claim is: **the selected test snapshot was observed failing for its predeclared reason against the bound baseline before the bound implementation-stage admission**, under the stated recorder model. It is not proof that nobody had previously written code elsewhere.

Expected-RED evidence requires discovered test identities/counts, intended failing assertion or invariant, observed outcome and diagnostic classification, baseline/tree identity, test snapshot identity, environment and collector binding. Import errors, absent dependencies, a crash, all skipped tests or zero discovered tests cannot substitute for the intended RED.

GREEN must use the same admitted test/contract identity. A test dispute does not let the implementer silently edit tests. A legitimate contract successor preserves the predecessor and reason, obtains the required separate decision, and invalidates affected downstream evidence until it is re-established.

One final task commit or a squash merge is compatible with this design: retain pre-merge snapshots and run evidence independently. Commit chronology is not the primary proof and no timestamp is treated as a trusted clock.

## 6. Assessment semantics

Per-requirement states are SATISFIED, UNSATISFIED, INSUFFICIENT_EVIDENCE and NOT_APPLICABLE. The last requires positive applicability evidence; missing evidence is never N/A.

Reduction is proposed as follows:

- any demonstrated violation of an applicable requirement -> WORKFLOW_REQUIREMENTS_UNSATISFIED;
- otherwise, missing/untrusted/unavailable evidence for any applicable requirement -> INSUFFICIENT_EVIDENCE;
- otherwise -> BOUNDED_WORKFLOW_EVIDENCE_SATISFIED, limited to the supplied policy, evidence, subject and recorder assumptions.

Retain all reasons even when a demonstrated violation dominates the headline result. Reject vacuous empty-obligation success. Distinguish malformed bindings from unresolved evidence. Do not classify infrastructure failure as proof that the target code violates a business invariant.

A plausible critical signal without enough evidence requires bounded triage and remains unresolved; lack of a rule citation alone does not make it safe. A cited style rule alone also does not establish critical severity. Non-critical refinements may be deferred under policy, without erasing the finding.

## 7. Control effectiveness and observation coverage

A carrier map is declarative. A heartbeat is a liveness hint. Per-action invocation evidence is task/subject-bound. A mutation result is valid only when the intended control rejected the intended violation, rather than an unrelated environment failure stopping everything.

Report planned/observed/not-observed invocations; invalid/benign cases and their outcomes; bypasses; fail-open events; escaped findings discovered later; diagnosis uncertainty; and denominators. Zero observed escapes is not a zero escape rate. No claims of complete mediation or universal effectiveness arise from a finite test set.

An independent inventory/checking surface is needed to detect that the watcher itself or a required invocation disappeared. A daily green notification provides one observation, not a self-proving infinite chain of trust. Document where the trusted boundary ends.

Finding prevention is a bounded workflow:

`finding -> causal hypothesis -> detector candidate -> intended mutation + benign control -> review -> separate installation decision -> observed effectiveness`

Use states NONE, PROPOSED, IMPLEMENTED_NOT_QUALIFIED and QUALIFIED_FOR_NAMED_CASES. Missing prevention becomes explicit debt or a reasoned alternative control, not a fabricated claim that every failure class is deterministically preventable.

## 8. Session, context and budget design

A handover should bind current task/attempt/epoch, source and dirty-state snapshots, contract/policy references, established evidence, unresolved claims, stopped/blocked status and next admissible *design/workflow* step. Required information surviving handover is not proof of comprehension.

The successor starts without inherited new permissions. Old writers/results are fenced by an epoch/ownership mechanism in the future executor, not merely a note in the prompt. A human stop remains latched; watchdogs cannot restart it. Unknown external outcomes require reconciliation before any retry. A timeout is not proof that no effect occurred.

Separate stable kernel context from task-conditional modules. A manifest records exact module versions, required/optional status, triggers, dependencies, provenance and retrieval observations. Context delivery is not consideration or understanding. Removal from the active view must not destroy historical evidence or protective requirements. Capability installation changes the executable surface and needs its own admission/review, not just a keyword trigger.

Measure uncached input, cache reads/writes, output, retries, tool/compute cost, wall time and human attention. A cache percentage is not total cost, quality or a request-level hit rate unless its denominator is defined. Retain failures, timeouts and incomplete tasks in experiment denominators. Provider prices/subscription accounting and token definitions must be fixed before comparing arms.

The reported 150k rotation threshold and 283.4k mean context may reflect different versions, models or aggregation; the supplied evidence does not resolve this. No universal 75%, 150k, one-compact, 60-minute or fixed tier-token defaults are adopted. Budget exhaustion stops at a safe boundary and reports incomplete work; it does not delete required checks, advance dependent tasks or fabricate acceptance.

## 9. Source contradictions preserved, not silently combined

S3 asks for one commit per task, while S5 proposes proving test-first order by separate commits. The execution-evidence adaptation above is our resolution, not the author's demonstrated implementation.

S3 keeps detailed task artifacts outside Git by default. A one-line progress entry is not sufficient retained evidence for this profile. A private access-controlled evidence store can satisfy retention; public raw transcript disclosure is not required.

S4 bulk-installs plugins and disables interactive permission prompts, whereas S2/S5 describe conditional surfaces. These are distinct supplied designs, not one verified current installation. Neither copied configuration nor a README can prove protected execution.

The attached protocol itself contains mismatched trivial-task examples/gate descriptions. The future adapter must freeze an unambiguous applicability map rather than guessing which prose wins.

## 10. Threat model and first implementation contract

Attack/failure classes include agent-forged records; mutable policy/tests/gates; replay across subjects/attempts; omitted/truncated records; stale control revisions; detached old sessions; unexpected external effects; unknown outcomes; disclosure of secrets; and self-review/authority laundering.

This design does not establish protection against a compromised host, root access, a malicious authorized recorder, arbitrary same-process code or every unobserved execution surface. A Bash filter is not a complete boundary for Python/MCP/API/file operations. OS isolation and credential separation require a separately tested execution design.

HA-1 consumes only explicitly supplied local policy, inventories, snapshots, evidence and trust configuration; validates bindings and DAG constraints; evaluates named requirements; and emits a read-only bounded report. Network resolution, live GitHub access, execution of referenced commands and writing a new permit are forbidden. Its output must include profile/policy/source identities, requirement results, all missing evidence, recorder assumptions, evidence frontier and explicit non-effects.

The 40 cases in probe-matrix.json are acceptance scenarios to turn into frozen fixtures. They have **not** been run against a target harness or implemented reducer. Static checks of this package establish only parseability, internal reference consistency, explicit scope and graph coherence.

A future implementation stops after one bounded reducer and this fixed matrix. No recursive version sequence is required. Actual control qualification, operational value, independent reproduction, novelty and production suitability remain unestablished.

## 11. Non-effects and coordination

No Core/SPEC/PRINCIPLES, existing workflow, runtime, product, historical receipt, permission, signing key, release or main-branch changes are introduced by this package. No upstream post or raw channel publication is authorized. The repository write records an original design proposal; it is not production activation.

StateBench/related-work closeout #997 remains separate. UU VERIFIED #1000 may later consume accepted evidence through its own review process, but no UV milestone, mark or issuer status is advanced here. Existing C2PA and external-review gates are unaffected. Product state is not inferred from a historical roadmap marker.
