#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const input = JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
require(path.resolve(process.argv[3]));
const result = globalThis.UUAAPAttestations.bridgeAttestations(input);
process.stdout.write(JSON.stringify(result));
