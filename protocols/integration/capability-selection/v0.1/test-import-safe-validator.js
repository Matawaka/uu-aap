"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const validatorPath = path.join(__dirname, "validate-capability-selection.js");
const fixturePath = path.join(__dirname, "conformance.fixture.json");
const { validate, hashObject } = require("./validate-capability-selection.js");

function clone(value) { return JSON.parse(JSON.stringify(value)); }

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.deepStrictEqual(validate(clone(fixture)), [], "exported selection validator must accept canonical fixture");

const tampered = clone(fixture);
tampered.non_effects.authority_granted = true;
tampered.content_hash = hashObject(tampered, "content_hash");
const errors = validate(tampered);
assert(errors.some(message => /authority_granted/.test(message)), "exported selection validator must reject authority escalation");

const importRun = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(validatorPath)})`], { encoding: "utf8" });
assert.strictEqual(importRun.status, 0, importRun.stderr);
assert.strictEqual(importRun.stdout, "", "selection module import must not emit stdout");
assert.strictEqual(importRun.stderr, "", "selection module import must not emit stderr");

console.log("Capability Selection v0.1 import-safe validator seam: PASS");
