#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
if (process.argv.length !== 3) throw new Error("usage: test-browser.js <capsule-dir>");
const root = path.resolve(process.argv[2]);
globalThis.UUAAPEvidenceAdapter = require(path.join(root, "adapt.js"));
require(path.join(root, "attest.js"));
require(path.join(root, "candidates.js"));
require(path.join(root, "interactive.js"));
require(path.join(root, "disposition.js"));
const integrity = require(path.join(root, "integrity-core.js"));
const input = JSON.parse(fs.readFileSync(path.join(root, "example.json"), "utf8"));
const expected = JSON.parse(fs.readFileSync(path.join(root, "example-result.json"), "utf8"));
const actual = integrity.verifyDispositionIntegrity(input);
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("relocated capsule result diverged");
if (actual.canonical_rematerialization_equal !== true || actual.p1_3_materialized_input_valid !== true) throw new Error("bounded integrity receipt changed");
process.stdout.write(JSON.stringify(actual));
