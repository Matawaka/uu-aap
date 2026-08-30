'use strict';

const {isDeepStrictEqual}=require('node:util');
const {contestedCueReceipt}=require('../dlc-si-attention-contention/adapter.js');

const NEED_TO_SIGNAL=Object.freeze({
  NO_CUE_NEEDED:'NONE',
  NOTICE_ONLY:'PERIPHERAL',
  FOCUS_REQUESTED:'FOCUSED_NUDGE',
  HINT_EXPLICITLY_REQUESTED:'EXPLICIT_HINT'
});
const SIGNALS=new Set(Object.values(NEED_TO_SIGNAL));
const FORBIDDEN_OPTIMIZATION_FLAGS=[
  'engagement_optimization',
  'retention_optimization',
  'dependency_optimization',
  'predicted_interest_override',
  'mood_inference',
  'personality_inference',
  'psychological_inference',
  'durable_profile'
];
const FORBIDDEN_SCALAR_KEYS=['interest_score','engagement_score','retention_score','dependency_score'];

function requireExactSource(contentionInput, sourceReceipt){
  if(!contentionInput||typeof contentionInput!=='object') throw new Error('contention_input required');
  if(!sourceReceipt||typeof sourceReceipt!=='object') throw new Error('source_receipt required');
  const derived=contestedCueReceipt(contentionInput);
  if(!isDeepStrictEqual(derived,sourceReceipt)) throw new Error('source receipt must exactly re-derive from contention input');
  if(sourceReceipt.type!=='KONTURContestedCueReceipt') throw new Error('wrong source receipt type');
  for(const k of ['correct_answer','instruction','normative_winner','selection_erases_legitimacy','external_effect_authority_created','action_permit_created']){
    if(sourceReceipt[k]!==false) throw new Error(`unsafe source boundary: ${k}`);
  }
  if(sourceReceipt.contest_visible!==true) throw new Error('contention must remain visible');
  return derived;
}

function validateOptimizationBoundary(input){
  const optimization=input.optimization||{};
  if(typeof optimization!=='object'||Array.isArray(optimization)) throw new Error('optimization must be an object when supplied');
  for(const k of FORBIDDEN_OPTIMIZATION_FLAGS) if(optimization[k]===true) throw new Error(`${k} forbidden`);
  for(const k of FORBIDDEN_SCALAR_KEYS) if(Object.prototype.hasOwnProperty.call(optimization,k)) throw new Error(`${k} forbidden`);
}

function buildNonBindingAttentionReceipt(input){
  if(!input||typeof input!=='object') throw new Error('input required');
  const source=requireExactSource(input.contention_input,input.source_receipt);
  if(!Object.prototype.hasOwnProperty.call(NEED_TO_SIGNAL,input.attention_need)) throw new Error('unknown attention_need');
  if(input.solution_disclosure_requested===true) throw new Error('solution disclosure is outside non-binding attention');
  validateOptimizationBoundary(input);

  if(input.attention_need==='HINT_EXPLICITLY_REQUESTED'&&input.explicit_help_request!==true){
    throw new Error('explicit hint requires explicit help request evidence');
  }

  let chosenSignal=NEED_TO_SIGNAL[input.attention_need];
  let emittedCueId=null;
  let state='NO_SIGNAL_REQUIRED';

  const sourceDeferred=source.status==='DEFERRED'||source.selected_cue_id===null;
  if(sourceDeferred){
    chosenSignal='NONE';
    if(input.cue_id!==null&&input.cue_id!==undefined) throw new Error('deferred contention cannot emit a cue');
    state='DEFERRED_NO_CUE';
  } else {
    if(input.cue_id!==source.selected_cue_id) throw new Error('cue_id must equal DLC-SI selected cue');
    if(chosenSignal!=='NONE'){
      emittedCueId=input.cue_id;
      state='BOUNDED_SIGNAL_CANDIDATE';
    }
  }

  if(input.signal_override!==undefined){
    if(!SIGNALS.has(input.signal_override)) throw new Error('unknown signal_override');
    if(input.signal_override!==chosenSignal) throw new Error('signal energy override forbidden');
  }

  return {
    type:'KONTURNonBindingAttentionReceipt',
    version:'0.1',
    source_contention_id:source.contention_id,
    source_dlc_si_fingerprint:source.dlc_si_fingerprint,
    source_status:source.status,
    source_selected_cue_id:source.selected_cue_id,
    emitted_cue_id:emittedCueId,
    preserved_cue_ids:[...source.preserved_cue_ids],
    attention_need:input.attention_need,
    signal_class:chosenSignal,
    state,
    contest_visible:true,
    signal_is_minimal_for_need:true,
    hint_energy_scalar_used:false,
    attention_binds_intent:false,
    instruction:false,
    correct_answer:false,
    solution_disclosed:false,
    normative_winner:false,
    selection_erases_legitimacy:false,
    engagement_objective_created:false,
    retention_objective_created:false,
    dependency_objective_created:false,
    inferred_player_trait_created:false,
    durable_profile_created:false,
    response_authority_created:false,
    action_permit_created:false,
    live_cursor_mutation_authorized:false,
    game_control_authorized:false,
    external_effect_authority_created:false,
    stable_core_promotion:false,
    next_safe_action:chosenSignal==='NONE'?'OBSERVE_OR_WAIT_WITHOUT_CUE':'RENDER_ONLY_IF_SEPARATELY_AUTHORIZED'
  };
}

module.exports={buildNonBindingAttentionReceipt,NEED_TO_SIGNAL};
