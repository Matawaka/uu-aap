(function (root) {
  "use strict";

  const DIMENSION_ORDER = ["integrity", "identity", "provenance", "availability", "authority", "responsibility", "truth"];
  const INPUT_SCHEMA = "urn:uu-aap:federated-candidate-disposition-input:0.1";
  const RESULT_SCHEMA = "urn:uu-aap:federated-candidate-disposition-result:0.1";
  const INTERACTIVE_INPUT_SCHEMA = "urn:uu-aap:interactive-verifier-input:0.1";
  const SCOPE = "verifier_federated_candidate_materialization";
  const DISPOSITIONS = ["ACCEPT", "REJECT", "DEFER"];

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function deepEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
  function exactKeys(value, expected, label) {
    assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
    assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()), `${label} fields changed`);
  }
  function federationApi() {
    const api = root.UUAAPCandidateFederation;
    assert(api && typeof api.validateResult === "function", "P1.9 browser validator is required");
    return api;
  }
  function candidateIndex(fset) {
    const index = new Map();
    const order = [];
    DIMENSION_ORDER.forEach((dimension) => {
      fset.candidate_buckets[dimension].forEach((candidate) => {
        const id = candidate.federated_candidate_id;
        assert(!index.has(id), `duplicate federated candidate id: ${id}`);
        index.set(id, {dimension, candidate});
        order.push(id);
      });
    });
    return {index, order};
  }
  function validateEvent(event, fset) {
    exactKeys(event, ["id", "actor_ref", "scope", "dispositions"], "disposition_event");
    assert(typeof event.id === "string" && event.id.length > 0, "disposition_event.id required");
    assert(typeof event.actor_ref === "string" && event.actor_ref.length > 0, "disposition_event.actor_ref required");
    assert(event.scope === SCOPE, "federated disposition scope changed");
    assert(Array.isArray(event.dispositions), "disposition_event.dispositions must be an array");
    const {index, order} = candidateIndex(fset);
    const expected = new Set(order);
    const seen = new Set();
    const acceptedByDimension = new Map();
    event.dispositions.forEach((disposition, i) => {
      exactKeys(disposition, ["federated_candidate_id", "decision", "rationale"], `disposition ${i}`);
      const id = disposition.federated_candidate_id;
      assert(typeof id === "string" && id.length > 0, `disposition ${i} candidate id`);
      assert(index.has(id), `unknown federated candidate id: ${id}`);
      assert(!seen.has(id), `duplicate federated candidate disposition: ${id}`);
      seen.add(id);
      assert(DISPOSITIONS.includes(disposition.decision), `disposition ${i} decision`);
      assert(typeof disposition.rationale === "string" && disposition.rationale.length > 0, `disposition ${i} rationale`);
      if (disposition.decision === "ACCEPT") {
        const dimension = index.get(id).dimension;
        assert(!acceptedByDimension.has(dimension), `multiple accepted federated candidates for ${dimension}`);
        acceptedByDimension.set(dimension, id);
      }
    });
    assert(seen.size === expected.size && [...expected].every((id) => seen.has(id)), "every federated candidate must receive exactly one disposition");
  }
  function validateInput(record) {
    exactKeys(record, ["schema", "federated_candidate_set", "disposition_event"], "federated disposition input");
    assert(record.schema === INPUT_SCHEMA, "unsupported federated disposition input schema");
    federationApi().validateResult(record.federated_candidate_set);
    validateEvent(record.disposition_event, record.federated_candidate_set);
  }
  function sourceEvidenceInventory(fset) {
    const items = [];
    const seen = new Set();
    fset.source_order.forEach((family) => {
      fset.source_results[family].evidence_items.forEach((item) => {
        assert(!seen.has(item.id), `cross-source evidence id collision: ${item.id}`);
        seen.add(item.id);
        items.push(clone(item));
      });
    });
    return items;
  }
  function notEvaluated(dimension) {
    return {
      value: "NOT_EVALUATED",
      evaluation: "NOT_EVALUATED",
      source_layer: "UU-AAP/P1.10",
      evidence_refs: [],
      explanation: `No federated candidate was explicitly accepted for the ${dimension} dimension in this disposition event.`,
      does_not_establish: ["absence of evidence", "falsehood", "lack of identity", "lack of provenance", "lack of authority", "lack of responsibility", "factual truth"]
    };
  }
  function sourceWarnings(fset) {
    return fset.source_warnings.map((item) => ({
      code: `FEDERATED_SOURCE_${item.source_family.replace(/[.-]/g, "_")}_${item.code}`,
      message: `${item.source_family}: ${item.message}`
    }));
  }
  function materialize(record) {
    validateInput(record);
    const fset = record.federated_candidate_set;
    const event = record.disposition_event;
    const {index, order} = candidateIndex(fset);
    const decisions = new Map(event.dispositions.map((item) => [item.federated_candidate_id, item]));
    const accepted = [], rejected = [], deferred = [], receipts = [];
    const acceptedByDimension = new Map();
    order.forEach((id) => {
      const {dimension, candidate} = index.get(id);
      const disposition = decisions.get(id);
      if (disposition.decision === "ACCEPT") { accepted.push(id); acceptedByDimension.set(dimension, candidate); }
      else if (disposition.decision === "REJECT") rejected.push(id);
      else deferred.push(id);
      receipts.push({
        federated_candidate_id: id,
        source_family: candidate.source_family,
        source_candidate_id: candidate.source_candidate_id,
        source_observation_id: candidate.source_observation_id,
        dimension,
        decision: disposition.decision,
        rationale: disposition.rationale
      });
    });
    const evidenceItems = sourceEvidenceInventory(fset);
    const receiptId = `evidence:${event.id}`;
    assert(!evidenceItems.some((item) => item.id === receiptId), "disposition evidence id collides with source evidence");
    const dispositionEvidence = {
      id: receiptId,
      kind: "federated_candidate_disposition_receipt",
      source_layer: "UU-AAP/P1.10",
      summary: "Explicit federated candidate dispositions used to materialize the P1.3 verifier input.",
      payload: {event_id: event.id, actor_ref: event.actor_ref, scope: event.scope, disposition_receipts: clone(receipts)}
    };
    const dimensionClaims = {};
    DIMENSION_ORDER.forEach((dimension) => {
      if (!acceptedByDimension.has(dimension)) { dimensionClaims[dimension] = notEvaluated(dimension); return; }
      const original = acceptedByDimension.get(dimension).claim;
      const claim = clone(original);
      claim.evidence_refs = [...claim.evidence_refs, receiptId];
      assert(claim.value === original.value && claim.evaluation === original.evaluation && claim.source_layer === original.source_layer, `${dimension}: disposition strengthened claim`);
      assert(claim.explanation === original.explanation && deepEqual(claim.does_not_establish, original.does_not_establish), `${dimension}: disposition changed semantic text`);
      dimensionClaims[dimension] = claim;
    });
    const warnings = sourceWarnings(fset);
    warnings.push({code: "FEDERATED_DISPOSITION_ACTOR_REF_NOT_IDENTITY_OR_AUTHORITY_PROOF", message: "The disposition actor reference records the declared local selector only; it does not establish identity, authority, authorship, responsibility, standing or legal validity."});
    if (rejected.length) warnings.push({code: "REJECTED_CANDIDATES_NOT_NEGATIVE_EVIDENCE", message: "Rejected federated candidates remain preserved as candidate history; rejection is a local disposition and is not negative evidence, sanction or reputation signal."});
    if (deferred.length) warnings.push({code: "DEFERRED_CANDIDATES_NOT_NEGATIVE_EVIDENCE", message: "Deferred federated candidates remain preserved as unresolved selection history; defer is not negative evidence or a ranking signal."});
    const materialized = {
      schema: INTERACTIVE_INPUT_SCHEMA,
      artifact: clone(fset.artifact),
      evidence_items: [...evidenceItems, dispositionEvidence],
      dimension_claims: dimensionClaims,
      related_observations: {
        federated_candidate_disposition: {event_id: event.id, actor_ref: event.actor_ref, scope: event.scope, accepted_candidate_ids: clone(accepted), rejected_candidate_ids: clone(rejected), deferred_candidate_ids: clone(deferred), disposition_receipts: clone(receipts)},
        auxiliary_attestations: clone(fset.auxiliary_attestations)
      },
      warnings,
      disputes: []
    };
    const result = {
      schema: RESULT_SCHEMA,
      artifact: clone(fset.artifact),
      federated_candidate_set: clone(fset),
      disposition_event: clone(event),
      accepted_candidate_ids: accepted,
      rejected_candidate_ids: rejected,
      deferred_candidate_ids: deferred,
      disposition_receipts: receipts,
      materialized_interactive_input: materialized,
      disposition_policy: {
        all_candidates_require_explicit_disposition: true,
        single_accept_per_dimension_required: true,
        source_provenance_preserved: true,
        actor_ref_establishes_identity: false,
        actor_ref_establishes_authority: false,
        acceptance_strengthens_claim_semantics: false,
        auto_selection_permitted: false,
        source_family_priority_permitted: false,
        source_order_priority_permitted: false,
        evaluation_ranking_permitted: false,
        reject_is_negative_evidence: false,
        defer_is_negative_evidence: false,
        auxiliary_attestations_dispositionable: false,
        cross_dimension_promotion_permitted: false,
        identity_to_authority_promotion_permitted: false,
        truth_promotion_permitted: false,
        aggregate_score_permitted: false,
        aggregate_verdict_permitted: false
      },
      aggregate_score_present: false,
      aggregate_verdict_present: false
    };
    validateResult(result);
    return result;
  }
  function validateResult(result) {
    exactKeys(result, ["schema", "artifact", "federated_candidate_set", "disposition_event", "accepted_candidate_ids", "rejected_candidate_ids", "deferred_candidate_ids", "disposition_receipts", "materialized_interactive_input", "disposition_policy", "aggregate_score_present", "aggregate_verdict_present"], "federated disposition result");
    assert(result.schema === RESULT_SCHEMA, "unsupported federated disposition result schema");
    const fset = result.federated_candidate_set;
    federationApi().validateResult(fset);
    validateEvent(result.disposition_event, fset);
    assert(deepEqual(result.artifact, fset.artifact), "artifact changed");
    const {index, order} = candidateIndex(fset);
    const decisions = new Map(result.disposition_event.dispositions.map((item) => [item.federated_candidate_id, item]));
    const expectedAccepted = order.filter((id) => decisions.get(id).decision === "ACCEPT");
    const expectedRejected = order.filter((id) => decisions.get(id).decision === "REJECT");
    const expectedDeferred = order.filter((id) => decisions.get(id).decision === "DEFER");
    assert(deepEqual(result.accepted_candidate_ids, expectedAccepted), "accepted candidate set changed");
    assert(deepEqual(result.rejected_candidate_ids, expectedRejected), "rejected candidate set changed");
    assert(deepEqual(result.deferred_candidate_ids, expectedDeferred), "deferred candidate set changed");
    assert(Array.isArray(result.disposition_receipts) && result.disposition_receipts.length === order.length, "one disposition receipt per candidate required");
    result.disposition_receipts.forEach((receipt, i) => {
      exactKeys(receipt, ["federated_candidate_id", "source_family", "source_candidate_id", "source_observation_id", "dimension", "decision", "rationale"], "disposition receipt");
      const id = order[i], entry = index.get(id), decision = decisions.get(id);
      assert(deepEqual(receipt, {federated_candidate_id: id, source_family: entry.candidate.source_family, source_candidate_id: entry.candidate.source_candidate_id, source_observation_id: entry.candidate.source_observation_id, dimension: entry.dimension, decision: decision.decision, rationale: decision.rationale}), "disposition receipt/source provenance changed");
    });
    const materialized = result.materialized_interactive_input;
    const receiptId = `evidence:${result.disposition_event.id}`;
    const sourceEvidence = sourceEvidenceInventory(fset);
    assert(deepEqual(materialized.evidence_items.slice(0, -1), sourceEvidence), "source evidence inventory changed or deduplicated");
    assert(materialized.evidence_items[materialized.evidence_items.length - 1].id === receiptId, "P1.10 disposition evidence missing");
    assert(deepEqual(materialized.related_observations.auxiliary_attestations, fset.auxiliary_attestations), "auxiliary attestations changed");
    const acceptedByDimension = new Map(expectedAccepted.map((id) => [index.get(id).dimension, index.get(id).candidate]));
    DIMENSION_ORDER.forEach((dimension) => {
      const claim = materialized.dimension_claims[dimension];
      if (!acceptedByDimension.has(dimension)) {
        assert(claim.value === "NOT_EVALUATED" && claim.evaluation === "NOT_EVALUATED" && deepEqual(claim.evidence_refs, []), `${dimension}: unaccepted candidate materialized`);
        return;
      }
      const original = acceptedByDimension.get(dimension).claim;
      assert(claim.value === original.value && claim.evaluation === original.evaluation && claim.source_layer === original.source_layer, `${dimension}: accepted semantics changed`);
      assert(claim.explanation === original.explanation && deepEqual(claim.does_not_establish, original.does_not_establish), `${dimension}: accepted semantic text changed`);
      assert(deepEqual(claim.evidence_refs, [...original.evidence_refs, receiptId]), `${dimension}: only disposition evidence ref may be appended`);
    });
    exactKeys(result.disposition_policy, ["all_candidates_require_explicit_disposition", "single_accept_per_dimension_required", "source_provenance_preserved", "actor_ref_establishes_identity", "actor_ref_establishes_authority", "acceptance_strengthens_claim_semantics", "auto_selection_permitted", "source_family_priority_permitted", "source_order_priority_permitted", "evaluation_ranking_permitted", "reject_is_negative_evidence", "defer_is_negative_evidence", "auxiliary_attestations_dispositionable", "cross_dimension_promotion_permitted", "identity_to_authority_promotion_permitted", "truth_promotion_permitted", "aggregate_score_permitted", "aggregate_verdict_permitted"], "disposition_policy");
    assert(result.disposition_policy.all_candidates_require_explicit_disposition === true && result.disposition_policy.single_accept_per_dimension_required === true && result.disposition_policy.source_provenance_preserved === true, "required positive disposition policies changed");
    Object.entries(result.disposition_policy).forEach(([key, value]) => { if (!["all_candidates_require_explicit_disposition", "single_accept_per_dimension_required", "source_provenance_preserved"].includes(key)) assert(value === false, `${key} must remain false`); });
    assert(result.aggregate_score_present === false && result.aggregate_verdict_present === false, "aggregate score/verdict forbidden");
  }
  function appendText(parent, tag, text) { const node = document.createElement(tag); node.textContent = String(text); parent.appendChild(node); return node; }
  function render(result, target) {
    target.replaceChildren();
    appendText(target, "h2", "Explicit federated dispositions");
    result.disposition_receipts.forEach((receipt) => appendText(target, "p", `${receipt.dimension}: ${receipt.decision} — ${receipt.source_family} / ${receipt.source_candidate_id} — ${receipt.rationale}`));
    appendText(target, "h2", "Materialized seven-dimension claims");
    DIMENSION_ORDER.forEach((dimension) => { const claim = result.materialized_interactive_input.dimension_claims[dimension]; appendText(target, "p", `${dimension}: ${claim.value} (${claim.evaluation})`); });
    appendText(target, "h2", "Materialized P1.3 JSON"); appendText(target, "pre", JSON.stringify(result.materialized_interactive_input, null, 2));
  }
  const api = {DIMENSION_ORDER, INPUT_SCHEMA, RESULT_SCHEMA, SCOPE, DISPOSITIONS, validateInput, validateResult, materializeFederatedDisposition: materialize};
  root.UUAAPFederatedDisposition = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    const input = document.getElementById("disposition-input-json"), file = document.getElementById("disposition-file-input"), button = document.getElementById("disposition-button"), error = document.getElementById("disposition-error"), target = document.getElementById("disposition-result");
    if (file && input) file.addEventListener("change", () => { const selected = file.files && file.files[0]; if (!selected) return; const reader = new FileReader(); reader.addEventListener("load", () => { input.value = typeof reader.result === "string" ? reader.result : ""; if (error) error.textContent = "Local file loaded. Select Apply explicit dispositions to process it."; if (target) target.replaceChildren(); }); reader.readAsText(selected); });
    if (button && input && error && target) button.addEventListener("click", () => { error.textContent = ""; target.replaceChildren(); try { render(materialize(JSON.parse(input.value)), target); } catch (caught) { error.textContent = `Disposition validation failed: ${caught instanceof Error ? caught.message : String(caught)}`; } });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
