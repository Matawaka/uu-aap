#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const DIR = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(DIR, "conformance.fixture.json"), "utf8"));

function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k)+":"+stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function hashReceipt(v) {
  const x = JSON.parse(JSON.stringify(v));
  delete x.content_hash;
  return crypto.createHash("sha256").update(stable(x)).digest("hex");
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function disjoint(a,b) { return !a.some(x => b.includes(x)); }

function validate(x) {
  const {binding_manifest:b, gateway_context:g, invocation:i, observation:o, composition_result:c} = x;

  assert(b.protocol === "UU-AAP-AI-GATEWAY-TOOL-BINDING", "binding protocol");
  assert(b.version === "0.1", "binding version");
  assert(b.transports.includes("mcp") && b.transports.length >= 2, "provider-neutral transport set required");
  for (const k of Object.keys(b.invariants)) assert(b.invariants[k] === true, "binding invariant must be true: "+k);

  assert(i.protocol === "UU-AAP-AI-GATEWAY-GITHUB-ADAPTER", "invocation protocol");
  assert(i.version === "0.1" && i.artifact_type === "GitHubActuatorInvocation", "invocation identity");
  assert(i.content_hash === hashReceipt(i), "invocation content hash");
  assert(i.transport_binding.transport_does_not_define_authority === true, "transport authority");
  assert(g.decision === "admissible" && i.gateway_binding.decision === "admissible", "admissible decision required");
  assert(i.gateway_binding.gateway_request_hash === g.request_hash, "request hash mismatch");
  assert(i.gateway_binding.gateway_decision_hash === g.decision_hash, "decision hash mismatch");
  assert(i.gateway_binding.frontier === g.frontier, "gateway frontier mismatch");
  assert(i.gateway_binding.action_permit_hash === g.core_action_permit_hash, "ActionPermit mismatch");
  assert(i.gateway_binding.approval_reference === g.approval_reference, "approval mismatch");
  assert(i.target.repository === g.authorized_repository, "repository broadened");
  assert(i.target.operation === g.authorized_operation, "operation substituted");
  assert(i.target.pr_number === g.authorized_pr_number, "PR substituted");
  assert(i.target.expected_head_sha === g.authorized_head_sha, "stale/mismatched head SHA");
  assert(i.target.expected_base_sha === g.authorized_base_sha, "stale/mismatched base SHA");
  assert(i.target.merge_method === g.authorized_merge_method, "unauthorized merge method");
  assert(disjoint(i.scope.expected_effects, i.scope.explicit_non_effects), "effect/non-effect overlap");
  for (const k of Object.keys(i.assertions)) assert(i.assertions[k] === true, "invocation assertion must be true: "+k);
  for (const k of Object.keys(i.non_effects)) assert(i.non_effects[k] === false, "invocation non-effect must be false: "+k);

  assert(o.protocol === "UU-AAP-AI-GATEWAY-GITHUB-ADAPTER", "observation protocol");
  assert(o.version === "0.1" && o.artifact_type === "GitHubActuatorObservation", "observation identity");
  assert(o.content_hash === hashReceipt(o), "observation content hash");
  assert(o.invocation_hash === "sha256:"+i.content_hash, "observation invocation binding");
  assert(o.frontier_before === g.frontier, "observation frontier mismatch");
  assert(o.provider === "github", "observation provider");
  assert(o.repository === i.target.repository, "observation repository mismatch");
  assert(o.operation === i.target.operation, "observation operation mismatch");
  assert(o.pr_number === i.target.pr_number, "observation PR mismatch");
  if (o.result === "performed_observed") {
    assert(o.external_evidence && o.external_evidence.evidence_ref, "performed observation requires external evidence");
    assert(o.observed_state.observed_head_sha === i.target.expected_head_sha, "observed head mismatch");
    assert(o.observed_state.observed_base_sha_before === i.target.expected_base_sha, "observed base-before mismatch");
  }
  assert(disjoint(o.observed_effects, o.explicit_unobserved_or_non_effects), "observed/non-effect overlap");
  for (const k of Object.keys(o.assertions)) assert(o.assertions[k] === true, "observation assertion must be true: "+k);
  for (const k of Object.keys(o.non_effects)) assert(o.non_effects[k] === false, "observation non-effect must be false: "+k);

  assert(c.gateway_contract_required === true && c.core_action_permit_required === true, "gateway/Core required");
  assert(c.transport_creates_authority === false, "transport cannot create authority");
  assert(c.adapter_creates_action_permit === false, "adapter cannot create ActionPermit");
  assert(c.adapter_contract_performs_action === false, "contract cannot perform action");
  assert(c.observation_proves_causality === false, "observation cannot prove causality");
  return true;
}
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function expectReject(name, mutate) {
  const x = clone(fixture); mutate(x);
  let failed=false; try { validate(x); } catch(e) { failed=true; }
  if (!failed) throw new Error("negative vector accepted: "+name);
}

validate(fixture);

expectReject("non-admissible decision", x => { x.gateway_context.decision="denied"; });
expectReject("missing ActionPermit", x => { x.gateway_context.core_action_permit_hash=""; });
expectReject("missing approval", x => { x.gateway_context.approval_reference=""; });
expectReject("gateway frontier mismatch", x => { x.invocation.gateway_binding.frontier="sha256:"+"a".repeat(64); x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("repository broadening", x => { x.invocation.target.repository="other/repo"; x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("operation substitution", x => { x.gateway_context.authorized_operation="create_pr"; });
expectReject("PR substitution", x => { x.invocation.target.pr_number=1000; x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("stale head", x => { x.invocation.target.expected_head_sha="4".repeat(40); x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("stale base", x => { x.invocation.target.expected_base_sha="5".repeat(40); x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("unauthorized merge method", x => { x.invocation.target.merge_method="merge"; x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("effect overlap", x => { x.invocation.scope.explicit_non_effects.push("pr_merged"); x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("adapter creates authority", x => { x.invocation.non_effects.authority_created=true; x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("adapter creates ActionPermit", x => { x.invocation.non_effects.action_permit_created=true; x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("transport defines authority", x => { x.invocation.transport_binding.transport_does_not_define_authority=false; x.invocation.content_hash=hashReceipt(x.invocation); });
expectReject("observation without external evidence", x => { x.observation.external_evidence.evidence_ref=""; x.observation.content_hash=hashReceipt(x.observation); });
expectReject("observation target mismatch", x => { x.observation.repository="other/repo"; x.observation.content_hash=hashReceipt(x.observation); });
expectReject("observation claims execution", x => { x.observation.non_effects.gateway_performed_action=true; x.observation.content_hash=hashReceipt(x.observation); });
expectReject("observation claims causality", x => { x.observation.non_effects.causality_proven=true; x.observation.content_hash=hashReceipt(x.observation); });
expectReject("protocol consent as approval", x => { x.invocation.gateway_binding.approval_reference=x.gateway_context.request_hash; x.invocation.content_hash=hashReceipt(x.invocation); });

console.log("UU_AAP_AI_GATEWAY_GITHUB_ADAPTER_V0_1_PASS");
