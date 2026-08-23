#!/usr/bin/env python3
"""CHSP v1.1 local-only external effect stabilization and recognition."""
from __future__ import annotations
import copy, hashlib, json, os, re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

HEX64_RE=re.compile(r"^[0-9a-f]{64}$")
ACK_TOKEN="ACKNOWLEDGE_CHSP_STABILIZED_EXTERNAL_EFFECT_ONLY"

def canonical_bytes(v:Any)->bytes:return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
def sha256_json(v:Any)->str:return hashlib.sha256(canonical_bytes(v)).hexdigest()
def self_digest(v:dict[str,Any],field:str)->str:
    w=copy.deepcopy(v);w[field]="0"*64;return sha256_json(w)
def require(c:bool,m:str)->None:
    if not c:raise ValueError(m)
def parse_time(v:str)->datetime:
    p=datetime.fromisoformat(v.replace("Z","+00:00"));require(p.tzinfo is not None,"timestamp must include timezone");return p.astimezone(timezone.utc)
def iso_z(v:datetime)->str:return v.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
def load_json(p:Path)->dict[str,Any]:require(p.is_file() and not p.is_symlink(),f"JSON input must be regular non-symlink file: {p}");return json.loads(p.read_text())
def reserve_once(state:Path,cat:str,key:str,payload:dict[str,Any])->None:
    d=state/cat;d.mkdir(parents=True,exist_ok=True);t=d/(hashlib.sha256(key.encode()).hexdigest()+".json")
    try:fd=os.open(t,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    except FileExistsError as e:raise ValueError(f"local reservation already exists for {cat}") from e
    with os.fdopen(fd,"w") as h:h.write(json.dumps(payload,sort_keys=True)+"\n");h.flush();os.fsync(h.fileno())

def validate_policy(p:dict[str,Any])->None:
    require(p.get("artifact_type")=="CHSPExternalEffectStabilizationPolicy" and p.get("artifact_version")=="1.1","stabilization policy v1.1 required")
    require(bool(p.get("project_id")),"invalid project_id")
    for k,n in [("minimum_stabilization_hours",1),("minimum_supportive_observations",2),("minimum_observer_domains",2),("maximum_observation_age_days",1),("minimum_acknowledgers",2),("minimum_acknowledger_domains",2)]:require(isinstance(p.get(k),int) and p[k]>=n,f"invalid threshold: {k}")
    r=p.get("requirements") or {}
    for k in ["verified_v10_effect_required","credentials_prohibited","drift_blocks_stabilization","indeterminate_blocks_stabilization","distinct_observer_domains_required","human_acknowledgement_required","steward_acknowledgement_required","non_steward_acknowledger_required"]:require(r.get(k) is True,f"missing safety requirement: {k}")
    for k in ["automatic_external_mutation","automatic_recognition","ownership_transfer_authorized","predecessor_access_removal_authorized","canonical_origin_mutation_authorized","canonical_publication_authorized","kontur_activation_authorized"]:require(r.get(k) is False,f"unsafe policy permission: {k}")

def validate_v10(receipt:dict[str,Any],assessment:dict[str,Any],policy:dict[str,Any])->None:
    validate_policy(policy)
    require(receipt.get("artifact_type")=="CHSPExternalExecutionReceipt" and receipt.get("artifact_version")=="1.0","CHSPExternalExecutionReceipt v1.0 required")
    require(assessment.get("artifact_type")=="CHSPExternalExecutionAssessment" and assessment.get("artifact_version")=="1.0","CHSPExternalExecutionAssessment v1.0 required")
    require(self_digest(receipt,"receipt_sha256")==receipt.get("receipt_sha256"),"v1.0 receipt self-digest mismatch")
    require(self_digest(assessment,"assessment_sha256")==assessment.get("assessment_sha256"),"v1.0 assessment self-digest mismatch")
    require(receipt.get("project_id")==assessment.get("project_id")==policy["project_id"],"v1.0 project mismatch")
    require(receipt.get("steward_id")==assessment.get("steward_id"),"v1.0 steward mismatch")
    require(assessment.get("execution_receipt_sha256")==receipt["receipt_sha256"],"v1.0 receipt/assessment binding mismatch")
    require(assessment.get("state") in {"execution_verified_changed","execution_verified_no_change"} and assessment.get("decision")=="external_transition_effect_may_be_recorded","v1.0 effect is not verified")
    require((assessment.get("claims") or {}).get("exact_external_transition_verified") is True,"v1.0 verified claim missing")
    require(receipt.get("post_observed_role") not in {None,"unknown"},"v1.0 receipt lacks stable expected role")

def build_observation(receipt,assessment,policy,observer_id,observer_domain_id,observed_role,evidence_sha256,observed_at):
    validate_v10(receipt,assessment,policy);require(observer_id and observer_domain_id,"observer IDs required");require(HEX64_RE.fullmatch(evidence_sha256 or "") is not None,"invalid evidence digest")
    now=parse_time(observed_at);require(now>=parse_time(receipt["completed_at"]),"observation predates v1.0 execution");expected=receipt["post_observed_role"]
    result="indeterminate" if observed_role=="unknown" else ("support" if observed_role==expected else "drift")
    v={"artifact_type":"CHSPExternalEffectObservation","artifact_version":"1.1","observation_id":"urn:uu-aap:chsp:external-effect-observation:"+sha256_json({"r":receipt["receipt_sha256"],"o":observer_id,"t":iso_z(now),"e":evidence_sha256})[:24],"project_id":policy["project_id"],"steward_id":receipt["steward_id"],"v10_execution_receipt_sha256":receipt["receipt_sha256"],"v10_execution_assessment_sha256":assessment["assessment_sha256"],"observer_id":observer_id,"observer_domain_id":observer_domain_id,"observed_at":iso_z(now),"observed_role":observed_role,"expected_role":expected,"result":result,"evidence_sha256":evidence_sha256,"contains_credentials":False,"observation_sha256":"0"*64,"claims":{"post_effect_observation_recorded":True,"external_effect_stabilized":False,"global_provider_state_proven":False,"ownership_proven":False,"credentials_present":False}}
    v["observation_sha256"]=self_digest(v,"observation_sha256");return v

def validate_observation(o,receipt,assessment,policy):
    require(o.get("artifact_type")=="CHSPExternalEffectObservation" and o.get("artifact_version")=="1.1","observation v1.1 required");require(self_digest(o,"observation_sha256")==o.get("observation_sha256"),"observation self-digest mismatch")
    require(o.get("project_id")==policy["project_id"] and o.get("steward_id")==receipt["steward_id"],"observation scope mismatch");require(o.get("v10_execution_receipt_sha256")==receipt["receipt_sha256"] and o.get("v10_execution_assessment_sha256")==assessment["assessment_sha256"],"observation v1.0 binding mismatch");require(o.get("contains_credentials") is False,"credentials prohibited in observation");require(o.get("expected_role")==receipt["post_observed_role"],"observation expected role mismatch")
    if o.get("result")=="support":require(o.get("observed_role")==o.get("expected_role"),"support observation role mismatch")
    elif o.get("result")=="drift":require(o.get("observed_role") not in {o.get("expected_role"),"unknown"},"drift observation invalid")
    elif o.get("result")=="indeterminate":require(o.get("observed_role")=="unknown","indeterminate observation invalid")
    else:raise ValueError("invalid observation result")

def assess_stabilization(receipt,assessment,observations,policy,evaluated_at):
    validate_v10(receipt,assessment,policy);now=parse_time(evaluated_at);valid=[]
    for o in observations:
        validate_observation(o,receipt,assessment,policy);t=parse_time(o["observed_at"]);require(t<=now,"observation is from the future")
        if now-t<=timedelta(days=policy["maximum_observation_age_days"]):valid.append(o)
    ds=[o["observation_sha256"] for o in valid];require(len(ds)==len(set(ds)),"duplicate observation artifact")
    s=[o for o in valid if o["result"]=="support"];d=[o for o in valid if o["result"]=="drift"];u=[o for o in valid if o["result"]=="indeterminate"];domains={o["observer_domain_id"] for o in s};ts=sorted(parse_time(o["observed_at"]) for o in s);span=int((ts[-1]-ts[0]).total_seconds()//3600) if len(ts)>=2 else 0;reasons=[]
    if d:reasons.append("current drift evidence blocks stabilization")
    if u:reasons.append("current indeterminate evidence blocks stabilization")
    if len(s)<policy["minimum_supportive_observations"]:reasons.append("insufficient supportive observations")
    if len(domains)<policy["minimum_observer_domains"]:reasons.append("insufficient observer domains")
    if span<policy["minimum_stabilization_hours"]:reasons.append("stabilization window too short")
    if d or u:state,decision="stabilization_blocked","investigate_drift_before_recognition"
    elif reasons:state,decision="effect_not_stabilized","continue_observation"
    else:state,decision="stabilization_eligible","external_effect_human_acknowledgement_may_be_requested"
    v={"artifact_type":"CHSPExternalEffectStabilizationAssessment","artifact_version":"1.1","assessment_id":"urn:uu-aap:chsp:effect-stabilization-assessment:"+sha256_json({"r":receipt["receipt_sha256"],"o":sorted(ds),"t":iso_z(now)})[:24],"project_id":policy["project_id"],"steward_id":receipt["steward_id"],"v10_execution_receipt_sha256":receipt["receipt_sha256"],"v10_execution_assessment_sha256":assessment["assessment_sha256"],"observation_set_sha256":sha256_json(sorted(ds)),"evaluated_at":iso_z(now),"state":state,"decision":decision,"metrics":{"supportive_observations":len(s),"observer_domains":len(domains),"stabilization_span_hours":span,"drift_observations":len(d),"indeterminate_observations":len(u)},"reasons":reasons,"assessment_sha256":"0"*64,"claims":{"policy_sufficiency_only":True,"external_effect_stabilization_eligible":state=="stabilization_eligible","human_recognition_recorded":False,"external_mutation_performed":False,"repository_ownership_transferred":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"global_provider_state_proven":False}}
    v["assessment_sha256"]=self_digest(v,"assessment_sha256");return v

def acknowledge(stabilization,policy,human_id,human_domain_id,authority_evidence_sha256,nonce,confirmation_token,acknowledged_at,state_dir=None):
    require(self_digest(stabilization,"assessment_sha256")==stabilization.get("assessment_sha256"),"stabilization assessment self-digest mismatch");require(stabilization.get("state")=="stabilization_eligible","effect is not acknowledgement-eligible");require(HEX64_RE.fullmatch(authority_evidence_sha256 or "") is not None,"invalid authority evidence digest");require(len(nonce)>=16,"acknowledgement nonce too short");require(confirmation_token==ACK_TOKEN,"acknowledgement typed confirmation mismatch");now=parse_time(acknowledged_at);require(now>=parse_time(stabilization["evaluated_at"]),"acknowledgement predates stabilization assessment")
    if state_dir:reserve_once(state_dir,"effect-acknowledgement-humans",stabilization["assessment_sha256"]+":"+human_id,{"at":iso_z(now)});reserve_once(state_dir,"effect-acknowledgement-nonces",nonce,{"at":iso_z(now)})
    v={"artifact_type":"CHSPExternalEffectHumanAcknowledgement","artifact_version":"1.1","acknowledgement_id":"urn:uu-aap:chsp:effect-acknowledgement:"+sha256_json({"a":stabilization["assessment_sha256"],"h":human_id,"n":nonce})[:24],"project_id":stabilization["project_id"],"steward_id":stabilization["steward_id"],"stabilization_assessment_sha256":stabilization["assessment_sha256"],"human_id":human_id,"human_domain_id":human_domain_id,"authority_evidence_sha256":authority_evidence_sha256,"acknowledged_at":iso_z(now),"nonce":nonce,"confirmation_token":confirmation_token,"acknowledgement_sha256":"0"*64,"claims":{"human_acknowledgement_recorded":True,"single_acknowledgement_establishes_recognition":False,"external_mutation_authorized":False,"ownership_transfer_authorized":False,"canonical_publication_authorized":False,"kontur_activation_authorized":False}}
    v["acknowledgement_sha256"]=self_digest(v,"acknowledgement_sha256");return v

def recognize(receipt,assessment,stabilization,acks,policy,recognized_at,state_dir=None):
    validate_v10(receipt,assessment,policy);require(self_digest(stabilization,"assessment_sha256")==stabilization.get("assessment_sha256"),"stabilization assessment self-digest mismatch");require(stabilization.get("state")=="stabilization_eligible","effect not stabilization-eligible");require(stabilization.get("v10_execution_receipt_sha256")==receipt["receipt_sha256"] and stabilization.get("v10_execution_assessment_sha256")==assessment["assessment_sha256"],"stabilization v1.0 binding mismatch");require(acks,"acknowledgement set empty")
    humans=[];domains=set();ds=[];times=[]
    for a in acks:
        require(a.get("artifact_type")=="CHSPExternalEffectHumanAcknowledgement" and a.get("artifact_version")=="1.1","human acknowledgement v1.1 required");require(self_digest(a,"acknowledgement_sha256")==a.get("acknowledgement_sha256"),"acknowledgement self-digest mismatch");require(a.get("stabilization_assessment_sha256")==stabilization["assessment_sha256"],"acknowledgement assessment mismatch");require(a.get("confirmation_token")==ACK_TOKEN,"acknowledgement token mismatch");humans.append(a["human_id"]);domains.add(a["human_domain_id"]);ds.append(a["acknowledgement_sha256"]);times.append(parse_time(a["acknowledged_at"]))
    require(len(humans)==len(set(humans)),"duplicate acknowledgement actor");require(len(humans)>=policy["minimum_acknowledgers"],"insufficient acknowledgers");require(len(domains)>=policy["minimum_acknowledger_domains"],"insufficient acknowledger domains");require(receipt["steward_id"] in humans,"steward acknowledgement required");require(any(h!=receipt["steward_id"] for h in humans),"non-steward acknowledger required");now=parse_time(recognized_at);require(now>=max(times),"recognition predates acknowledgement")
    if state_dir:reserve_once(state_dir,"recognized-effect-assessments",stabilization["assessment_sha256"],{"recognized_at":iso_z(now)})
    sd=sorted(ds);v={"artifact_type":"CHSPExternalEffectRecognition","artifact_version":"1.1","recognition_id":"urn:uu-aap:chsp:external-effect-recognition:"+sha256_json({"a":stabilization["assessment_sha256"],"d":sd,"t":iso_z(now)})[:24],"project_id":policy["project_id"],"steward_id":receipt["steward_id"],"v10_execution_receipt_sha256":receipt["receipt_sha256"],"v10_execution_assessment_sha256":assessment["assessment_sha256"],"stabilization_assessment_sha256":stabilization["assessment_sha256"],"acknowledgement_set_sha256":sha256_json(sd),"acknowledgement_sha256s":sd,"acknowledger_ids":sorted(humans),"acknowledger_domain_ids":sorted(domains),"recognized_at":iso_z(now),"recognition_sha256":"0"*64,"claims":{"external_effect_recognized":True,"stabilization_policy_satisfied":True,"human_quorum_recorded":True,"permanent_availability_proven":False,"repository_ownership_transferred":False,"account_control_transferred":False,"predecessor_access_removed":False,"canonical_origin_mutated":False,"canonical_publication_executed":False,"kontur_activated":False,"legal_ownership_adjudicated":False,"global_provider_state_proven":False,"distributed_consensus_established":False}}
    v["recognition_sha256"]=self_digest(v,"recognition_sha256");return v
