'use strict';

const fs = require('fs');
const path = require('path');
const Gate = require('./authority-gate.js');
const Binding = require('./receipt-binding.js');

const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'examples/synthetic-authority-wait.input.json'), 'utf8'));
const receipt = Gate.deriveReceipt(fixture);
if (!Binding.validateBinding(fixture, receipt)) throw new Error('exact binding did not pass');

const changed = JSON.parse(JSON.stringify(fixture));
changed.evaluated_at = '2026-08-28T23:31:00Z';
Gate.rehash(changed);
let rejected = false;
try { Binding.validateBinding(changed, receipt); } catch (_) { rejected = true; }
if (!rejected) throw new Error('changed source unexpectedly accepted against old receipt');

const changedActor = JSON.parse(JSON.stringify(fixture));
changedActor.effect_actor_subject.id = 'actor:synthetic-other-reviewer';
Gate.rehash(changedActor);
rejected = false;
try { Binding.validateBinding(changedActor, receipt); } catch (_) { rejected = true; }
if (!rejected) throw new Error('changed actor unexpectedly accepted against old receipt');

console.log('MarketCloser authority gate exact source binding: PASS');
