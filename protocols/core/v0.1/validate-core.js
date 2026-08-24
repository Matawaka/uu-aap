#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const FIXTURE_PATH = path.join(ROOT, "end-to-end.fixture.json");
const SCHEMA_PATH = path.join(ROOT, "receipt-envelope.schema.json");

const RECEIPT_TYPES = new Set([
  "StateReceipt",
  "AvailabilityClaim",
  "IntentReceipt",
  "AuthorityReceipt",
  "ResponsibilityReceipt",
  "CoordinationReceipt",
  "ActionPermit",
  "ActionReceipt",
  "OutcomeReceipt",
  "SuccessorStateReceipt",
]);

const REQUIRED_NON_EFFECTS = {
  StateReceipt: {
    intent_established: false,
    authority_established: false,
    action_performed: false,
    liability_established: false,
    truth_certified: false,
  },
  AvailabilityClaim: {
    intent_established: false,
    action_performed: false,
    liability_established: false,
    truth_certified: false,
  },
  IntentReceipt: {
    action_performed: false,
    authority_expanded: false,
    responsibility_accepted: false,
    liability_established: false,
  },
  AuthorityReceipt: {
    permissions_expanded: false,
    action_performed: false,
    responsibility_accepted: false,
    liability_established: false,
  },
  ResponsibilityReceipt: {
    authority_expanded: false,
    permissions_expanded: false,
    action_performed: false,
    liability_established: false,
  },
  CoordinationReceipt: {
    execution_authorized: false,
    action_performed: false,
    authority_expanded: false,
    liability_established: false,
  },
  ActionPermit: {
    action_performed: false,
    outcome_observed: false,
    authority_expanded: false,
    liability_established: false,
  },
  ActionReceipt: {
    outcome_observed: false,
    truth_certified: false,
    liability_established: false,
  },
  OutcomeReceipt: {
    causality_proven: false,
    universal_canonicality_established: false,
    truth_certified: false,
    liability_established: false,
  },
  SuccessorStateReceipt: {
    intent_established: false,
    authority_expanded: false,
    liability_established: false,
    truth_certified: false,
  },
};

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableCanonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableCanonicalize).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableCanonicalize(value[key])}`).join(",")}}`;
  }
  fail(`unsupported canonical JSON value type: ${typeof value}`);
}

function identityProjection(receipt) {
  const projection = {};
  for (const [key, value] of Object.entries(receipt)) {
    if (key === "content_hash" || key === "signature_profile") continue;
    projection[key] = value;
  }
  return projection;
}

function computeContentHash(receipt) {
  const bytes = Buffer.from(stableCanonicalize(identityProjection(receipt)), "utf8");
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function checkDate(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    fail(`${label} must be an ISO-8601 parseable timestamp`);
  }
}

function checkEnvelope(receipt, index) {
  const label = `receipts[${index}]`;
  if (!isPlainObject(receipt)) fail(`${label} must be an object`);
  const expectedKeys = [
    "protocol",
    "version",
    "receipt_type",
    "subject",
    "frontier",
    "predecessor_receipt_hashes",
    "assertions",
    "non_effects",
    "issuer",
    "issued_at",
    "payload",
    "signature_profile",
    "content_hash",
  ];
  for (const key of expectedKeys) {
    if (!(key in receipt)) fail(`${label} missing required field ${key}`);
  }
  if (receipt.protocol !== "UU-AAP Core") fail(`${label} protocol mismatch`);
  if (receipt.version !== "0.1") fail(`${label} version mismatch`);
  if (!RECEIPT_TYPES.has(receipt.receipt_type)) fail(`${label} unknown receipt_type ${receipt.receipt_type}`);

  if (!isPlainObject(receipt.subject) || typeof receipt.subject.id !== "string" || !receipt.subject.id) {
    fail(`${label} subject.id required`);
  }
  if (typeof receipt.subject.scope !== "string" || !receipt.subject.scope) fail(`${label} subject.scope required`);

  if (!isPlainObject(receipt.frontier) || typeof receipt.frontier.revision !== "string" || !receipt.frontier.revision) {
    fail(`${label} frontier.revision required`);
  }
  checkDate(receipt.frontier.observed_at, `${label}.frontier.observed_at`);
  checkDate(receipt.issued_at, `${label}.issued_at`);

  if (!Array.isArray(receipt.predecessor_receipt_hashes)) fail(`${label} predecessor_receipt_hashes must be an array`);
  if (new Set(receipt.predecessor_receipt_hashes).size !== receipt.predecessor_receipt_hashes.length) {
    fail(`${label} duplicate predecessor receipt hash`);
  }
  for (const hash of receipt.predecessor_receipt_hashes) {
    if (typeof hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
      fail(`${label} malformed predecessor hash`);
    }
  }

  if (!isPlainObject(receipt.assertions) || Object.keys(receipt.assertions).length === 0) {
    fail(`${label} assertions must be a non-empty object`);
  }
  if (!isPlainObject(receipt.non_effects) || Object.keys(receipt.non_effects).length === 0) {
    fail(`${label} non_effects must be a non-empty object`);
  }
  if (!isPlainObject(receipt.issuer) || typeof receipt.issuer.id !== "string" || !receipt.issuer.id) {
    fail(`${label} issuer.id required`);
  }
  if (typeof receipt.issuer.assurance !== "string" || !receipt.issuer.assurance) fail(`${label} issuer.assurance required`);
  if (!isPlainObject(receipt.payload)) fail(`${label} payload must be an object`);
  if (!isPlainObject(receipt.signature_profile) || typeof receipt.signature_profile.mode !== "string") {
    fail(`${label} signature_profile.mode required`);
  }
  if (typeof receipt.content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(receipt.content_hash)) {
    fail(`${label} malformed content_hash`);
  }

  const expectedHash = computeContentHash(receipt);
  if (receipt.content_hash !== expectedHash) {
    fail(`${label} content hash mismatch: expected ${expectedHash}, got ${receipt.content_hash}`);
  }

  const required = REQUIRED_NON_EFFECTS[receipt.receipt_type];
  for (const [key, expectedValue] of Object.entries(required)) {
    if (!(key in receipt.non_effects)) fail(`${label} missing required non_effect ${key}`);
    if (receipt.non_effects[key] !== expectedValue) {
      fail(`${label} non_effect ${key} must be exactly ${expectedValue}`);
    }
  }
}

function subjectKey(receipt) {
  return `${receipt.subject.id}\u0000${receipt.subject.scope}`;
}

function requireTypes(receipt, predecessors, requiredGroups) {
  const types = new Set(predecessors.map((r) => r.receipt_type));
  for (const group of requiredGroups) {
    if (!group.some((type) => types.has(type))) {
      fail(`${receipt.receipt_type} missing required predecessor type: one of ${group.join(", ")}`);
    }
  }
}

function validateChain(fixture) {
  if (!isPlainObject(fixture)) fail("fixture must be an object");
  if (fixture.fixture_id !== "uu-aap-core-v0.1-e2e-success") fail("unexpected fixture_id");
  if (!Array.isArray(fixture.receipts) || fixture.receipts.length === 0) fail("fixture receipts required");

  const byHash = new Map();
  const receipts = fixture.receipts;

  receipts.forEach((receipt, index) => {
    checkEnvelope(receipt, index);
    if (byHash.has(receipt.content_hash)) fail(`duplicate receipt content_hash ${receipt.content_hash}`);

    const predecessors = receipt.predecessor_receipt_hashes.map((hash) => {
      const predecessor = byHash.get(hash);
      if (!predecessor) fail(`${receipt.receipt_type} references unknown or forward predecessor ${hash}`);
      return predecessor;
    });

    for (const predecessor of predecessors) {
      if (subjectKey(predecessor) !== subjectKey(receipt)) {
        fail(`${receipt.receipt_type} subject mismatch with predecessor ${predecessor.receipt_type}`);
      }
    }

    switch (receipt.receipt_type) {
      case "StateReceipt":
        if (predecessors.length !== 0) fail("StateReceipt must not have predecessors");
        if (receipt.assertions.state_anchored !== true) fail("StateReceipt must assert state_anchored=true");
        break;

      case "AvailabilityClaim":
        requireTypes(receipt, predecessors, [["StateReceipt"]]);
        if (receipt.assertions.availability_qualified !== true) fail("AvailabilityClaim must assert availability_qualified=true");
        if (predecessors.some((p) => p.frontier.revision !== receipt.frontier.revision)) {
          fail("AvailabilityClaim frontier mismatch");
        }
        break;

      case "IntentReceipt":
        requireTypes(receipt, predecessors, [["StateReceipt"]]);
        if (receipt.assertions.intent_declared !== true) fail("IntentReceipt must assert intent_declared=true");
        if (predecessors.some((p) => p.frontier.revision !== receipt.frontier.revision)) {
          fail("IntentReceipt frontier mismatch");
        }
        break;

      case "AuthorityReceipt":
      case "ResponsibilityReceipt":
        requireTypes(receipt, predecessors, [["IntentReceipt"]]);
        if (receipt.receipt_type === "AuthorityReceipt" && receipt.assertions.authority_bound !== true) {
          fail("AuthorityReceipt must assert authority_bound=true");
        }
        if (predecessors.some((p) => p.frontier.revision !== receipt.frontier.revision)) {
          fail(`${receipt.receipt_type} frontier mismatch`);
        }
        break;

      case "CoordinationReceipt":
        requireTypes(receipt, predecessors, [
          ["AvailabilityClaim"],
          ["IntentReceipt"],
          ["AuthorityReceipt", "ResponsibilityReceipt"],
        ]);
        if (receipt.assertions.coordination_established !== true) fail("CoordinationReceipt must assert coordination_established=true");
        if (predecessors.some((p) => p.frontier.revision !== receipt.frontier.revision)) {
          fail("CoordinationReceipt predecessor frontier mismatch");
        }
        break;

      case "ActionPermit": {
        requireTypes(receipt, predecessors, [
          ["StateReceipt"],
          ["IntentReceipt"],
          ["AuthorityReceipt", "ResponsibilityReceipt"],
          ["CoordinationReceipt"],
        ]);
        if (receipt.assertions.action_permitted !== true) fail("ActionPermit must assert action_permitted=true");
        const frontierSet = new Set(predecessors.map((p) => p.frontier.revision));
        frontierSet.add(receipt.frontier.revision);
        if (frontierSet.size !== 1) fail("ActionPermit prerequisite frontier mismatch");
        break;
      }

      case "ActionReceipt":
        requireTypes(receipt, predecessors, [["ActionPermit"]]);
        if (receipt.assertions.action_performed !== true) fail("ActionReceipt must assert action_performed=true");
        if (predecessors.length !== 1 || predecessors[0].frontier.revision !== receipt.frontier.revision) {
          fail("ActionReceipt must bind exactly one permit at the same predecessor frontier");
        }
        break;

      case "OutcomeReceipt":
        requireTypes(receipt, predecessors, [["ActionReceipt"]]);
        if (receipt.assertions.outcome_observed !== true) fail("OutcomeReceipt must assert outcome_observed=true");
        if (typeof receipt.assertions.successor_revision_observed !== "string") {
          fail("OutcomeReceipt must declare successor_revision_observed");
        }
        if (receipt.assertions.successor_revision_observed !== receipt.frontier.revision) {
          fail("OutcomeReceipt successor frontier mismatch");
        }
        break;

      case "SuccessorStateReceipt":
        requireTypes(receipt, predecessors, [["OutcomeReceipt"]]);
        if (receipt.assertions.state_anchored !== true) fail("SuccessorStateReceipt must assert state_anchored=true");
        if (predecessors.length !== 1 || predecessors[0].frontier.revision !== receipt.frontier.revision) {
          fail("SuccessorStateReceipt must match exact OutcomeReceipt successor frontier");
        }
        break;

      default:
        fail(`unhandled receipt_type ${receipt.receipt_type}`);
    }

    byHash.set(receipt.content_hash, receipt);
  });

  const finalReceipt = receipts[receipts.length - 1];
  if (finalReceipt.receipt_type !== "SuccessorStateReceipt") fail("fixture must end with SuccessorStateReceipt");
  return true;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rehash(receipt) {
  receipt.content_hash = computeContentHash(receipt);
}

function expectFailure(name, fixture, pattern) {
  let failed = false;
  try {
    validateChain(fixture);
  } catch (error) {
    failed = true;
    if (!pattern.test(String(error.message))) {
      fail(`${name} failed for unexpected reason: ${error.message}`);
    }
  }
  if (!failed) fail(`${name} unexpectedly passed`);
  process.stdout.write(`PASS negative: ${name}\n`);
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
if (schema.title !== "UU-AAP Core v0.1 Receipt Envelope") fail("receipt schema title mismatch");

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
validateChain(fixture);
process.stdout.write(`PASS positive: ${fixture.fixture_id}\n`);

{
  const mutated = deepClone(fixture);
  const receipt = mutated.receipts.find((r) => r.receipt_type === "IntentReceipt");
  delete receipt.non_effects.action_performed;
  rehash(receipt);
  expectFailure("missing intent non-effect", mutated, /missing required non_effect action_performed/);
}

{
  const mutated = deepClone(fixture);
  const receipt = mutated.receipts.find((r) => r.receipt_type === "AuthorityReceipt");
  receipt.non_effects.permissions_expanded = true;
  rehash(receipt);
  expectFailure("implicit permission expansion", mutated, /permissions_expanded must be exactly false/);
}

{
  const mutated = deepClone(fixture);
  const permit = mutated.receipts.find((r) => r.receipt_type === "ActionPermit");
  const coordinationHash = mutated.receipts.find((r) => r.receipt_type === "CoordinationReceipt").content_hash;
  permit.predecessor_receipt_hashes = permit.predecessor_receipt_hashes.filter((hash) => hash !== coordinationHash);
  rehash(permit);
  expectFailure("missing coordination at action gate", mutated, /missing required predecessor type: one of CoordinationReceipt/);
}

{
  const mutated = deepClone(fixture);
  const permit = mutated.receipts.find((r) => r.receipt_type === "ActionPermit");
  permit.frontier.revision = "git:example/mismatched@cccccccccccccccccccccccccccccccccccccccc";
  rehash(permit);
  expectFailure("action gate frontier mismatch", mutated, /ActionPermit prerequisite frontier mismatch/);
}

process.stdout.write("UU-AAP Core v0.1 conformance validation PASS\n");
