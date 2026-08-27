"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const validatorPath = path.join(__dirname, "validate-execution-capability-descriptor.js");
const fixturePath = path.join(__dirname, "conformance.fixture.json");
const { validate, contentHash } = require("./validate-execution-capability-descriptor.js");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.strictEqual(validate(clone(fixture)), true, "exported descriptor validator must accept canonical fixture");

const tampered = clone(fixture);
tampered.capability.discovery_only = false;
tampered.content_hash = contentHash(tampered);
assert.throws(
  () => validate(tampered),
  /discovery-only/,
  "exported descriptor validator must reject semantic tampering"
);

const importRun = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(validatorPath)})`], { encoding: "utf8" });
assert.strictEqual(importRun.status, 0, importRun.stderr);
assert.strictEqual(importRun.stdout, "", "descriptor module import must not emit stdout");
assert.strictEqual(importRun.stderr, "", "descriptor module import must not emit stderr");

console.log("Execution Capability Descriptor v0.1 import-safe validator seam: PASS");
