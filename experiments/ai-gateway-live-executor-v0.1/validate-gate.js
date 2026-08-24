const fs=require('fs');
const path=require('path');
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'gate.fixture.json'),'utf8'));
function fail(m){throw new Error(m)}
if(f.protocol!=='UU-AAP-AI-GATEWAY-LIVE-EXECUTOR-GATE'||f.version!=='0.1')fail('profile mismatch');
if(f.evidence.gateway_decision!=='admissible')fail('decision not admissible');
if(f.controls.credential_material_present)fail('credentials prohibited');
if(f.controls.network_call_performed||f.controls.github_mutation_performed)fail('preparation must have no external effect');
if(f.controls.ci_execution && f.controls.live_execution_requested)fail('CI must never arm live execution');
const armable = f.controls.live_execution_requested===true && f.controls.ci_execution===false;
if(armable) fail('canonical CI fixture must remain disarmed');
console.log('UU_AAP_AI_GATEWAY_LIVE_EXECUTOR_GATE_V0_1_PASS');
