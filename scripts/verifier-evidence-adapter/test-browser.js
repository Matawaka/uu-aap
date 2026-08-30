#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const adapter = require("./app.js");

if (process.argv.length !== 4) {
  throw new Error("usage: test-browser.js <fixture.json> <output.json>");
}

const fixturePath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3]);
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const result = adapter.adaptEvidence(fixture);
adapter.validateResult(result);
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log("P1.4 browser adapter result: PASS");
