#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "conformance.fixture.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "pre-action-evidence-bundle.schema.json"), "utf8"));
const selectionFixture = JSON.parse(fs.readFileSync(path.join(ROOT, "..", "..", "capability-selection", "v0.1", "conformance.fixture.json"), "utf8"));
const availabilityFixture = JSON.parse(fs.readFileSync(path.join(ROOT, "..", "..", "execution-capability-availability", "v0.1", "conformance.fixture.json"), "utf8"));

function fail(message) { throw new Error(message); }
function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function canonical(v) {
  if (v === null || typeof v === "boolean" || typeof v === "number" || typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObject(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  fail(`unsupported canonical JSON type: ${typeof v}`);
}
function sha256Object(v, excluded = new Set(["content_hash"])) {
  const projection = {};
  for (const [k, value] of Object.entries(v)) if (!excluded.has(k)) projection[k] = value;
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(canonical(projection), "utf8")).digest("hex")}`;
}
function coreHash(r) { return sha256Object(r, new Set(["content_hash", "signature_profile"])); }
function same(a,b) { return canonical(a) === canonical(b); }
function setEq(a,b) { return a.length === b.length && new Set(a).size === a.length && a.every(x => new Set(b).has(x)); }
function ms(s, label) { const v = Date.parse(s); if (Number.isNaN(v)) fail(`${label} invalid date`); return v; }
function checkHash(v,label) { if (typeof v !== "string" || !/^sha256:[0-9a-f]{64}$/.test(v)) fail(`${label} invalid hash`); }
function exactKeys(value, expected, label) {
  if (!isObject(value)) fail(`${label} must be object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label} keys mismatch`);
}
function nonEmpty(value, label) { if (typeof value !== "string" || value.length === 0) fail(`${label} must be non-empty string`); }

const REQUIRED_NON_EFFECTS = {
  StateReceipt: {intent_established:false, authority_established:false, action_performed:false, liability_established:false, truth_certified:false},
  AvailabilityClaim: {intent_established:false, action_performed:false, liability_established:false, truth_certified:false},
  IntentReceipt: {action_performed:false, authority_expanded:false, responsibility_accepted:false, liability_established:false},
  AuthorityReceipt: {permissions_expanded:false, action_performed:false, responsibility_accepted:false, liability_established:false},
  ResponsibilityReceipt: {authority_expanded:false, permissions_expanded:false, action_performed:false, liability_established:false},
  CoordinationReceipt: {execution_authorized:false, action_performed:false, authority_expanded:false, liability_established:false},
  ActionPermit: {action_performed:false, outcome_observed:false, authority_expanded:false, liability_established:false},
};

const BRIDGE_PROFILE = "FCL_PRE_ACTION_EVIDENCE_BRIDGE_V0_1";
const BRIDGE_KEYS = [
  "profile","bridge_id","reconciliation_fingerprint","action_permit_hash","selected_operation","target_operation",
  "target_binding_hash","frontier","availability","projections","assertions","non_effects",
  "next_safe_action","bridged_at","content_hash"
];
const BRIDGE_AVAILABILITY_KEYS = [
  "evidence_binding_content_hash","evidence_state_receipt_hash","evidence_availability_claim_hash",
  "action_chain_state_receipt_hash","action_chain_availability_claim_hash",
  "selection_content_hash","descriptor_content_hash","observation_content_hash",
  "evidence_valid_until","action_chain_valid_until"
];
const BRIDGE_PROJECTION_KEYS = ["intent","authority","coordination"];
const BRIDGE_INTENT_KEYS = ["source_receipt_hash","operation","target_binding_hash"];
const BRIDGE_AUTHORITY_KEYS = ["source_receipt_hash","authority_scope","target_binding_hash"];
const BRIDGE_COORDINATION_KEYS = ["source_receipt_hash","target_binding_hash"];
const BRIDGE_ASSERTION_KEYS = [
  "operation_mapping_exact","separate_availability_receipt_identities",
  "availability_provenance_exact","target_projection_exact",
  "source_receipts_preserved","no_semantic_relaxation"
];
const BRIDGE_NON_EFFECT_KEYS = [
  "source_receipt_rewritten","core_receipt_created","intent_created","authority_created",
  "approval_created","action_permit_created","action_permit_consumed",
  "pre_action_bundle_created","authorize_admitted","execution_admitted","action_performed"
];

function checkCoreReceipt(r, expectedType, label) {
  if (!isObject(r)) fail(`${label} must be object`);
  if (r.protocol !== "UU-AAP Core" || r.version !== "0.1") fail(`${label} Core protocol mismatch`);
  if (expectedType.includes("|")) {
    if (!expectedType.split("|").includes(r.receipt_type)) fail(`${label} receipt type mismatch`);
  } else if (r.receipt_type !== expectedType) fail(`${label} receipt type mismatch`);
  checkHash(r.content_hash, `${label}.content_hash`);
  if (r.content_hash !== coreHash(r)) fail(`${label} content hash mismatch`);
  const req = REQUIRED_NON_EFFECTS[r.receipt_type];
  if (!req) fail(`${label} unsupported receipt type`);
  for (const [k,v] of Object.entries(req)) if (r.non_effects?.[k] !== v) fail(`${label} non_effect ${k} mismatch`);
}

function buildDefaultFixtureEvidenceContext() {
  const selected = selectionFixture.result;
  return {
    selection: {
      selection_id: selectionFixture.selection_id,
      content_hash: selectionFixture.content_hash,
      selected_capability_id: selected.selected_capability_id,
      descriptor_id: selected.selected_descriptor_ref.descriptor_id,
      descriptor_content_hash: selected.selected_descriptor_ref.content_hash,
      operation: selectionFixture.request.operation,
    },
    availability: {
      binding_id: availabilityFixture.binding_id,
      content_hash: availabilityFixture.content_hash,
      observation_content_hash: availabilityFixture.observation.content_hash,
      core_state_receipt_hash: availabilityFixture.core_state_receipt.content_hash,
      core_availability_claim_hash: availabilityFixture.core_availability_claim.content_hash,
      status: availabilityFixture.observation.status,
      valid_until: availabilityFixture.observation.valid_until,
      frontier: availabilityFixture.observation.frontier.revision,
    },
  };
}

function validateEvidenceContext(context) {
  exactKeys(context, ["selection","availability"], "evidenceContext");
  exactKeys(context.selection, ["selection_id","content_hash","selected_capability_id","descriptor_id","descriptor_content_hash","operation"], "evidenceContext.selection");
  exactKeys(context.availability, ["binding_id","content_hash","observation_content_hash","core_state_receipt_hash","core_availability_claim_hash","status","valid_until","frontier"], "evidenceContext.availability");
  for (const key of ["selection_id","selected_capability_id","descriptor_id","operation"]) nonEmpty(context.selection[key], `evidenceContext.selection.${key}`);
  for (const key of ["content_hash","descriptor_content_hash"]) checkHash(context.selection[key], `evidenceContext.selection.${key}`);
  for (const key of ["binding_id","frontier"]) nonEmpty(context.availability[key], `evidenceContext.availability.${key}`);
  for (const key of ["content_hash","observation_content_hash","core_state_receipt_hash","core_availability_claim_hash"]) checkHash(context.availability[key], `evidenceContext.availability.${key}`);
  if (context.availability.status !== "available") fail("evidenceContext.availability.status must be available");
  ms(context.availability.valid_until, "evidenceContext.availability.valid_until");
  return true;
}

function validateEvidenceBridgeContext(bridge) {
  exactKeys(bridge, BRIDGE_KEYS, "bridgeContext");
  if (bridge.profile !== BRIDGE_PROFILE) fail("bridgeContext.profile mismatch");
  nonEmpty(bridge.bridge_id, "bridgeContext.bridge_id");
  checkHash(bridge.reconciliation_fingerprint, "bridgeContext.reconciliation_fingerprint");
  checkHash(bridge.action_permit_hash, "bridgeContext.action_permit_hash");
  nonEmpty(bridge.selected_operation, "bridgeContext.selected_operation");
  nonEmpty(bridge.target_operation, "bridgeContext.target_operation");
  checkHash(bridge.target_binding_hash, "bridgeContext.target_binding_hash");
  nonEmpty(bridge.frontier, "bridgeContext.frontier");

  exactKeys(bridge.availability, BRIDGE_AVAILABILITY_KEYS, "bridgeContext.availability");
  for (const key of [
    "evidence_binding_content_hash","evidence_state_receipt_hash","evidence_availability_claim_hash",
    "action_chain_state_receipt_hash","action_chain_availability_claim_hash",
    "selection_content_hash","descriptor_content_hash","observation_content_hash"
  ]) checkHash(bridge.availability[key], `bridgeContext.availability.${key}`);
  ms(bridge.availability.evidence_valid_until, "bridgeContext.availability.evidence_valid_until");
  ms(bridge.availability.action_chain_valid_until, "bridgeContext.availability.action_chain_valid_until");
  if (bridge.availability.evidence_state_receipt_hash === bridge.availability.action_chain_state_receipt_hash) {
    fail("bridgeContext must preserve distinct generic/FCL StateReceipt identities");
  }
  if (bridge.availability.evidence_availability_claim_hash === bridge.availability.action_chain_availability_claim_hash) {
    fail("bridgeContext must preserve distinct generic/FCL AvailabilityClaim identities");
  }

  exactKeys(bridge.projections, BRIDGE_PROJECTION_KEYS, "bridgeContext.projections");
  exactKeys(bridge.projections.intent, BRIDGE_INTENT_KEYS, "bridgeContext.projections.intent");
  exactKeys(bridge.projections.authority, BRIDGE_AUTHORITY_KEYS, "bridgeContext.projections.authority");
  exactKeys(bridge.projections.coordination, BRIDGE_COORDINATION_KEYS, "bridgeContext.projections.coordination");
  checkHash(bridge.projections.intent.source_receipt_hash, "bridgeContext.projections.intent.source_receipt_hash");
  nonEmpty(bridge.projections.intent.operation, "bridgeContext.projections.intent.operation");
  checkHash(bridge.projections.intent.target_binding_hash, "bridgeContext.projections.intent.target_binding_hash");
  checkHash(bridge.projections.authority.source_receipt_hash, "bridgeContext.projections.authority.source_receipt_hash");
  nonEmpty(bridge.projections.authority.authority_scope, "bridgeContext.projections.authority.authority_scope");
  checkHash(bridge.projections.authority.target_binding_hash, "bridgeContext.projections.authority.target_binding_hash");
  checkHash(bridge.projections.coordination.source_receipt_hash, "bridgeContext.projections.coordination.source_receipt_hash");
  checkHash(bridge.projections.coordination.target_binding_hash, "bridgeContext.projections.coordination.target_binding_hash");

  for (const projection of Object.values(bridge.projections)) {
    if (projection.target_binding_hash !== bridge.target_binding_hash) fail("bridgeContext projection target hash mismatch");
  }

  exactKeys(bridge.assertions, BRIDGE_ASSERTION_KEYS, "bridgeContext.assertions");
  for (const key of BRIDGE_ASSERTION_KEYS) if (bridge.assertions[key] !== true) fail(`bridgeContext.assertions.${key} must be true`);
  exactKeys(bridge.non_effects, BRIDGE_NON_EFFECT_KEYS, "bridgeContext.non_effects");
  for (const key of BRIDGE_NON_EFFECT_KEYS) if (bridge.non_effects[key] !== false) fail(`bridgeContext.non_effects.${key} must be false`);
  if (bridge.next_safe_action !== "ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE") fail("bridgeContext.next_safe_action mismatch");
  ms(bridge.bridged_at, "bridgeContext.bridged_at");
  checkHash(bridge.content_hash, "bridgeContext.content_hash");
  if (bridge.content_hash !== sha256Object(bridge)) fail("bridgeContext content hash mismatch");
  return true;
}

function validateBundle(b, evidenceContext = buildDefaultFixtureEvidenceContext(), bridgeContext = null) {
  validateEvidenceContext(evidenceContext);
  const bridge = bridgeContext === undefined || bridgeContext === null ? null : bridgeContext;
  if (bridge) validateEvidenceBridgeContext(bridge);

  if (!isObject(b)) fail("bundle must be object");
  if (schema.title !== "UU-AAP Pre-Action Evidence Bundle v0.1") fail("schema title mismatch");
  if (b.protocol !== "UU-AAP-PRE-ACTION-EVIDENCE-BUNDLE" || b.version !== "0.1" || b.artifact_type !== "PreActionEvidenceBundle") fail("bundle identity mismatch");
  checkHash(b.content_hash, "bundle content_hash");
  const assembled = ms(b.assembled_at, "assembled_at");

  const selected = evidenceContext.selection;
  if (b.selection_binding.selection_id !== selected.selection_id) fail("selection id mismatch");
  if (b.selection_binding.content_hash !== selected.content_hash) fail("selection hash mismatch");
  if (b.selection_binding.selected_capability_id !== selected.selected_capability_id) fail("selected capability mismatch");
  if (b.selection_binding.descriptor_id !== selected.descriptor_id) fail("selected descriptor id mismatch");
  if (b.selection_binding.descriptor_content_hash !== selected.descriptor_content_hash) fail("selected descriptor hash mismatch");
  if (b.selection_binding.operation !== selected.operation) fail("selected operation mismatch");

  const af = evidenceContext.availability;
  if (b.availability_binding.binding_id !== af.binding_id) fail("availability binding id mismatch");
  if (b.availability_binding.content_hash !== af.content_hash) fail("availability binding hash mismatch");
  if (b.availability_binding.observation_content_hash !== af.observation_content_hash) fail("availability observation hash mismatch");
  if (b.availability_binding.core_availability_claim_hash !== af.core_availability_claim_hash) fail("availability claim ref mismatch");
  if (b.availability_binding.status !== "available" || b.availability_binding.status !== af.status) fail("availability status must be available");
  if (b.availability_binding.valid_until !== af.valid_until) fail("availability validity mismatch");
  if (b.availability_binding.frontier !== af.frontier) fail("availability frontier mismatch");

  const targetProjection = {
    resource:b.target.resource,
    operation:b.target.operation,
    expected_predecessor_frontier:b.target.expected_predecessor_frontier,
    authority_scope:b.target.authority_scope,
  };
  if (b.target.binding_hash !== sha256Object(targetProjection, new Set())) fail("target binding hash mismatch");
  if (!bridge) {
    if (b.target.operation !== b.selection_binding.operation) fail("target operation mismatch");
  } else {
    if (bridge.selected_operation !== b.selection_binding.operation) fail("bridge selected operation mismatch");
    if (bridge.target_operation !== b.target.operation) fail("bridge target operation mismatch");
    if (bridge.target_binding_hash !== b.target.binding_hash) fail("bridge target binding mismatch");
    if (bridge.frontier !== b.target.expected_predecessor_frontier) fail("bridge frontier mismatch");
  }
  if (b.target.expected_predecessor_frontier !== b.availability_binding.frontier) fail("target frontier mismatch");

  if (b.approval_binding.content_hash !== sha256Object(b.approval_binding)) fail("approval content hash mismatch");
  if (b.approval_binding.kind !== "action_specific" || b.approval_binding.scope_bound !== true) fail("approval must be action-specific and scope-bound");
  if (b.approval_binding.subject_id !== b.subject.id) fail("approval subject mismatch");
  if (b.approval_binding.operation !== b.target.operation) fail("approval operation mismatch");
  if (b.approval_binding.authority_scope !== b.target.authority_scope) fail("approval authority scope mismatch");
  if (b.approval_binding.target_binding_hash !== b.target.binding_hash) fail("approval target binding mismatch");
  if (b.approval_binding.one_shot !== true) fail("approval must be one-shot");

  const c = b.core_receipts;
  checkCoreReceipt(c.state, "StateReceipt", "state");
  checkCoreReceipt(c.availability, "AvailabilityClaim", "availability");
  checkCoreReceipt(c.intent, "IntentReceipt", "intent");
  checkCoreReceipt(c.authority_or_responsibility, "AuthorityReceipt|ResponsibilityReceipt", "authority_or_responsibility");
  checkCoreReceipt(c.coordination, "CoordinationReceipt", "coordination");
  checkCoreReceipt(c.action_permit, "ActionPermit", "action_permit");

  if (!bridge) {
    if (c.state.content_hash !== af.core_state_receipt_hash) fail("state receipt not bound to availability profile");
    if (c.availability.content_hash !== af.core_availability_claim_hash) fail("availability receipt not bound to availability profile");
  } else {
    const bav = bridge.availability;
    if (bav.evidence_binding_content_hash !== b.availability_binding.content_hash) fail("bridge evidence availability binding mismatch");
    if (bav.evidence_state_receipt_hash !== af.core_state_receipt_hash) fail("bridge evidence StateReceipt mismatch");
    if (bav.evidence_availability_claim_hash !== af.core_availability_claim_hash) fail("bridge evidence AvailabilityClaim mismatch");
    if (bav.action_chain_state_receipt_hash !== c.state.content_hash) fail("bridge action-chain StateReceipt mismatch");
    if (bav.action_chain_availability_claim_hash !== c.availability.content_hash) fail("bridge action-chain AvailabilityClaim mismatch");
    if (bav.selection_content_hash !== b.selection_binding.content_hash) fail("bridge selection provenance mismatch");
    if (bav.descriptor_content_hash !== b.selection_binding.descriptor_content_hash) fail("bridge descriptor provenance mismatch");
    if (bav.observation_content_hash !== b.availability_binding.observation_content_hash) fail("bridge observation provenance mismatch");
    if (bav.evidence_valid_until !== b.availability_binding.valid_until) fail("bridge evidence availability horizon mismatch");
    if (bav.action_chain_valid_until !== c.availability.payload.valid_until) fail("bridge action-chain availability horizon mismatch");
  }

  if (!same(c.state.subject,b.subject)) fail("bundle/state subject mismatch");
  for (const [name,r] of Object.entries(c)) {
    if (!same(r.subject,b.subject)) fail(`${name} subject mismatch`);
    if (r.frontier.revision !== b.target.expected_predecessor_frontier) fail(`${name} frontier mismatch`);
    if (ms(r.issued_at, `${name}.issued_at`) > assembled) fail(`${name} created after bundle assembly`);
  }

  if (c.state.predecessor_receipt_hashes.length !== 0 || c.state.assertions.state_anchored !== true) fail("StateReceipt semantics mismatch");
  if (!setEq(c.availability.predecessor_receipt_hashes,[c.state.content_hash]) || c.availability.assertions.availability_qualified !== true) fail("AvailabilityClaim predecessor/qualification mismatch");
  if (c.availability.payload.status !== "available") fail("AvailabilityClaim status mismatch");
  if (!bridge) {
    if (c.availability.payload.selection_record_hash !== b.selection_binding.content_hash) fail("AvailabilityClaim selection binding mismatch");
    if (c.availability.payload.descriptor_content_hash !== b.selection_binding.descriptor_content_hash) fail("AvailabilityClaim descriptor binding mismatch");
    if (c.availability.payload.availability_observation_hash !== b.availability_binding.observation_content_hash) fail("AvailabilityClaim observation binding mismatch");
    if (c.availability.payload.valid_until !== b.availability_binding.valid_until) fail("AvailabilityClaim validity binding mismatch");
    if (c.availability.assertions.capability !== `${b.selection_binding.selected_capability_id}#${b.target.operation}`) fail("AvailabilityClaim capability mismatch");
  }

  if (!setEq(c.intent.predecessor_receipt_hashes,[c.state.content_hash]) || c.intent.assertions.intent_declared !== true) fail("IntentReceipt predecessor/declaration mismatch");
  if (!bridge) {
    if (c.intent.payload.operation !== b.target.operation || c.intent.assertions.target_binding_hash !== b.target.binding_hash) fail("IntentReceipt target mismatch");
  } else {
    if (bridge.projections.intent.source_receipt_hash !== c.intent.content_hash) fail("bridge IntentReceipt source mismatch");
    if (bridge.projections.intent.operation !== b.target.operation) fail("bridge intent operation mismatch");
    if (bridge.projections.intent.target_binding_hash !== b.target.binding_hash) fail("bridge intent target mismatch");
  }

  if (!setEq(c.authority_or_responsibility.predecessor_receipt_hashes,[c.intent.content_hash])) fail("Authority/Responsibility predecessor mismatch");
  if (c.authority_or_responsibility.receipt_type === "AuthorityReceipt" && c.authority_or_responsibility.assertions.authority_bound !== true) fail("AuthorityReceipt must assert authority_bound");
  if (c.authority_or_responsibility.assertions.authority_scope !== b.target.authority_scope) fail("authority scope mismatch");
  if (!bridge) {
    if (c.authority_or_responsibility.assertions.target_binding_hash !== b.target.binding_hash) fail("authority target mismatch");
  } else {
    if (bridge.projections.authority.source_receipt_hash !== c.authority_or_responsibility.content_hash) fail("bridge AuthorityReceipt source mismatch");
    if (bridge.projections.authority.authority_scope !== b.target.authority_scope) fail("bridge authority scope mismatch");
    if (bridge.projections.authority.target_binding_hash !== b.target.binding_hash) fail("bridge authority target mismatch");
  }

  const coordExpected=[c.availability.content_hash,c.intent.content_hash,c.authority_or_responsibility.content_hash];
  if (!setEq(c.coordination.predecessor_receipt_hashes,coordExpected)) fail("CoordinationReceipt must include Availability + Intent + Authority/Responsibility");
  if (c.coordination.assertions.coordination_established !== true) fail("CoordinationReceipt semantics mismatch");
  if (!bridge) {
    if (c.coordination.assertions.target_binding_hash !== b.target.binding_hash) fail("CoordinationReceipt semantics mismatch");
  } else {
    if (bridge.projections.coordination.source_receipt_hash !== c.coordination.content_hash) fail("bridge CoordinationReceipt source mismatch");
    if (bridge.projections.coordination.target_binding_hash !== b.target.binding_hash) fail("bridge coordination target mismatch");
  }

  const permitExpected=[c.state.content_hash,c.intent.content_hash,c.authority_or_responsibility.content_hash,c.coordination.content_hash];
  if (!setEq(c.action_permit.predecessor_receipt_hashes,permitExpected)) fail("ActionPermit predecessor graph mismatch");
  if (c.action_permit.assertions.action_permitted !== true) fail("ActionPermit must assert action_permitted");
  if (bridge && bridge.action_permit_hash !== c.action_permit.content_hash) fail("bridge ActionPermit source mismatch");
  if (c.action_permit.assertions.target_binding_hash !== b.target.binding_hash || c.action_permit.payload.target_binding_hash !== b.target.binding_hash) fail("ActionPermit target mismatch");
  if (c.action_permit.payload.one_shot !== true || c.action_permit.payload.consumed !== false) fail("ActionPermit one-shot state mismatch");

  const availabilityExpiry=ms(b.availability_binding.valid_until,"availability valid_until");
  const approvalExpiry=ms(b.approval_binding.valid_until,"approval valid_until");
  const permitExpiry=ms(c.action_permit.payload.expires_at,"permit expires_at");
  if (assembled >= availabilityExpiry) fail("availability stale at bundle assembly");
  if (assembled >= approvalExpiry) fail("approval expired at bundle assembly");
  if (assembled >= permitExpiry) fail("ActionPermit expired at bundle assembly");
  if (bridge) {
    if (assembled < ms(bridge.bridged_at, "bridge bridged_at")) fail("bundle assembled before bridge");
    if (assembled >= ms(bridge.availability.action_chain_valid_until, "bridge action-chain valid_until")) fail("FCL action-chain availability stale at bundle assembly");
  }
  const horizon = Math.min(availabilityExpiry, approvalExpiry, permitExpiry);
  if (ms(b.lifecycle_handoff.authorization_must_occur_by,"authorization_must_occur_by") !== horizon) fail("authorization horizon must equal earliest expiry");
  if (horizon <= assembled) fail("authorization horizon already expired");

  const h=b.lifecycle_handoff;
  if (h.protocol !== "UU-AAP-BOUNDED-EXECUTION-LIFECYCLE" || h.version !== "0.1" || h.next_phase !== "authorize") fail("lifecycle handoff must target authorize");
  if (h.frontier !== b.target.expected_predecessor_frontier) fail("lifecycle frontier mismatch");
  if (h.target_binding_hash !== b.target.binding_hash) fail("lifecycle target mismatch");
  if (h.action_permit_hash !== c.action_permit.content_hash) fail("lifecycle permit mismatch");
  if (h.approval_hash !== b.approval_binding.content_hash) fail("lifecycle approval mismatch");
  if (h.one_shot !== true || h.permit_consumed !== false) fail("lifecycle one-shot state mismatch");

  for (const k of ["core_chain_valid","availability_fresh_at_assembly","approval_exactly_bound","target_exactly_bound","action_permit_preexists_bundle","evidence_complete_for_authorize_handoff"]) {
    if (b.assertions[k] !== true) fail(`required assertion ${k} must be true`);
  }
  for (const k of ["intent_created_by_bundle","authority_created_by_bundle","approval_created_by_bundle","action_permit_created_by_bundle","action_performed","outcome_observed","authority_expanded","future_action_permission_created","general_authority_created","causality_proven","truth_certified","liability_established"]) {
    if (b.non_effects[k] !== false) fail(`required non_effect ${k} must be false`);
  }

  if (b.content_hash !== sha256Object(b)) fail("bundle content hash mismatch");
  return true;
}

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function rehashCore(r){ r.content_hash=coreHash(r); }
function rehashApproval(a){ a.content_hash=sha256Object(a); }
function expectFailure(name, mutate) {
  const x=clone(fixture);
  mutate(x);
  let ok=false;
  try { validateBundle(x); }
  catch(e){ ok=true; }
  if (!ok) fail(`negative unexpectedly passed: ${name}`);
  process.stdout.write(`PASS negative: ${name}\n`);
}

const negatives = [
["protocol substitution", x=>x.protocol="BAD"],
["selection hash substitution", x=>x.selection_binding.content_hash="sha256:"+"0".repeat(64)],
["selected capability substitution", x=>x.selection_binding.selected_capability_id="urn:bad"],
["descriptor id substitution", x=>x.selection_binding.descriptor_id="urn:bad"],
["descriptor hash substitution", x=>x.selection_binding.descriptor_content_hash="sha256:"+"3".repeat(64)],
["operation substitution", x=>x.selection_binding.operation="delete"],
["availability binding hash substitution", x=>x.availability_binding.content_hash="sha256:"+"4".repeat(64)],
["availability downgraded", x=>x.availability_binding.status="unavailable"],
["availability stale", x=>x.availability_binding.valid_until="2026-08-24T19:55:07Z"],
["availability frontier substitution", x=>x.availability_binding.frontier="git:wrong"],
["target resource substitution", x=>x.target.resource="urn:bad"],
["target operation substitution", x=>x.target.operation="delete"],
["target authority scope substitution", x=>x.target.authority_scope="demo:admin"],
["target binding substitution", x=>x.target.binding_hash="sha256:"+"5".repeat(64)],
["approval mode downgrade", x=>{x.approval_binding.kind="protocol_mode"; rehashApproval(x.approval_binding);} ],
["approval not scope bound", x=>{x.approval_binding.scope_bound=false; rehashApproval(x.approval_binding);} ],
["approval operation substitution", x=>{x.approval_binding.operation="delete"; rehashApproval(x.approval_binding);} ],
["approval target substitution", x=>{x.approval_binding.target_binding_hash="sha256:"+"6".repeat(64); rehashApproval(x.approval_binding);} ],
["approval expired", x=>{x.approval_binding.valid_until="2026-08-24T19:55:07Z"; rehashApproval(x.approval_binding);} ],
["approval not one shot", x=>{x.approval_binding.one_shot=false; rehashApproval(x.approval_binding);} ],
["state frontier substitution", x=>{x.core_receipts.state.frontier.revision="git:wrong"; rehashCore(x.core_receipts.state);} ],
["availability missing State predecessor", x=>{x.core_receipts.availability.predecessor_receipt_hashes=[]; rehashCore(x.core_receipts.availability);} ],
["availability qualification removed", x=>{x.core_receipts.availability.assertions.availability_qualified=false; rehashCore(x.core_receipts.availability);} ],
["intent predecessor substitution", x=>{x.core_receipts.intent.predecessor_receipt_hashes=["sha256:"+"7".repeat(64)]; rehashCore(x.core_receipts.intent);} ],
["authority predecessor substitution", x=>{x.core_receipts.authority_or_responsibility.predecessor_receipt_hashes=["sha256:"+"8".repeat(64)]; rehashCore(x.core_receipts.authority_or_responsibility);} ],
["authority scope substitution", x=>{x.core_receipts.authority_or_responsibility.assertions.authority_scope="demo:admin"; rehashCore(x.core_receipts.authority_or_responsibility);} ],
["coordination missing AvailabilityClaim", x=>{x.core_receipts.coordination.predecessor_receipt_hashes=x.core_receipts.coordination.predecessor_receipt_hashes.filter(h=>h!==x.core_receipts.availability.content_hash); rehashCore(x.core_receipts.coordination);} ],
["coordination missing IntentReceipt", x=>{x.core_receipts.coordination.predecessor_receipt_hashes=x.core_receipts.coordination.predecessor_receipt_hashes.filter(h=>h!==x.core_receipts.intent.content_hash); rehashCore(x.core_receipts.coordination);} ],
["coordination target substitution", x=>{x.core_receipts.coordination.assertions.target_binding_hash="sha256:"+"9".repeat(64); rehashCore(x.core_receipts.coordination);} ],
["permit missing CoordinationReceipt", x=>{x.core_receipts.action_permit.predecessor_receipt_hashes=x.core_receipts.action_permit.predecessor_receipt_hashes.filter(h=>h!==x.core_receipts.coordination.content_hash); rehashCore(x.core_receipts.action_permit);} ],
["permit already consumed", x=>{x.core_receipts.action_permit.payload.consumed=true; rehashCore(x.core_receipts.action_permit);} ],
["permit not one shot", x=>{x.core_receipts.action_permit.payload.one_shot=false; rehashCore(x.core_receipts.action_permit);} ],
["permit expired", x=>{x.core_receipts.action_permit.payload.expires_at="2026-08-24T19:55:07Z"; rehashCore(x.core_receipts.action_permit);} ],
["permit target substitution", x=>{x.core_receipts.action_permit.payload.target_binding_hash="sha256:"+"a".repeat(64); rehashCore(x.core_receipts.action_permit);} ],
["handoff maps to execute", x=>x.lifecycle_handoff.next_phase="execute"],
["handoff claims consumed permit", x=>x.lifecycle_handoff.permit_consumed=true],
["handoff permit substitution", x=>x.lifecycle_handoff.action_permit_hash="sha256:"+"b".repeat(64)],
["authorization horizon extended", x=>x.lifecycle_handoff.authorization_must_occur_by="2026-08-24T19:56:02Z"],
["core-chain assertion removed", x=>x.assertions.core_chain_valid=false],
["bundle creates permit", x=>x.non_effects.action_permit_created_by_bundle=true],
["bundle claims action performed", x=>x.non_effects.action_performed=true],
["bundle creates future permission", x=>x.non_effects.future_action_permission_created=true],
["bundle content hash mismatch", x=>x.content_hash="sha256:"+"c".repeat(64)],
];

function runConformance() {
  validateBundle(fixture);
  process.stdout.write(`PASS positive: ${fixture.bundle_id}\n`);
  for (const [name, mutate] of negatives) expectFailure(name, mutate);
  process.stdout.write(`UU-AAP Pre-Action Evidence Bundle v0.1: PASS (${negatives.length} negative tests)\n`);
}

if (require.main === module) runConformance();

module.exports = {
  BRIDGE_PROFILE,
  buildDefaultFixtureEvidenceContext,
  canonical,
  coreHash,
  sha256Object,
  validateBundle,
  validateEvidenceBridgeContext,
  validateEvidenceContext,
};
