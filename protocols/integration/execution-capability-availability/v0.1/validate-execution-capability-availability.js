#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  validate: validateSelection,
} = require("../../capability-selection/v0.1/validate-capability-selection.js");

const ROOT = __dirname;
const FIXTURE = path.join(ROOT, "conformance.fixture.json");
const SCHEMA = path.join(ROOT, "execution-capability-availability.schema.json");
const CORE_SCHEMA = path.resolve(ROOT, "../../../core/v0.1/receipt-envelope.schema.json");
const SELECTION = path.resolve(ROOT, "../../capability-selection/v0.1/conformance.fixture.json");

function fail(m) { throw new Error(m); }
function obj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

function canon(v) {
  if (v === null || ["boolean", "number", "string"].includes(typeof v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (obj(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  fail(`unsupported canonical JSON value type: ${typeof v}`);
}

function hash(v, core = false) {
  const p = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === "content_hash" || (core && k === "signature_profile")) continue;
    p[k] = x;
  }
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(canon(p), "utf8")).digest("hex")}`;
}

function t(v, l) {
  const n = Date.parse(v);
  if (!Number.isFinite(n)) fail(`${l} must be timestamp`);
  return n;
}

function falses(v, keys, l) {
  if (!obj(v)) fail(`${l} must be object`);
  for (const k of keys) if (v[k] !== false) fail(`${l}.${k} must be exactly false`);
}

function sameRef(a, b) {
  return obj(a) && obj(b) && a.descriptor_id === b.descriptor_id && a.content_hash === b.content_hash;
}

const OBS_FALSE = [
  "intent_established", "authority_granted", "approval_created", "action_permit_created",
  "action_performed", "future_availability_guaranteed", "outcome_success_guaranteed",
  "truth_certified", "liability_established",
];

const TOP_FALSE = [
  "intent_established", "authority_granted", "approval_created", "action_permit_created",
  "action_authorized", "action_performed", "future_availability_guaranteed",
  "outcome_success_guaranteed", "causality_proven", "truth_certified",
  "liability_established", "future_action_permission_created",
];

function defaultSelection() {
  return JSON.parse(fs.readFileSync(SELECTION, "utf8"));
}

function checkedSelection(selectionRecord) {
  const selection = selectionRecord === undefined || selectionRecord === null
    ? defaultSelection()
    : selectionRecord;
  const errors = validateSelection(selection);
  if (errors.length) fail(`capability selection invalid: ${errors.join(", ")}`);
  return selection;
}

function stateOK(s, o) {
  if (!obj(s) || s.protocol !== "UU-AAP Core" || s.version !== "0.1" || s.receipt_type !== "StateReceipt") {
    fail("core_state_receipt must be Core v0.1 StateReceipt");
  }
  if (s.subject.id !== o.subject.capability_id) fail("StateReceipt subject capability mismatch");
  if (s.subject.scope !== `operation:${o.subject.operation}`) fail("StateReceipt subject scope mismatch");
  if (s.frontier.revision !== o.frontier.revision) fail("StateReceipt frontier mismatch");
  if (!Array.isArray(s.predecessor_receipt_hashes) || s.predecessor_receipt_hashes.length) fail("StateReceipt must not have predecessors");
  if (s.assertions.state_anchored !== true) fail("StateReceipt must assert state_anchored=true");
  falses(
    s.non_effects,
    ["intent_established", "authority_established", "action_performed", "liability_established", "truth_certified"],
    "StateReceipt.non_effects"
  );
  if (t(s.frontier.observed_at, "StateReceipt.observed_at") > t(o.frontier.observed_at, "observation.observed_at")) {
    fail("StateReceipt cannot observe after availability observation");
  }
  const h = hash(s, true);
  if (s.content_hash !== h) fail(`StateReceipt content hash mismatch: expected ${h}`);
}

function claimOK(c, s, r, o) {
  if (!obj(c) || c.protocol !== "UU-AAP Core" || c.version !== "0.1" || c.receipt_type !== "AvailabilityClaim") {
    fail("core_availability_claim must be Core v0.1 AvailabilityClaim");
  }
  if (c.subject.id !== o.subject.capability_id) fail("AvailabilityClaim subject capability mismatch");
  if (c.subject.scope !== `operation:${o.subject.operation}`) fail("AvailabilityClaim subject scope mismatch");
  if (c.frontier.revision !== s.frontier.revision || c.frontier.revision !== o.frontier.revision) fail("AvailabilityClaim frontier mismatch");
  if (
    !Array.isArray(c.predecessor_receipt_hashes) ||
    c.predecessor_receipt_hashes.length !== 1 ||
    c.predecessor_receipt_hashes[0] !== s.content_hash
  ) fail("AvailabilityClaim must bind exactly the Core StateReceipt predecessor");
  if (c.assertions.availability_qualified !== true) fail("AvailabilityClaim must assert availability_qualified=true");
  falses(c.non_effects, ["intent_established", "action_performed", "liability_established", "truth_certified"], "AvailabilityClaim.non_effects");
  const observed = t(o.frontier.observed_at, "observation.observed_at");
  const issued = t(c.issued_at, "AvailabilityClaim.issued_at");
  const until = t(o.valid_until, "observation.valid_until");
  if (issued < observed) fail("AvailabilityClaim cannot be issued before availability observation");
  if (issued > until) fail("AvailabilityClaim issued after availability observation expired");
  const p = c.payload;
  if (!obj(p) || p.status !== "available") fail("positive AvailabilityClaim payload.status must be available");
  if (p.availability_observation_hash !== o.content_hash) fail("AvailabilityClaim observation hash mismatch");
  if (p.selection_record_hash !== r.selection_binding.selection_content_hash) fail("AvailabilityClaim selection hash mismatch");
  if (p.descriptor_content_hash !== r.selection_binding.selected_descriptor_ref.content_hash) fail("AvailabilityClaim descriptor hash mismatch");
  if (p.valid_until !== o.valid_until) fail("AvailabilityClaim freshness boundary mismatch");
  const h = hash(c, true);
  if (c.content_hash !== h) fail(`AvailabilityClaim content hash mismatch: expected ${h}`);
}

function validate(r, selectionRecord) {
  if (
    !obj(r) ||
    r.protocol !== "UU-AAP-EXECUTION-CAPABILITY-AVAILABILITY" ||
    r.version !== "0.1" ||
    r.artifact_type !== "ExecutionCapabilityAvailabilityBindingRecord"
  ) fail("record identity mismatch");

  const sf = checkedSelection(selectionRecord);
  const b = r.selection_binding;
  if (b.selection_id !== sf.selection_id) fail("selection_id mismatch");
  if (b.selection_content_hash !== sf.content_hash) fail("selection content hash mismatch");
  if (sf.result.status !== "selected") fail("selection must be selected");
  if (b.selected_capability_id !== sf.result.selected_capability_id) fail("selected capability substitution");
  if (!sameRef(b.selected_descriptor_ref, sf.result.selected_descriptor_ref)) fail("selected descriptor substitution");
  if (b.operation !== sf.request.operation) fail("selected operation substitution");
  if (b.fresh_availability_still_required !== true) fail("selection must still require fresh availability");

  const o = r.observation;
  if (!obj(o) || o.observation_type !== "ExecutionCapabilityAvailabilityObservation") fail("availability observation required");
  if (o.subject.capability_id !== b.selected_capability_id) fail("observation capability substitution");
  if (!sameRef(o.subject.descriptor_ref, b.selected_descriptor_ref)) fail("observation descriptor substitution");
  if (o.subject.operation !== b.operation) fail("observation operation substitution");

  const started = t(o.probe.started_at, "probe.started_at");
  const completed = t(o.probe.completed_at, "probe.completed_at");
  const observed = t(o.frontier.observed_at, "observation.observed_at");
  const until = t(o.valid_until, "observation.valid_until");
  if (started > completed) fail("probe started after completion");
  if (completed !== observed) fail("probe completion must equal observation time");
  if (until <= observed) fail("availability freshness window must end after observation");

  const req = o.probe.required_check_ids;
  const checks = o.probe.checks;
  if (!Array.isArray(req) || !req.length) fail("required availability checks missing");
  if (new Set(req).size !== req.length) fail("duplicate required check id");
  if (!Array.isArray(checks) || !checks.length) fail("availability checks missing");
  const by = new Map();
  for (const c of checks) {
    if (by.has(c.check_id)) fail("duplicate availability check");
    by.set(c.check_id, c);
  }
  if (by.size !== req.length || req.some(id => !by.has(id))) fail("availability checks do not exactly cover required check ids");
  const ss = req.map(id => by.get(id).status);

  if (o.status === "available") {
    if (!ss.every(x => x === "pass")) fail("available requires every required check to pass");
    if (o.assertions.required_checks_satisfied !== true) fail("available must assert required_checks_satisfied=true");
  } else if (o.status === "unavailable") {
    if (!ss.some(x => x === "fail")) fail("unavailable requires at least one failed required check");
    if (o.assertions.required_checks_satisfied !== false) fail("unavailable cannot assert all checks satisfied");
  } else if (o.status === "unknown") {
    if (!ss.some(x => x === "unknown")) fail("unknown requires at least one unknown required check");
    if (o.assertions.required_checks_satisfied !== false) fail("unknown cannot assert all checks satisfied");
  } else {
    fail("unknown availability status");
  }

  falses(o.non_effects, OBS_FALSE, "observation.non_effects");
  const oh = hash(o);
  if (o.content_hash !== oh) fail(`observation content hash mismatch: expected ${oh}`);

  stateOK(r.core_state_receipt, o);
  if (o.status === "available") {
    if (r.assertions.core_availability_claim_materialized !== true) fail("available must assert Core AvailabilityClaim materialized");
    if (r.assertions.observation_fresh_for_claim !== true) fail("available must assert observation fresh for claim");
    claimOK(r.core_availability_claim, r.core_state_receipt, r, o);
  } else {
    if (r.core_availability_claim !== null) fail("non-available observation must not materialize positive Core AvailabilityClaim");
    if (r.assertions.core_availability_claim_materialized !== false) fail("non-available must assert Core AvailabilityClaim not materialized");
    if (r.assertions.observation_fresh_for_claim !== false) fail("non-available cannot assert positive observation freshness for claim");
  }

  if (
    r.assertions.selection_binding_verified !== true ||
    r.assertions.state_frontier_preserved !== true ||
    r.assertions.positive_availability_only_if_all_required_checks_pass !== true
  ) fail("binding assertions incomplete");

  falses(r.non_effects, TOP_FALSE, "record.non_effects");
  const rh = hash(r);
  if (r.content_hash !== rh) fail(`record content hash mismatch: expected ${rh}`);
  return true;
}

function rehash(r) {
  r.observation.content_hash = hash(r.observation);
  r.core_state_receipt.content_hash = hash(r.core_state_receipt, true);
  if (r.core_availability_claim) {
    if (r.core_availability_claim.predecessor_receipt_hashes.length === 1) {
      r.core_availability_claim.predecessor_receipt_hashes[0] = r.core_state_receipt.content_hash;
    }
    if (obj(r.core_availability_claim.payload)) {
      r.core_availability_claim.payload.availability_observation_hash = r.observation.content_hash;
    }
    r.core_availability_claim.content_hash = hash(r.core_availability_claim, true);
  }
  r.content_hash = hash(r);
}

function runConformance() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
  if (schema.title !== "UU-AAP Execution Capability Availability Binding v0.1") fail("schema title mismatch");

  const cs = JSON.parse(fs.readFileSync(CORE_SCHEMA, "utf8"));
  if (
    cs.title !== "UU-AAP Core v0.1 Receipt Envelope" ||
    !cs.properties.receipt_type.enum.includes("AvailabilityClaim")
  ) fail("Core AvailabilityClaim contract missing");

  const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  validate(fixture);
  process.stdout.write(`PASS positive: ${fixture.binding_id}\n`);

  function neg(name, fn, re, raw = false) {
    const v = clone(fixture);
    fn(v);
    if (!raw) rehash(v);
    try {
      validate(v);
    } catch (e) {
      if (!re.test(String(e.message))) fail(`${name} wrong failure: ${e.message}`);
      process.stdout.write(`PASS negative: ${name}\n`);
      return;
    }
    fail(`${name} unexpectedly passed`);
  }

  const Z = n => `sha256:${n.repeat(64)}`;

  [
    ["selection hash substitution", v => v.selection_binding.selection_content_hash = Z("0"), /selection content hash mismatch/],
    ["selected capability substitution", v => v.selection_binding.selected_capability_id = "urn:uu-aap:capability:alpha", /selected capability substitution/],
    ["selected descriptor substitution", v => v.selection_binding.selected_descriptor_ref.content_hash = Z("3"), /selected descriptor substitution/],
    ["selected operation substitution", v => v.selection_binding.operation = "delete", /selected operation substitution/],
    ["selection freshness removal", v => v.selection_binding.fresh_availability_still_required = false, /still require fresh availability/],
    ["observation capability substitution", v => v.observation.subject.capability_id = "urn:uu-aap:capability:alpha", /observation capability substitution/],
    ["observation descriptor substitution", v => v.observation.subject.descriptor_ref.descriptor_id = "urn:uu-aap:execution-capability:alpha-v0.1", /observation descriptor substitution/],
    ["observation operation substitution", v => v.observation.subject.operation = "inspect", /observation operation substitution/],
    ["probe time reversal", v => v.observation.probe.started_at = "2026-08-24T19:55:03Z", /probe started after completion/],
    ["probe observation time mismatch", v => v.observation.frontier.observed_at = "2026-08-24T19:55:03Z", /completion must equal observation time/],
    ["stale freshness window", v => v.observation.valid_until = "2026-08-24T19:55:02Z", /freshness window must end after observation/],
    ["missing required check", v => v.observation.probe.checks.pop(), /do not exactly cover/],
    ["duplicate check", v => v.observation.probe.checks[1].check_id = v.observation.probe.checks[0].check_id, /duplicate availability check/],
    ["available with failed check", v => v.observation.probe.checks[0].status = "fail", /every required check to pass/],
    ["unavailable positive upgrade", v => { v.observation.status = "unavailable"; v.observation.assertions.required_checks_satisfied = false; v.observation.probe.checks[0].status = "fail"; }, /must not materialize positive/],
    ["unknown positive upgrade", v => { v.observation.status = "unknown"; v.observation.assertions.required_checks_satisfied = false; v.observation.probe.checks[0].status = "unknown"; }, /must not materialize positive/],
    ["StateReceipt subject substitution", v => v.core_state_receipt.subject.id = "urn:uu-aap:capability:alpha", /StateReceipt subject capability mismatch/],
    ["StateReceipt frontier substitution", v => v.core_state_receipt.frontier.revision = "git:demo/predecessor@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", /StateReceipt frontier mismatch/],
    ["StateReceipt predecessor injection", v => v.core_state_receipt.predecessor_receipt_hashes = [Z("f")], /StateReceipt must not have predecessors/],
    ["Availability predecessor substitution", v => v.core_availability_claim.predecessor_receipt_hashes = [Z("e")], /bind exactly the Core StateReceipt predecessor/, true],
    ["Availability frontier substitution", v => v.core_availability_claim.frontier.revision = "git:demo/predecessor@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", /AvailabilityClaim frontier mismatch/],
    ["availability_qualified removed", v => v.core_availability_claim.assertions.availability_qualified = false, /availability_qualified=true/],
    ["claim issued before observation", v => v.core_availability_claim.issued_at = "2026-08-24T19:55:01Z", /issued before availability observation/],
    ["claim issued after expiry", v => v.core_availability_claim.issued_at = "2026-08-24T19:56:03Z", /issued after availability observation expired/],
    ["claim selection hash substitution", v => v.core_availability_claim.payload.selection_record_hash = Z("c"), /AvailabilityClaim selection hash mismatch/],
    ["claim descriptor hash substitution", v => v.core_availability_claim.payload.descriptor_content_hash = Z("b"), /AvailabilityClaim descriptor hash mismatch/],
    ["observation authority escalation", v => v.observation.non_effects.authority_granted = true, /observation\.non_effects\.authority_granted/],
    ["observation future guarantee", v => v.observation.non_effects.future_availability_guaranteed = true, /future_availability_guaranteed/],
    ["record intent escalation", v => v.non_effects.intent_established = true, /record\.non_effects\.intent_established/],
    ["record authority escalation", v => v.non_effects.authority_granted = true, /record\.non_effects\.authority_granted/],
    ["record permit creation", v => v.non_effects.action_permit_created = true, /action_permit_created/],
    ["record action authorization", v => v.non_effects.action_authorized = true, /action_authorized/],
    ["record action performed", v => v.non_effects.action_performed = true, /action_performed/],
    ["record future action permission", v => v.non_effects.future_action_permission_created = true, /future_action_permission_created/],
    ["observation hash mismatch", v => v.observation.content_hash = Z("a"), /observation content hash mismatch/, true],
    ["StateReceipt hash mismatch", v => v.core_state_receipt.content_hash = Z("9"), /StateReceipt content hash mismatch/, true],
    ["AvailabilityClaim hash mismatch", v => v.core_availability_claim.content_hash = Z("8"), /AvailabilityClaim content hash mismatch/, true],
    ["record hash mismatch", v => v.content_hash = Z("7"), /record content hash mismatch/, true],
  ].forEach(x => neg(...x));

  process.stdout.write("UU_AAP_EXECUTION_CAPABILITY_AVAILABILITY_V0_1_PASS\n");
}

module.exports = { validate, hash };

if (require.main === module) runConformance();
