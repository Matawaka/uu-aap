'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {evaluateWake, validateDormantCapability} = require('./event-responsive-dormancy.js');

const out = process.argv[2] || '/tmp/event-responsive-dormancy-v0.1';
fs.mkdirSync(out,{recursive:true});
const capability = {
  artifact_type:'EventResponsiveDormantCapability', version:'0.1',
  capability_id:'cap:example:1', context_ref:'ctx:1', scope_ref:'scope:review',
  wake_signal_kinds:['NEW_EVIDENCE','EXPLICIT_USER_REQUEST'], state:'DORMANT',
  checkpoint_refs:['checkpoint:42'], provenance_refs:['evidence:origin:42'],
  predecessor:{run_id:'run:old',epoch:7,lease_ref:'lease:expired',intent_ref:'intent:old',action_permit_ref:'permit:consumed'},
  polling_enabled:false, background_activity_authorized:false, active_process:false,
  authority_inherited:false, intent_inherited:false, action_permit_inherited:false, external_effect_authority:false
};
const signal = {
  artifact_type:'EventResponsiveWakeSignal', version:'0.1', signal_id:'sig:1', kind:'NEW_EVIDENCE',
  context_ref:'ctx:1', scope_ref:'scope:review', evidence_ref:'event:evidence:99', source_assurance:'EVIDENCE_BOUND'
};

function write(name,value){ fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n'); }
function reject(name, fn, pattern) {
  let err=null; try { fn(); } catch(e){ err=e; }
  assert.ok(err, `${name}: expected rejection`);
  if(pattern) assert.match(err.message,pattern,`${name}: unexpected error`);
}

validateDormantCapability(capability);
let r = evaluateWake({dormant_capability:capability,wake_signal:{...signal,kind:'UNRELATED'},checks:null});
assert.equal(r.state,'NO_WAKE_SIGNAL_MATCH');
assert.equal(r.wake_attention_created,false);

r = evaluateWake({dormant_capability:capability,wake_signal:signal,checks:null});
assert.equal(r.state,'WAKE_ATTENTION_ONLY');
assert.equal(r.next_admissible_interface,null);

r = evaluateWake({dormant_capability:capability,wake_signal:signal,checks:{current_evidence:false,current_authority:true,intent_corridor:true}});
assert.equal(r.state,'RETURN_TO_DORMANCY_EVIDENCE_STALE');

r = evaluateWake({dormant_capability:capability,wake_signal:signal,checks:{current_evidence:true,current_authority:false,intent_corridor:true}});
assert.equal(r.state,'RETURN_TO_DORMANCY_AUTHORITY_STALE');

r = evaluateWake({dormant_capability:capability,wake_signal:signal,checks:{current_evidence:true,current_authority:true,intent_corridor:false}});
assert.equal(r.state,'RETURN_TO_DORMANCY_INTENT_CLOSED');

r = evaluateWake({dormant_capability:capability,wake_signal:signal,checks:{current_evidence:true,current_authority:true,intent_corridor:true}});
assert.equal(r.state,'READY_FOR_SEPARATE_ACTION_ADMISSION');
assert.equal(r.next_admissible_interface,'PreActionEvidenceBundle');
assert.equal(r.automatic_transition,false);
assert.ok(Object.values(r.claims).every(v=>v===false));
assert.deepEqual(r.preserved.checkpoint_refs,capability.checkpoint_refs);
assert.deepEqual(r.preserved.provenance_refs,capability.provenance_refs);

write('dormant-capability.json', capability);
write('wake-signal.json', signal);
write('wake-receipt.json', r);

reject('polling',()=>evaluateWake({dormant_capability:{...capability,polling_enabled:true},wake_signal:signal,checks:null}),/polling_enabled/);
reject('background',()=>evaluateWake({dormant_capability:{...capability,background_activity_authorized:true},wake_signal:signal,checks:null}),/background_activity_authorized/);
reject('old authority',()=>evaluateWake({dormant_capability:{...capability,authority_inherited:true},wake_signal:signal,checks:null}),/authority_inherited/);
reject('old intent',()=>evaluateWake({dormant_capability:{...capability,intent_inherited:true},wake_signal:signal,checks:null}),/intent_inherited/);
reject('old permit',()=>evaluateWake({dormant_capability:{...capability,action_permit_inherited:true},wake_signal:signal,checks:null}),/action_permit_inherited/);
reject('external authority',()=>evaluateWake({dormant_capability:{...capability,external_effect_authority:true},wake_signal:signal,checks:null}),/external_effect_authority/);
reject('forged signal field',()=>evaluateWake({dormant_capability:capability,wake_signal:{...signal,action_permit_created:true},checks:null}),/unknown field/);
reject('hidden check',()=>evaluateWake({dormant_capability:capability,wake_signal:signal,checks:{current_evidence:true,current_authority:true,intent_corridor:true,auto_execute:true}}),/unknown field/);
reject('missing check',()=>evaluateWake({dormant_capability:capability,wake_signal:signal,checks:{current_evidence:true,current_authority:true}}),/boolean required/);

console.log('EVENT_RESPONSIVE_DORMANCY_V0_1_PASS');
