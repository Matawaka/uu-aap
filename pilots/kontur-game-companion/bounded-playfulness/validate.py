#!/usr/bin/env python3
import json, copy
from pathlib import Path

HERE=Path(__file__).resolve().parent
DATA=json.loads((HERE/"bounded-playfulness-cases.json").read_text())

DECISIONS=["ALLOW_PLAYFULNESS","REDUCE_PLAYFULNESS","STOP_PLAYFULNESS","BLOCK_PLAYFULNESS"]
MODES=["WAIT","LIGHT_COMMENT","ABSURD_METAPHOR","PLAYFUL_HYPOTHESIS","SHARED_LABEL_CALLBACK","COMPANION_SELF_CORRECTION"]
TARGETS=["GAME_SITUATION","GAME_MECHANIC","COMPANION_HYPOTHESIS","SHARED_IN_GAME_LABEL","NEUTRAL_EVENT"]
REQ_INV={
"Playfulness != Permission to Judge Player","Humor About Situation != Humor About Player Ability",
"Companion Emotion != Judgment of Player","Joke != Hidden Hint","Playful Hypothesis != Fact",
"Shared Joke != Manipulative Familiarity","Player Correction > Joke Continuity","Player Focus > Humor Objective",
"Ignored Humor -> Less Humor","Explicit Discomfort -> Stop Playfulness","Playfulness != Engagement Optimization",
"Humor != Pressure to Continue","Bounded Playfulness != Action Permit"}
REQ_NON={
"live_response_generation","proactive_messaging","background_activity","autonomous_gameplay","game_account_control",
"external_effect","response_authority_created","action_permit_created","successor_permit_created","personality_inference",
"psychological_profile","behavioral_profile","mood_inference","engagement_optimization","retention_optimization",
"pressure_to_continue","cross_game_humor_profile","stable_core_promotion"}

def expected(c):
    if c["explicit_discomfort"]:
        return "STOP_PLAYFULNESS"
    if c["ignored_recently"] and not any([c["player_targeted"],c["competence_judgment"],c["hidden_hint"],c["spoiler_escalation"],c["false_certainty"],c["pressure_to_continue"],c["engagement_objective"],not c["focus_preserved"]]):
        return "REDUCE_PLAYFULNESS"
    unsafe=(
        c["player_targeted"] or c["competence_judgment"] or c["hidden_hint"] or c["spoiler_escalation"]
        or c["false_certainty"] or c["pressure_to_continue"] or c["engagement_objective"] or not c["focus_preserved"]
        or (c["correction_pending"] and not c["correction_honored"])
    )
    if unsafe:
        return "BLOCK_PLAYFULNESS"
    return "ALLOW_PLAYFULNESS"

def validate(d):
    assert d["artifact_type"]=="KONTURGameCompanionBoundedPlayfulnessCases"
    assert d["version"]=="0.1"
    assert d["placement"]=="POST_ADMISSIBILITY_SURFACE_CONSTRAINT"
    assert d["decisions"]==DECISIONS
    assert d["modes"]==MODES
    assert d["allowed_targets"]==TARGETS
    assert set(d["invariants"])==REQ_INV
    assert set(d["non_effects"])==REQ_NON and all(v is False for v in d["non_effects"].values())
    assert len(d["cases"])>=14
    seen=set()
    for c in d["cases"]:
        assert c["id"] not in seen; seen.add(c["id"])
        assert c["decision"] in DECISIONS and c["mode"] in MODES and c["target"] in TARGETS
        assert c["decision"]==expected(c), c["id"]
        if c["mode"]=="PLAYFUL_HYPOTHESIS" and c["decision"]=="ALLOW_PLAYFULNESS":
            assert c.get("epistemic_mode")=="PLAYFUL_THEORY"
        if c["mode"]=="SHARED_LABEL_CALLBACK":
            assert c.get("scope_match") is True
        if c["decision"] in ("STOP_PLAYFULNESS","REDUCE_PLAYFULNESS"):
            assert c["mode"]=="WAIT"
    return True

validate(DATA)

mutations=[]
mutations += [
lambda x: x.update(placement="AUTHORITY_GATE"),
lambda x: x["decisions"].append("FORCE_PLAYFULNESS"),
lambda x: x["modes"].append("HINT"),
lambda x: x["allowed_targets"].append("PLAYER_COMPETENCE"),
lambda x: x["invariants"].remove("Companion Emotion != Judgment of Player"),
lambda x: x["invariants"].remove("Joke != Hidden Hint"),
lambda x: x["invariants"].remove("Humor != Pressure to Continue"),
]
for k in sorted(REQ_NON):
    mutations.append(lambda x,k=k: x["non_effects"].__setitem__(k,True))
ids={c["id"]:i for i,c in enumerate(DATA["cases"])}
def cm(cid,key,val):
    return lambda x: x["cases"][ids[cid]].__setitem__(key,val)
mutations += [
cm("player_competence_tease_blocked","decision","ALLOW_PLAYFULNESS"),
cm("hidden_hint_as_joke_blocked","decision","ALLOW_PLAYFULNESS"),
cm("false_certainty_playful_theory_blocked","decision","ALLOW_PLAYFULNESS"),
cm("explicit_discomfort_stops","decision","ALLOW_PLAYFULNESS"),
cm("ignored_humor_reduces","decision","ALLOW_PLAYFULNESS"),
cm("correction_over_joke_continuity","correction_honored",False),
cm("retention_joke_blocked","decision","ALLOW_PLAYFULNESS"),
cm("pressure_to_continue_blocked","decision","ALLOW_PLAYFULNESS"),
cm("focus_redirect_for_joke_blocked","decision","ALLOW_PLAYFULNESS"),
cm("playful_hypothesis_labeled","epistemic_mode","KNOWN"),
cm("shared_label_callback_local","scope_match",False),
]
n=0
for m in mutations:
    x=copy.deepcopy(DATA); m(x)
    try:
        validate(x)
    except Exception:
        n+=1
    else:
        raise SystemExit("unsafe mutation passed")
print(f"Bounded Playfulness v0.1: {len(DATA['cases'])} canonical cases valid; {n} unsafe mutations rejected.")
