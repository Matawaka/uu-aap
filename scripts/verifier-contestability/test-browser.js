#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

if (process.argv.length !== 5) {
  throw new Error("usage: test-browser.js <interactive-app.js> <contestability-app.js> <input.json>");
}

require(path.resolve(process.argv[2]));
require(path.resolve(process.argv[3]));

if (!globalThis.UUAAPInteractive || !globalThis.UUAAPContestability) {
  throw new Error("browser verifier APIs were not installed");
}

const input = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const result = globalThis.UUAAPContestability.materializeContestabilityOverlay(input);
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
