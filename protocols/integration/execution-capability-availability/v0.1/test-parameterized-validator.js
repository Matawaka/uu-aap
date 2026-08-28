"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { validate, hash } = require("./validate-execution-capability-availability.js");
const {
  validate: validateSelection,
  hashObject: selectionHashObject,
} = require("../../capability-selection/v0.1/validate-capability-selection.js");

const ROOT = __dirname;
const availabilityFixturePath = path.join(ROOT, "conformance.fixture.json");
const selectionFixturePath = path.resolve(ROOT, "../../capability-selection/v0.1/conformance.fixture.json");
const clone = value => JSON.parse(JSON.stringify(value));
const load = file => JSON.parse(fs.readFileSync(file, "utf8"));

function rehashSelection(selection) {
  selection.content_hash = selectionHashObject(selection, "content_hash");
}

function rebindSelectionIdentity(record, selection) {
  record.selection_binding.selection_id = selection.selection_id;
  record.selection_binding.selection_content_hash = selection.content_hash;
  record.core_availability_claim.payload.selection_record_hash = selection.content_hash;
  record.core_availability_claim.content_hash = hash(record.core_availability_claim, true);
  record.content_hash = hash(record);
}

function testDefaultAndExplicitHistoricalSelectionEquivalent() {
  const record = load(availabilityFixturePath);
  const selection = load(selectionFixturePath);
  assert.strictEqual(validate(clone(record)), true);
  assert.strictEqual(validate(clone(record), clone(selection)), true);
}

function testDifferentValidSelectionIdentityCanBeBoundExplicitly() {
  const record = load(availabilityFixturePath);
  const selection = load(selectionFixturePath);
  selection.selection_id = `${selection.selection_id}:parameterized`;
  rehashSelection(selection);
  assert.deepStrictEqual(validateSelection(selection), []);
  rebindSelectionIdentity(record, selection);
  assert.strictEqual(validate(record, selection), true);
}

function testTamperedSuppliedSelectionFailsCanonicalValidation() {
  const record = load(availabilityFixturePath);
  const selection = load(selectionFixturePath);
  selection.non_effects.authority_granted = true;
  rehashSelection(selection);
  assert(validateSelection(selection).length > 0);
  assert.throws(
    () => validate(record, selection),
    /capability selection invalid:.*authority_granted/
  );
}

function testSelectionIdentityMismatchFailsClosed() {
  const record = load(availabilityFixturePath);
  const selection = load(selectionFixturePath);
  selection.selection_id = `${selection.selection_id}:other`;
  rehashSelection(selection);
  assert.deepStrictEqual(validateSelection(selection), []);
  assert.throws(() => validate(record, selection), /selection_id mismatch/);
}

function testSelectionContentHashMismatchFailsClosed() {
  const record = load(availabilityFixturePath);
  const selection = load(selectionFixturePath);
  selection.selection_id = `${selection.selection_id}:other`;
  rehashSelection(selection);
  record.selection_binding.selection_id = selection.selection_id;
  assert.throws(() => validate(record, selection), /selection content hash mismatch/);
}

function testImportIsSideEffectFree() {
  const script = path.join(ROOT, "validate-execution-capability-availability.js");
  const probe = spawnSync(
    process.execPath,
    ["-e", `require(${JSON.stringify(script)})`],
    { encoding: "utf8" }
  );
  assert.strictEqual(probe.status, 0, probe.stderr);
  assert.strictEqual(probe.stdout, "");
  assert.strictEqual(probe.stderr, "");
}

const tests = [
  testDefaultAndExplicitHistoricalSelectionEquivalent,
  testDifferentValidSelectionIdentityCanBeBoundExplicitly,
  testTamperedSuppliedSelectionFailsCanonicalValidation,
  testSelectionIdentityMismatchFailsClosed,
  testSelectionContentHashMismatchFailsClosed,
  testImportIsSideEffectFree,
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}
process.stdout.write(`PASS Execution Capability Availability parameterized import-safe seam (${tests.length} groups)\n`);
