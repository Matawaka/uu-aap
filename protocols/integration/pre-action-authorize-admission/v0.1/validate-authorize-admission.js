#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const FIXTURE_PATH = path.join(ROOT, "conformance.fixture.json");
const SCHEMA_PATH = path.join(ROOT, "authorize-admission.schema.json");
const DEFAULT_BUNDLE_PATH = path.join(ROOT, "..", "..", "pre-action-evidence-bundle", "v0.1", "conformance.fixture.json");
const BUNDLE_PATH = process.env.UU_AAP_PRE_ACTION_FIXTURE || DEFAULT_BUNDLE_PATH;

function fail(message) { throw new Error(message); }
function isObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function stableCanonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonicalize).join(",")}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableCanonicalize(value[k])}`).join(",")}}`;
  }
  fail(`unsupported canonical JSON value type: ${typeof value}`);
}
function computeContentHash(record) {
  const projection = {};
  for (const [key, value] of Object.entries(record)) if (key !== "content_hash") projection[key] = value;
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(stableCanonicalize(projection), "utf8")).digest("hex")}`;
}
function parseTime(v, label) { const n = Date.parse(v); if (!Number.isFinite(n)) fail(`${label} must be an ISO-8601 timestamp`); return n; }
function requireFalse(obj, key) { if (!(key in obj)) fail(`missing non_effect ${key}`); if (obj[key] !== false) fail(`non_effect ${key} must be false`); }
function requireTrue(obj, key) { if (!(key in obj)) fail(`missing assertion ${key}`); if (obj[key] !== true) fail(`assertion ${key} must be true`); }
function eq(actual, expected, label) { if (actual !== expected) fail(`${label} mismatch`); }

function validateAssessment(record, bundle) {
  if (!isObject(record)) fail("assessment must be object");
  eq(record.protocol, "UU-AAP-PRE-ACTION-AUTHORIZE-ADMISSION", "protocol");
  eq(record.version, "0.1", "version");
  eq(record.artifact_type, "PreActionAuthorizeAdmissionAssessment", "artifact_type");
  if (!isObject(bundle)) fail("upstream bundle must be object");
  eq(bundle.protocol, "UU-AAP-PRE-ACTION-EVIDENCE-BUNDLE", "upstream bundle protocol");
  eq(bundle.version, "0.1", "upstream bundle version");
  eq(bundle.artifact_type, "PreActionEvidenceBundle", "upstream bundle artifact_type");
  eq(record.pre_action_bundle_ref.bundle_id, bundle.bundle_id, "bundle id");
  eq(record.pre_action_bundle_ref.content_hash, bundle.content_hash, "bundle content hash");
  requireTrue(bundle.assertions, "core_chain_valid");
  requireTrue(bundle.assertions, "evidence_complete_for_authorize_handoff");
  eq(bundle.lifecycle_handoff.next_phase, "authorize", "bundle next phase");
  eq(record.subject.id, bundle.subject.id, "subject id");
  eq(record.subject.scope, bundle.subject.scope, "subject scope");
  eq(record.action_binding.capability_id, bundle.selection_binding.selected_capability_id, "capability id");
  eq(record.action_binding.operation, bundle.selection_binding.operation, "operation");
  eq(record.action_binding.authority_scope, bundle.target.authority_scope, "authority scope");
  eq(record.action_binding.target_binding_hash, bundle.target.binding_hash, "target binding hash");
  eq(record.action_binding.predecessor_frontier, bundle.target.expected_predecessor_frontier, "predecessor frontier");
  eq(record.freshness_binding.availability_binding_hash, bundle.availability_binding.content_hash, "availability binding hash");
  eq(record.freshness_binding.availability_valid_until, bundle.availability_binding.valid_until, "availability valid_until");
  eq(record.freshness_binding.approval_hash, bundle.approval_binding.content_hash, "approval hash");
  eq(record.freshness_binding.approval_valid_until, bundle.approval_binding.valid_until, "approval valid_until");
  eq(record.freshness_binding.action_permit_hash, bundle.core_receipts.action_permit.content_hash, "ActionPermit hash");
  eq(record.freshness_binding.permit_expires_at, bundle.core_receipts.action_permit.payload.expires_at, "permit expires_at");
  eq(record.freshness_binding.authorization_must_occur_by, bundle.lifecycle_handoff.authorization_must_occur_by, "authorization horizon");
  eq(record.freshness_binding.permit_one_shot, bundle.core_receipts.action_permit.payload.one_shot, "permit one-shot");
  eq(record.lifecycle_binding.protocol, "UU-AAP-BOUNDED-EXECUTION-LIFECYCLE", "lifecycle protocol");
  eq(record.lifecycle_binding.version, "0.1", "lifecycle version");
  eq(record.lifecycle_binding.phase, "authorize", "lifecycle phase");
  eq(record.lifecycle_binding.admission_assessment_role, "optional_evidence", "admission assessment role");

  const times = [["availability", record.freshness_binding.availability_valid_until], ["approval", record.freshness_binding.approval_valid_until], ["permit", record.freshness_binding.permit_expires_at]];
  const evaluatedAt = parseTime(record.evaluated_at, "evaluated_at");
  const horizon = parseTime(record.freshness_binding.authorization_must_occur_by, "authorization_must_occur_by");
  const expectedHorizon = Math.min(...times.map(([label, value]) => parseTime(value, `${label} expiry`)));
  if (horizon !== expectedHorizon) fail("authorization horizon must equal earliest expiry");
  const permitIssuedAt = parseTime(bundle.core_receipts.action_permit.issued_at, "ActionPermit issued_at");
  if (permitIssuedAt > evaluatedAt) fail("ActionPermit must pre-exist admission assessment");
  const fresh = evaluatedAt <= horizon && times.every(([label, value]) => evaluatedAt <= parseTime(value, `${label} expiry`));
  const shouldAdmit = fresh && record.freshness_binding.permit_one_shot === true && record.freshness_binding.permit_consumed === false;

  if (record.decision.status === "admissible") {
    if (!shouldAdmit) fail("admissible decision requires fresh one-shot unconsumed permit");
    for (const key of ["bundle_exactly_bound","authorize_handoff_rechecked","freshness_valid_at_decision","target_exactly_bound","approval_exactly_bound","permit_exactly_bound","permit_preexists_admission","permit_unconsumed","admission_is_optional_evidence"]) requireTrue(record.assertions, key);
  } else if (record.decision.status === "denied") {
    if (shouldAdmit && record.assertions.freshness_valid_at_decision === true) fail("denied decision must identify a failed admission condition");
  } else fail("decision status must be admissible or denied");

  for (const key of ["intent_created","authority_created_or_expanded","approval_created","core_action_permit_created","permit_consumed","action_performed","execute_phase_entered","availability_lifetime_extended","future_action_permission_created","general_authority_created","causality_proven","truth_certified","liability_established"]) requireFalse(record.non_effects, key);
  const expectedHash = computeContentHash(record);
  if (record.content_hash !== expectedHash) fail(`content hash mismatch: expected ${expectedHash}, got ${record.content_hash}`);
  return true;
}

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }
function rehash(v) { v.content_hash = computeContentHash(v); }
function expectFailure(name, record, bundle, pattern) {
  let failed = false;
  try { validateAssessment(record, bundle); } catch (err) { failed = true; if (pattern && !pattern.test(String(err.message))) fail(`${name} failed for unexpected reason: ${err.message}`); }
  if (!failed) fail(`${name} unexpectedly passed`);
  process.stdout.write(`PASS negative: ${name}\n`);
}

function runConformance() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  if (schema.title !== "UU-AAP Pre-Action Bundle to Lifecycle Authorize Admission v0.1") fail("schema title mismatch");
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));
  validateAssessment(fixture, bundle);
  process.stdout.write(`PASS positive: ${fixture.assessment_id}\n`);

  const negatives = [
    ["bundle hash substitution", r => r.pre_action_bundle_ref.content_hash = "sha256:"+"1".repeat(64), /bundle content hash mismatch/],
    ["bundle id substitution", r => r.pre_action_bundle_ref.bundle_id += ":other", /bundle id mismatch/],
    ["subject substitution", r => r.subject.id += ":other", /subject id mismatch/],
    ["capability substitution", r => r.action_binding.capability_id += ":other", /capability id mismatch/],
    ["operation substitution", r => r.action_binding.operation = "delete", /operation mismatch/],
    ["authority scope substitution", r => r.action_binding.authority_scope = "demo:admin", /authority scope mismatch/],
    ["target substitution", r => r.action_binding.target_binding_hash = "sha256:"+"2".repeat(64), /target binding hash mismatch/],
    ["frontier substitution", r => r.action_binding.predecessor_frontier += ":other", /predecessor frontier mismatch/],
    ["availability binding substitution", r => r.freshness_binding.availability_binding_hash = "sha256:"+"3".repeat(64), /availability binding hash mismatch/],
    ["availability expiry substitution", r => r.freshness_binding.availability_valid_until = "2026-08-24T19:56:03Z", /availability valid_until mismatch/],
    ["approval substitution", r => r.freshness_binding.approval_hash = "sha256:"+"4".repeat(64), /approval hash mismatch/],
    ["approval expiry substitution", r => r.freshness_binding.approval_valid_until = "2026-08-24T19:56:01Z", /approval valid_until mismatch/],
    ["permit substitution", r => r.freshness_binding.action_permit_hash = "sha256:"+"5".repeat(64), /ActionPermit hash mismatch/],
    ["permit expiry substitution", r => r.freshness_binding.permit_expires_at = "2026-08-24T19:56:01Z", /permit expires_at mismatch/],
    ["horizon extension", r => r.freshness_binding.authorization_must_occur_by = "2026-08-24T19:56:02Z", /authorization horizon mismatch/],
    ["stale authorize decision", r => r.evaluated_at = "2026-08-24T19:56:01Z", /admissible decision requires fresh/],
    ["permit consumed before authorize", r => r.freshness_binding.permit_consumed = true, /admissible decision requires fresh/],
    ["one-shot weakened", r => r.freshness_binding.permit_one_shot = false, /permit one-shot mismatch/],
    ["lifecycle protocol substitution", r => r.lifecycle_binding.protocol = "OTHER", /lifecycle protocol mismatch/],
    ["lifecycle version substitution", r => r.lifecycle_binding.version = "0.2", /lifecycle version mismatch/],
    ["direct execute handoff", r => r.lifecycle_binding.phase = "execute", /lifecycle phase mismatch/],
    ["mandatory provider role", r => r.lifecycle_binding.admission_assessment_role = "mandatory_authority", /admission assessment role mismatch/],
    ["claims permit post-dates admission", r => r.evaluated_at = "2026-08-24T19:55:06Z", /pre-exist admission assessment/],
    ["bundle exact assertion removed", r => r.assertions.bundle_exactly_bound = false, /bundle_exactly_bound must be true/],
    ["freshness assertion removed", r => r.assertions.freshness_valid_at_decision = false, /freshness_valid_at_decision must be true/],
    ["permit unconsumed assertion removed", r => r.assertions.permit_unconsumed = false, /permit_unconsumed must be true/],
    ["admission optionality assertion removed", r => r.assertions.admission_is_optional_evidence = false, /admission_is_optional_evidence must be true/],
    ["intent creation escalation", r => r.non_effects.intent_created = true, /intent_created must be false/],
    ["authority escalation", r => r.non_effects.authority_created_or_expanded = true, /authority_created_or_expanded must be false/],
    ["approval creation escalation", r => r.non_effects.approval_created = true, /approval_created must be false/],
    ["permit creation escalation", r => r.non_effects.core_action_permit_created = true, /core_action_permit_created must be false/],
    ["permit consumption escalation", r => r.non_effects.permit_consumed = true, /permit_consumed must be false/],
    ["action execution escalation", r => r.non_effects.action_performed = true, /action_performed must be false/],
    ["execute phase escalation", r => r.non_effects.execute_phase_entered = true, /execute_phase_entered must be false/],
    ["availability lifetime extension", r => r.non_effects.availability_lifetime_extended = true, /availability_lifetime_extended must be false/],
    ["future permission escalation", r => r.non_effects.future_action_permission_created = true, /future_action_permission_created must be false/],
    ["general authority escalation", r => r.non_effects.general_authority_created = true, /general_authority_created must be false/],
    ["causality escalation", r => r.non_effects.causality_proven = true, /causality_proven must be false/],
    ["truth escalation", r => r.non_effects.truth_certified = true, /truth_certified must be false/],
    ["liability escalation", r => r.non_effects.liability_established = true, /liability_established must be false/],
    ["content hash mismatch", r => r.content_hash = "sha256:"+"f".repeat(64), /content hash mismatch/]
  ];

  for (const [name, mutate, pattern] of negatives) {
    const r = deepClone(fixture); mutate(r); if (name !== "content hash mismatch") rehash(r); expectFailure(name, r, bundle, pattern);
  }
  process.stdout.write(`Pre-Action Authorize Admission v0.1: PASS (${negatives.length} negative tests)\n`);
}

if (require.main === module) runConformance();

module.exports = {
  computeContentHash,
  runConformance,
  stableCanonicalize,
  validateAssessment,
};
