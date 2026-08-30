(() => {
  "use strict";

  const CAWG_STATUSES = new Set(["TRUSTED","WELL_FORMED","REVOKED","INVALID","NETWORK_REQUIRED"]);
  const VC_STATUSES = new Set(["VALID","INVALID","UNKNOWN"]);
  const FORBIDDEN_KEYS = new Set(["overall_trust","trust_score","truth_score","reputation_score","reliability_score","confidence_score","compatibility_score","overall_verdict","verified","verified_true"]);

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function sameKeys(value, expected) { return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()); }
  function nonemptyStrings(value, label) { assert(Array.isArray(value) && value.every(x => typeof x === "string" && x.length > 0), label); }

  function semanticProjection(value) {
    const projected = clone(value);
    for (const item of projected.evidence_items || []) if (item && typeof item === "object") item.payload = {};
    for (const item of projected.observations || []) {
      if (!item || typeof item !== "object" || !item.payload) continue;
      if (Object.hasOwn(item.payload, "validator_details")) item.payload.validator_details = {};
      if (Object.hasOwn(item.payload, "verifier_details")) item.payload.verifier_details = {};
    }
    return projected;
  }
  function scan(value, path = "") {
    if (Array.isArray(value)) { value.forEach((x,i)=>scan(x,`${path}[${i}]`)); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const p = path ? `${path}.${key}` : key;
      const normalized = key.toLowerCase().replaceAll("-","_").replaceAll(" ","_");
      if (normalized === "aggregate_score_present" || normalized === "aggregate_verdict_present") assert(child === false, `${p} must remain false`);
      else assert(!FORBIDDEN_KEYS.has(normalized), `forbidden aggregate/verdict field: ${p}`);
      scan(child, p);
    }
  }
  function validateDimension(d) {
    assert(sameKeys(d,["value","evaluation","source_layer","evidence_refs","explanation","does_not_establish"]), "identity candidate fields");
    assert(new Set(["CAWG_IDENTITY_TRUSTED","CAWG_IDENTITY_WELL_FORMED","CAWG_IDENTITY_REVOKED"]).has(d.value), "identity value");
    assert(new Set(["SUPPORTED","UNKNOWN","NOT_SUPPORTED"]).has(d.evaluation), "identity evaluation");
    assert(d.source_layer === "CAWG/IdentityAssertion/1.3", "identity source layer");
    nonemptyStrings(d.evidence_refs,"identity evidence refs");
    assert(typeof d.explanation === "string" && d.explanation.length > 0,"identity explanation");
    nonemptyStrings(d.does_not_establish,"identity non-effects");
  }

  function validateInput(record) {
    assert(record && typeof record === "object" && sameKeys(record,["schema","artifact","evidence_items","observations"]), "attestation input fields changed");
    assert(record.schema === "urn:uu-aap:scoped-attestation-bridge-input:0.1", "input schema");
    assert(record.artifact && sameKeys(record.artifact,["id","description"]), "artifact fields");
    const evidenceIds = new Set();
    assert(Array.isArray(record.evidence_items), "evidence_items");
    record.evidence_items.forEach((item,index)=>{
      assert(item && sameKeys(item,["id","kind","source_layer","summary","payload"]), `evidence[${index}] fields`);
      assert(!evidenceIds.has(item.id), `duplicate evidence ${item.id}`); evidenceIds.add(item.id);
      assert(item.payload && typeof item.payload === "object" && !Array.isArray(item.payload), `evidence[${index}] payload`);
    });
    const seen = new Set();
    assert(Array.isArray(record.observations), "observations");
    record.observations.forEach((item,index)=>{
      assert(item && sameKeys(item,["id","kind","evidence_refs","payload"]), `observation[${index}] fields`);
      assert(!seen.has(item.id), `duplicate observation ${item.id}`); seen.add(item.id);
      nonemptyStrings(item.evidence_refs, `observation[${index}] evidence refs`);
      item.evidence_refs.forEach(ref=>assert(evidenceIds.has(ref), `undeclared evidence ${ref}`));
      const p = item.payload;
      if (item.kind === "CAWG_IDENTITY_VALIDATION") {
        assert(sameKeys(p,["assertion_version","validation_status","named_actor_ref","named_actor_label","roles","credential_type","referenced_assertions","validated_at","validator_details"]), "CAWG payload fields");
        assert(p.assertion_version === "1.3", "CAWG version"); assert(CAWG_STATUSES.has(p.validation_status), "CAWG status");
        nonemptyStrings(p.roles,"CAWG roles"); nonemptyStrings(p.referenced_assertions,"CAWG referenced assertions");
        assert(p.validator_details && typeof p.validator_details === "object" && !Array.isArray(p.validator_details), "validator_details");
      } else if (item.kind === "W3C_VC_REVIEW_ATTESTATION") {
        assert(sameKeys(p,["vcdm_version","verification_status","issuer_ref","credential_subject_refs","review_scope","limitations","review_date","verifier_details"]), "VC payload fields");
        assert(p.vcdm_version === "2.0", "VCDM basis"); assert(VC_STATUSES.has(p.verification_status), "VC status");
        nonemptyStrings(p.credential_subject_refs,"VC subjects"); nonemptyStrings(p.limitations,"VC limitations");
        assert(p.verifier_details && typeof p.verifier_details === "object" && !Array.isArray(p.verifier_details), "verifier_details");
      } else throw new Error(`unsupported attestation kind ${item.kind}`);
    });
    scan(semanticProjection(record));
  }

  function identityClaim(item) {
    const p = item.payload;
    const map = {
      TRUSTED:["CAWG_IDENTITY_TRUSTED","SUPPORTED"],
      WELL_FORMED:["CAWG_IDENTITY_WELL_FORMED","UNKNOWN"],
      REVOKED:["CAWG_IDENTITY_REVOKED","NOT_SUPPORTED"],
    };
    if (!Object.hasOwn(map,p.validation_status)) return null;
    const [value,evaluation] = map[p.validation_status];
    return {
      value,evaluation,source_layer:"CAWG/IdentityAssertion/1.3",evidence_refs:clone(item.evidence_refs),
      explanation:`External CAWG Identity Assertion 1.3 validation receipt reports ${p.validation_status} for named actor ${p.named_actor_ref}.`,
      does_not_establish:["authorship","UU-AAP decision authority","UU-AAP responsibility acceptance","factual truth","legal identity beyond the external credential scope","that a CAWG role maps to UU-AAP authority","decision-time availability or consideration"],
    };
  }

  function bridgeAttestations(record) {
    validateInput(record);
    const identity_candidates=[], role_attestations=[], review_attestations=[], bridge_receipts=[], warnings=[];
    for (const item of record.observations) {
      if (item.kind === "CAWG_IDENTITY_VALIDATION") {
        const p=item.payload, claim=identityClaim(item);
        if (claim) { validateDimension(claim); identity_candidates.push({candidate_id:`identity-candidate:${item.id}`,observation_id:item.id,named_actor_ref:p.named_actor_ref,claim}); }
        else warnings.push({code:p.validation_status === "INVALID" ? "CAWG_IDENTITY_INVALID" : "CAWG_IDENTITY_NETWORK_REQUIRED",message:`${item.id}: ${p.validation_status} produced no identity candidate; evidence is preserved.`});
        for (const role of p.roles) role_attestations.push({observation_id:item.id,named_actor_ref:p.named_actor_ref,role,validation_status:p.validation_status,evidence_refs:clone(item.evidence_refs),does_not_establish:["UU-AAP decision authority","UU-AAP responsibility acceptance","authorship as a legal conclusion","factual truth"]});
        bridge_receipts.push({observation_id:item.id,kind:item.kind,external_status:p.validation_status,identity_candidate_emitted:Boolean(claim),auxiliary_records_emitted:p.roles.length});
      } else {
        const p=item.payload;
        review_attestations.push({observation_id:item.id,verification_status:p.verification_status,issuer_ref:p.issuer_ref,credential_subject_refs:clone(p.credential_subject_refs),review_scope:p.review_scope,limitations:clone(p.limitations),review_date:p.review_date,evidence_refs:clone(item.evidence_refs),does_not_establish:["factual truth","UU-AAP decision authority","UU-AAP responsibility acceptance","reviewer identity beyond the credential subject claims","that reviewed claims are correct"]});
        if (p.verification_status !== "VALID") warnings.push({code:"VC_REVIEW_ATTESTATION_NOT_VALIDATED",message:`${item.id}: review credential status is ${p.verification_status}; no semantic promotion is permitted.`});
        bridge_receipts.push({observation_id:item.id,kind:item.kind,external_status:p.verification_status,identity_candidate_emitted:false,auxiliary_records_emitted:1});
      }
    }
    const result={schema:"urn:uu-aap:scoped-attestation-bridge-result:0.1",artifact:clone(record.artifact),evidence_items:clone(record.evidence_items),identity_candidates,role_attestations,review_attestations,bridge_receipts,warnings,bridge_policy:{identity_candidates_require_explicit_future_acceptance:true,auto_materialization_permitted:false,role_to_authority_promotion_permitted:false,role_to_responsibility_promotion_permitted:false,review_to_truth_promotion_permitted:false,review_to_responsibility_promotion_permitted:false,issuer_trust_to_truth_promotion_permitted:false,aggregate_score_permitted:false,aggregate_verdict_permitted:false},aggregate_score_present:false,aggregate_verdict_present:false};
    validateResult(result); return result;
  }

  function validateResult(result) {
    assert(result && sameKeys(result,["schema","artifact","evidence_items","identity_candidates","role_attestations","review_attestations","bridge_receipts","warnings","bridge_policy","aggregate_score_present","aggregate_verdict_present"]),"attestation result fields changed");
    assert(result.schema === "urn:uu-aap:scoped-attestation-bridge-result:0.1","result schema");
    result.identity_candidates.forEach(x=>validateDimension(x.claim));
    result.role_attestations.forEach(x=>assert(x.does_not_establish.includes("UU-AAP decision authority"),"role authority boundary"));
    result.review_attestations.forEach(x=>assert(x.does_not_establish.includes("factual truth"),"review truth boundary"));
    assert(result.bridge_policy.identity_candidates_require_explicit_future_acceptance === true,"future acceptance required");
    for (const [key,value] of Object.entries(result.bridge_policy)) if (key !== "identity_candidates_require_explicit_future_acceptance") assert(value === false,`${key} must be false`);
    assert(result.aggregate_score_present === false && result.aggregate_verdict_present === false,"aggregate flags");
    scan(semanticProjection(result));
  }

  function addText(parent, tag, text) { const el=document.createElement(tag); el.textContent=String(text); parent.appendChild(el); return el; }
  function render(result, container) {
    container.replaceChildren(); addText(container,"h2","Bounded attestation result");
    addText(container,"p",`Identity candidates: ${result.identity_candidates.length}`);
    for (const item of result.identity_candidates) addText(container,"p",`${item.named_actor_ref}: ${item.claim.value} / ${item.claim.evaluation}`);
    addText(container,"p",`Role attestations: ${result.role_attestations.length}`);
    for (const item of result.role_attestations) addText(container,"p",`${item.named_actor_ref}: ${item.role} (${item.validation_status})`);
    addText(container,"p",`Review attestations: ${result.review_attestations.length}`);
    for (const item of result.review_attestations) addText(container,"p",`${item.issuer_ref}: ${item.review_scope} (${item.verification_status})`);
    const pre=document.createElement("pre"); pre.textContent=JSON.stringify(result,null,2); container.appendChild(pre);
  }
  function installUi() {
    const textarea=document.getElementById("attestation-input-json"), file=document.getElementById("attestation-file-input"), button=document.getElementById("attestation-button"), error=document.getElementById("attestation-error"), out=document.getElementById("attestation-result");
    if (!textarea || !file || !button || !error || !out) return;
    button.addEventListener("click",()=>{ error.textContent=""; out.replaceChildren(); try { render(bridgeAttestations(JSON.parse(textarea.value)),out); } catch(e) { error.textContent=`Validation failed: ${e instanceof Error ? e.message : String(e)}`; } });
    file.addEventListener("change",()=>{ const selected=file.files && file.files[0]; if (!selected) return; const reader=new FileReader(); reader.addEventListener("load",()=>{textarea.value=typeof reader.result === "string" ? reader.result : ""; error.textContent="Local file loaded. Select Bridge local attestation receipts to process it."; out.replaceChildren();}); reader.readAsText(selected); });
  }
  globalThis.UUAAPAttestations={bridgeAttestations,validateInput,validateResult};
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",installUi,{once:true}); else installUi(); }
})();
