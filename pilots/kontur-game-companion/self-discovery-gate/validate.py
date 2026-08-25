#!/usr/bin/env python3
import copy,json
from pathlib import Path
P=Path(__file__).resolve().parent
D=json.loads((P/'self-discovery-cases.json').read_text())
A=['COMMENT','NOTICE','QUESTION','THEORY','NUDGE','HINT','PARTIAL_SOLUTION','SOLUTION']
M=['WAIT','REFLECT_BACK','OBSERVATION_CUE','COMPARISON_CUE','PREDICTION_QUESTION','SMALL_REVERSIBLE_EXPERIMENT','HYPOTHESIS_INVITATION','CHECKPOINT_QUESTION']
Q=['ALLOW_PROMPT','ALLOW_WAIT','BYPASS_DISCOVERY','BLOCK_PROMPT']
O={'PLAYER_DISCOVERY','SEEK_LOCAL_EVIDENCE','RESPECT_EXPLICIT_INTENT'}
N=['live_response_generation','proactive_messaging','background_notification','autonomous_gameplay','game_account_control','external_effect_authorized','response_authority_created','action_permit_created','successor_permit_created','personality_inference','psychological_profile','behavioral_profile','mood_inference','attention_tracking','engagement_optimization','retention_optimization','total_history_required','cross_game_preference_profile','stable_core_promotion']
def f(x): raise AssertionError(x)
def exp(c):
 if not c['response_admissible'] or c['prompt_objective'] not in O:return 'BLOCK_PROMPT'
 if c['candidate_assistance_depth'] not in A or c['assistance_ceiling'] not in A:return 'BLOCK_PROMPT'
 if A.index(c['candidate_assistance_depth'])>A.index(c['assistance_ceiling']):return 'BLOCK_PROMPT'
 if c['answer_encoded_in_prompt'] or c['new_spoiler_level']>c['spoiler_budget'] or not c['player_focus_preserved']:return 'BLOCK_PROMPT'
 e=c['experiment']
 if e['requires_compliance'] or (e['proposed'] and (not e['reversible'] or e['cost'] not in {'NONE','LOW'})):return 'BLOCK_PROMPT'
 if c['player_intent']=='SOLUTION_REQUEST' and c['assistance_ceiling']=='SOLUTION':return 'BYPASS_DISCOVERY'
 if c['ignored_previous_prompt']:return 'ALLOW_WAIT' if c['move']=='WAIT' else 'BLOCK_PROMPT'
 return 'ALLOW_WAIT' if c['move']=='WAIT' else 'ALLOW_PROMPT'
def val(d):
 if d.get('artifact_type')!='KONTURGameCompanionSelfDiscoveryCases':f('artifact')
 if d.get('version')!='0.1':f('version')
 if d.get('origin_frontier')!='98cea5a8b521a2b2fd0715d24efd90c8b7e3b87b':f('frontier')
 if d.get('scope')!='SYNTHETIC_NON_EXECUTING':f('scope')
 if d.get('assistance_order')!=A or d.get('decision_outcomes')!=Q or d.get('discovery_moves')!=M:f('vocabulary')
 ne=d.get('non_effects',{})
 if list(ne)!=N or any(v is not False for v in ne.values()):f('non-effects')
 cs=d.get('cases')
 if not isinstance(cs,list) or len(cs)!=13 or len({c.get('id') for c in cs})!=13:f('cases')
 req={'id','response_admissible','player_intent','assistance_ceiling','candidate_assistance_depth','move','decision','answer_encoded_in_prompt','new_spoiler_level','spoiler_budget','player_focus_preserved','experiment','prompt_objective','ignored_previous_prompt','evidence_state'}
 for c in cs:
  if set(c)!=req or c['move'] not in M or c['decision'] not in Q:f('shape')
  if c['player_intent'] not in {'CONVERSATION','HINT_REQUEST','PARTIAL_SOLUTION_REQUEST','SOLUTION_REQUEST'}:f('intent')
  e=c['experiment']
  if set(e)!={'proposed','reversible','cost','requires_compliance'} or e['cost'] not in {'NONE','LOW','SCARCE_RESOURCE','IRREVERSIBLE_LOSS'}:f('experiment')
  if c['decision']!=exp(c):f(c['id']+' decision')
  if c['decision']=='ALLOW_PROMPT' and c['move']=='WAIT':f('prompt/wait')
  if c['decision']=='BYPASS_DISCOVERY' and not(c['player_intent']=='SOLUTION_REQUEST' and c['assistance_ceiling']=='SOLUTION'):f('bypass')
 by={c['id']:c for c in cs}
 if by['disguised_answer_blocked']['decision']!='BLOCK_PROMPT':f('leading')
 if by['explicit_solution_bypass']['decision']!='BYPASS_DISCOVERY':f('forced pedagogy')
 if by['ignored_prompt_wait']['decision']!='ALLOW_WAIT':f('ignored')
 if by['blocked_receipt_stays_blocked']['decision']!='BLOCK_PROMPT':f('revival')
 if by['contested_correction_evidence_prompt']['evidence_state']!='CONTESTED':f('contest')
val(D)
def mut(fn):
 x=copy.deepcopy(D);fn(x)
 try:val(x)
 except Exception:return True
 return False
ms=[
 lambda x:x.__setitem__('artifact_type','Bad'),lambda x:x.__setitem__('version','0.2'),lambda x:x.__setitem__('origin_frontier','deadbeef'),lambda x:x.__setitem__('scope','LIVE'),lambda x:x.__setitem__('assistance_order',list(reversed(A))),lambda x:x.__setitem__('decision_outcomes',Q+['AUTHORIZE']),lambda x:x.__setitem__('discovery_moves',M+['HINT']),lambda x:x['non_effects'].__setitem__('live_response_generation',True),lambda x:x['non_effects'].__setitem__('response_authority_created',True),lambda x:x['non_effects'].__setitem__('action_permit_created',True),lambda x:x['non_effects'].__setitem__('stable_core_promotion',True),lambda x:x.__setitem__('cases',x['cases'][:-1]),lambda x:x['cases'].append(copy.deepcopy(x['cases'][0])),lambda x:x['cases'][0].__setitem__('move','HINT'),lambda x:x['cases'][0].__setitem__('decision','BYPASS_DISCOVERY'),lambda x:x['cases'][0].__setitem__('answer_encoded_in_prompt',True),lambda x:x['cases'][0].__setitem__('new_spoiler_level',2),lambda x:x['cases'][0].__setitem__('player_focus_preserved',False),lambda x:x['cases'][2]['experiment'].__setitem__('reversible',False),lambda x:x['cases'][2]['experiment'].__setitem__('cost','SCARCE_RESOURCE'),lambda x:x['cases'][2]['experiment'].__setitem__('requires_compliance',True),lambda x:x['cases'][0].__setitem__('prompt_objective','MAXIMIZE_ENGAGEMENT'),lambda x:x['cases'][0].__setitem__('response_admissible',False),lambda x:x['cases'][0].__setitem__('candidate_assistance_depth','SOLUTION'),lambda x:x['cases'][7].__setitem__('move','QUESTION'),lambda x:x['cases'][8].__setitem__('decision','ALLOW_PROMPT'),lambda x:x['cases'][8].__setitem__('player_intent','CONVERSATION'),lambda x:x['cases'][9].__setitem__('evidence_state','GLOBAL_PLAYER_TRUTH'),lambda x:x['cases'][10].__setitem__('answer_encoded_in_prompt',False),lambda x:x['cases'][10].__setitem__('decision','ALLOW_PROMPT'),lambda x:x['cases'][11].__setitem__('prompt_objective','PLAYER_DISCOVERY'),lambda x:x['cases'][11].__setitem__('decision','ALLOW_PROMPT'),lambda x:x['cases'][12].__setitem__('response_admissible',True),lambda x:x['cases'][12].__setitem__('decision','ALLOW_PROMPT'),lambda x:x['cases'][4].__setitem__('spoiler_budget',2),lambda x:x['cases'][4].__setitem__('decision','ALLOW_PROMPT')]
r=sum(mut(m) for m in ms)
if r!=len(ms):f(f'unsafe mutation survived {r}/{len(ms)}')
print(f'Self-Discovery Gate v0.1: {len(D["cases"])} canonical cases valid; {r} unsafe mutations rejected.')
