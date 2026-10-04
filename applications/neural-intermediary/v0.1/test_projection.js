// SPDX-License-Identifier: Apache-2.0
'use strict';
const assert = require('node:assert/strict');
const {project,graphFor} = require('./projection.js');
const RERC = require('../../../protocols/integration/rerc/v0.1/rerc.js');
const p = {tenant:'demo',compartment:'external',purpose:'review',subject:'supplier',claim:'risk',
           evaluation_time:'2026-10-03T12:00:00Z',max_age_seconds:3600};
const row = {tenant:'demo',compartment:'external',purpose:'review',subject:'supplier',claim:'risk',
             sensor_id:'a',value:'low',observed_at:'2026-10-03T11:50:00Z',note:'untrusted source note'};
let checked = 0;
function test(name, fn) { fn(); checked++; }
test('same sensor repetitions collapse reversibly', () => {
  const rows = Array.from({length:8},(_,i)=>({...row,id:'r'+i}));
  const result = project(p,rows);
  assert.equal(result.active_relation_count,1);
  assert.equal(result.source_relation_count,8);
  assert.equal(RERC.digest(RERC.restoreGraph(result.operational_graph,result.receipt)),RERC.digest(graphFor(p,rows).graph));
  assert.equal(result.operational_graph.nodes.length,9);
});
test('independent sensor support retained', () => {
  const result = project(p,[row,{...row,sensor_id:'b'}]);
  assert.equal(result.active_relation_count,2);
});
test('contradictions protected despite duplicate pressure', () => {
  const result = project(p,[row,row,{...row,value:'high'}]);
  assert.equal(result.active_relation_count,3);
});
test('unknowns protected', () => assert.equal(project(p,[{...row,value:'unknown'},{...row,value:'unknown'}]).active_relation_count,2));
test('stale observations protected', () => assert.equal(project(p,[{...row,observed_at:'2026-10-02T11:50:00Z'},{...row,observed_at:'2026-10-02T11:50:00Z'}]).active_relation_count,2));
test('future observations protected', () => assert.equal(project(p,[{...row,observed_at:'2026-10-04T11:50:00Z'},{...row,observed_at:'2026-10-04T11:50:00Z'}]).active_relation_count,2));
test('scope mismatch refused', () => assert.throws(()=>project(p,[{...row,tenant:'other'}])));
test('tampered graph refused', () => {
  const r=project(p,[row,row]); r.operational_graph.nodes[1].evidence_refs=['wrong'];
  assert.throws(()=>RERC.restoreGraph(r.operational_graph,r.receipt));
});
test('tampered receipt refused', () => {
  const r=project(p,[row,row]); r.receipt.suppressed_edges=[];
  assert.throws(()=>RERC.restoreGraph(r.operational_graph,r.receipt));
});
test('changed original payload changes identity', () => assert.notEqual(RERC.digest(graphFor(p,[row]).graph),RERC.digest(graphFor(p,[{...row,note:'different'}]).graph)));
test('input immutability', () => { const rows=[row,row]; const before=JSON.stringify(rows); project(p,rows); assert.equal(JSON.stringify(rows),before); });
console.log(JSON.stringify({status:'PROJECTION_TESTS_PASS',tests:checked,predecessor:'RERC v0.1 unchanged'}));
