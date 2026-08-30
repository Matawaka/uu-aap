(function (root) {
  "use strict";

  const INPUT_SCHEMA = "urn:uu-aap:candidate-acceptance-input:0.1";
  const RESULT_SCHEMA = "urn:uu-aap:candidate-acceptance-result:0.1";
  const ACCEPTANCE_SCOPE = "verifier_candidate_materialization";
  const DISPOSITIONS = new Set(["ACCEPT", "REJECT", "DEFER"]);
  const DIMENSION_ORDER = ["integrity", "identity", "provenance", "availability", "authority", "responsibility", "truth"];

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function exactKeys(value, expected, label) {
    assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    assert(JSON.stringify(actual) === JSON.stringify(wanted), `${label} fields changed: ${actual.join(",")}`);
  }

  function adapterApi() {
    assert(root.UUAAPEvidenceAdapter, "P1.4 adapter validator is required");
    return root.UUAAPEvidenceAdapter;
  }

  function interactiveApi() {
    assert(root.UUAAPInteractive, "P1.3 interactive validator is required");
    return root.UUAAPInteractive;
  }

  function candidateIndex(adapterResult) {
    const index = new Map();
    const order = [];
    DIMENSION_ORDER.forEach((dimension) => {
      adapterResult.candidate_claims[dimension].forEach((candidate) => {
        assert(!index.has(candidate.candidate_id), `duplicate candidate id: ${candidate.candidate_id}`);
        index.set(candidate.candidate_id, { dimension, candidate });
        order.push(candidate.candidate_id);
      });
    });
    return { index, order };
  }

  function validateAcceptanceEvent(event, adapterResult) {
    exactKeys(event, ["id", "actor_ref", "scope", "dispositions"], "acceptance_event");
    assert(typeof event.id === "string" && event.id, "acceptance_event.id must be non-empty");
    assert(typeof event.actor_ref === "string" && event.actor_ref, "acceptance_event.actor_ref must be non-empty");
    assert(event.scope === ACCEPTANCE_SCOPE, "acceptance scope must remain verifier_candidate_materialization");
    assert(Array.isArray(event.dispositions), "acceptance_event.dispositions must be an array");

    const { index: candidates, order } = candidateIndex(adapterResult);
    const expected = new Set(order);
    const seen = new Set();
    const acceptedByDimension = new Map();

    event.dispositions.forEach((disposition, position) => {
      const label = `acceptance_event.dispositions[${position}]`;
      exactKeys(disposition, ["candidate_id", "decision", "rationale"], label);
      assert(typeof disposition.candidate_id === "string" && disposition.candidate_id, `${label}.candidate_id`);
      assert(candidates.has(disposition.candidate_id), `unknown candidate id: ${disposition.candidate_id}`);
      assert(!seen.has(disposition.candidate_id), `duplicate candidate disposition: ${disposition.candidate_id}`);
      seen.add(disposition.candidate_id);
      assert(DISPOSITIONS.has(disposition.decision), `${label}.decision`);
      assert(typeof disposition.rationale === "string" && disposition.rationale, `${label}.rationale`);
      if (disposition.decision === "ACCEPT") {
        const dimension = candidates.get(disposition.candidate_id).dimension;
        assert(!acceptedByDimension.has(dimension), `multiple accepted candidates for ${dimension}: ${acceptedByDimension.get(dimension)}, ${disposition.candidate_id}`);
        acceptedByDimension.set(dimension, disposition.candidate_id);
      }
    });

    const missing = [...expected].filter((candidateId) => !seen.has(candidateId));
    const extra = [...seen].filter((candidateId) => !expected.has(candidateId));
    assert(missing.length === 0 && extra.length === 0, `every candidate must receive exactly one disposition; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
  }

  function validateAcceptanceInput(record) {
    exactKeys(record, ["schema", "adapter_result", "acceptance_event"], "acceptance input");
    assert(record.schema === INPUT_SCHEMA, "unsupported acceptance input schema");
    adapterApi().validateResult(record.adapter_result);
    validateAcceptanceEvent(record.acceptance_event, record.adapter_result);
  }

  function buildAcceptanceInput(adapterResult, acceptanceEvent) {
    const record = {
      schema: INPUT_SCHEMA,
      adapter_result: clone(adapterResult),
      acceptance_event: clone(acceptanceEvent)
    };
    validateAcceptanceInput(record);
    return record;
  }

  function notEvaluatedDimension(dimension) {
    return {
      value: "NOT_EVALUATED",
      evaluation: "NOT_EVALUATED",
      source_layer: "UU-AAP/P1.5",
      evidence_refs: [],
      explanation: `No candidate was explicitly accepted for the ${dimension} dimension in this materialization event.`,
      does_not_establish: [
        "absence of evidence",
        "falsehood",
        "lack of provenance",
        "lack of authority",
        "lack of responsibility",
        "factual truth"
      ]
    };
  }

  function materializeCandidateAcceptance(record) {
    validateAcceptanceInput(record);
    const adapterResult = record.adapter_result;
    const event = record.acceptance_event;
    const { index: candidates, order } = candidateIndex(adapterResult);
    const decisions = new Map(event.dispositions.map((item) => [item.candidate_id, item]));

    const accepted = [];
    const rejected = [];
    const deferred = [];
    const acceptedByDimension = new Map();

    order.forEach((candidateId) => {
      const decision = decisions.get(candidateId).decision;
      const entry = candidates.get(candidateId);
      if (decision === "ACCEPT") {
        accepted.push(candidateId);
        acceptedByDimension.set(entry.dimension, entry.candidate);
      } else if (decision === "REJECT") {
        rejected.push(candidateId);
      } else {
        deferred.push(candidateId);
      }
    });

    const receiptId = `evidence:${event.id}`;
    const existingEvidenceIds = new Set(adapterResult.evidence_items.map((item) => item.id));
    assert(!existingEvidenceIds.has(receiptId), `acceptance evidence id collides with adapter evidence: ${receiptId}`);

    const acceptanceReceipt = {
      id: receiptId,
      kind: "candidate_acceptance_receipt",
      source_layer: "UU-AAP/P1.5",
      summary: "Explicit candidate dispositions used to materialize the P1.3 verifier input.",
      payload: {
        event_id: event.id,
        actor_ref: event.actor_ref,
        scope: event.scope,
        dispositions: clone(event.dispositions)
      }
    };

    const dimensionClaims = {};
    DIMENSION_ORDER.forEach((dimension) => {
      const candidate = acceptedByDimension.get(dimension);
      if (!candidate) {
        dimensionClaims[dimension] = notEvaluatedDimension(dimension);
        return;
      }
      const original = candidate.claim;
      const claim = clone(original);
      claim.evidence_refs = [...claim.evidence_refs, receiptId];
      assert(claim.value === original.value, `${dimension}: value changed`);
      assert(claim.evaluation === original.evaluation, `${dimension}: evaluation changed`);
      assert(claim.source_layer === original.source_layer, `${dimension}: source layer changed`);
      assert(claim.explanation === original.explanation, `${dimension}: explanation changed`);
      assert(JSON.stringify(claim.does_not_establish) === JSON.stringify(original.does_not_establish), `${dimension}: non-effects changed`);
      dimensionClaims[dimension] = claim;
    });

    const warnings = clone(adapterResult.warnings);
    warnings.push({
      code: "ACCEPTANCE_ACTOR_REF_NOT_IDENTITY_OR_AUTHORITY_PROOF",
      message: "The acceptance actor reference records who was named in this local selection event; it does not establish identity, authority, authorship, responsibility or legal validity."
    });
    if (rejected.length || deferred.length) {
      warnings.push({
        code: "UNMATERIALIZED_CANDIDATES_PRESERVED",
        message: "Rejected or deferred candidates remain recorded in the acceptance result and were not promoted into P1.3 dimension claims."
      });
    }

    const materialized = {
      schema: "urn:uu-aap:interactive-verifier-input:0.1",
      artifact: clone(adapterResult.artifact),
      evidence_items: [...clone(adapterResult.evidence_items), acceptanceReceipt],
      dimension_claims: dimensionClaims,
      related_observations: {
        candidate_acceptance: {
          event_id: event.id,
          actor_ref: event.actor_ref,
          scope: event.scope,
          accepted_candidate_ids: clone(accepted),
          rejected_candidate_ids: clone(rejected),
          deferred_candidate_ids: clone(deferred)
        }
      },
      warnings,
      disputes: []
    };
    interactiveApi().validateInteractiveInput(materialized);

    const result = {
      schema: RESULT_SCHEMA,
      artifact: clone(adapterResult.artifact),
      adapter_result: clone(adapterResult),
      acceptance_event: clone(event),
      accepted_candidate_ids: accepted,
      rejected_candidate_ids: rejected,
      deferred_candidate_ids: deferred,
      materialized_interactive_input: materialized,
      acceptance_policy: {
        all_candidates_require_explicit_disposition: true,
        single_accept_per_dimension_required: true,
        actor_ref_establishes_identity: false,
        actor_ref_establishes_authority: false,
        acceptance_strengthens_claim_semantics: false,
        auto_acceptance_permitted: false,
        cross_dimension_promotion_permitted: false,
        truth_promotion_permitted: false,
        aggregate_score_permitted: false,
        aggregate_verdict_permitted: false
      },
      aggregate_score_present: false,
      aggregate_verdict_present: false
    };
    validateAcceptanceResult(result);
    return result;
  }

  function validateAcceptanceResult(result) {
    exactKeys(result, [
      "schema", "artifact", "adapter_result", "acceptance_event",
      "accepted_candidate_ids", "rejected_candidate_ids", "deferred_candidate_ids",
      "materialized_interactive_input", "acceptance_policy",
      "aggregate_score_present", "aggregate_verdict_present"
    ], "acceptance result");
    assert(result.schema === RESULT_SCHEMA, "unsupported acceptance result schema");
    adapterApi().validateResult(result.adapter_result);
    validateAcceptanceEvent(result.acceptance_event, result.adapter_result);
    assert(JSON.stringify(result.artifact) === JSON.stringify(result.adapter_result.artifact), "acceptance result artifact changed");

    const { index: candidates, order } = candidateIndex(result.adapter_result);
    const groups = [result.accepted_candidate_ids, result.rejected_candidate_ids, result.deferred_candidate_ids];
    groups.forEach((values) => {
      assert(Array.isArray(values), "candidate id group must be an array");
      assert(new Set(values).size === values.length, "duplicate candidate id in result group");
      values.forEach((candidateId) => assert(candidates.has(candidateId), `unknown result candidate id: ${candidateId}`));
    });
    const flattened = groups.flat();
    assert(new Set(flattened).size === flattened.length, "candidate appears in multiple disposition result groups");
    assert(flattened.length === order.length && order.every((candidateId) => flattened.includes(candidateId)), "candidate disposition result set changed");

    const decisions = new Map(result.acceptance_event.dispositions.map((item) => [item.candidate_id, item.decision]));
    assert(JSON.stringify(result.accepted_candidate_ids) === JSON.stringify(order.filter((candidateId) => decisions.get(candidateId) === "ACCEPT")), "accepted candidate order changed");
    assert(JSON.stringify(result.rejected_candidate_ids) === JSON.stringify(order.filter((candidateId) => decisions.get(candidateId) === "REJECT")), "rejected candidate order changed");
    assert(JSON.stringify(result.deferred_candidate_ids) === JSON.stringify(order.filter((candidateId) => decisions.get(candidateId) === "DEFER")), "deferred candidate order changed");

    interactiveApi().validateInteractiveInput(result.materialized_interactive_input);
    const materialized = result.materialized_interactive_input;
    const receiptId = `evidence:${result.acceptance_event.id}`;
    assert(materialized.evidence_items.some((item) => item.id === receiptId), "acceptance receipt missing");

    const acceptedByDimension = new Map();
    result.accepted_candidate_ids.forEach((candidateId) => {
      const entry = candidates.get(candidateId);
      acceptedByDimension.set(entry.dimension, entry.candidate);
    });
    DIMENSION_ORDER.forEach((dimension) => {
      const claim = materialized.dimension_claims[dimension];
      const candidate = acceptedByDimension.get(dimension);
      if (!candidate) {
        assert(claim.value === "NOT_EVALUATED", `${dimension}: unaccepted candidate was materialized`);
        assert(claim.evaluation === "NOT_EVALUATED", `${dimension}: unaccepted evaluation`);
        assert(claim.evidence_refs.length === 0, `${dimension}: unaccepted evidence refs`);
        return;
      }
      const original = candidate.claim;
      assert(claim.value === original.value, `${dimension}: acceptance strengthened value`);
      assert(claim.evaluation === original.evaluation, `${dimension}: acceptance strengthened evaluation`);
      assert(claim.source_layer === original.source_layer, `${dimension}: source layer changed`);
      assert(claim.explanation === original.explanation, `${dimension}: explanation changed`);
      assert(JSON.stringify(claim.does_not_establish) === JSON.stringify(original.does_not_establish), `${dimension}: non-effects changed`);
      assert(JSON.stringify(claim.evidence_refs) === JSON.stringify([...original.evidence_refs, receiptId]), `${dimension}: acceptance evidence binding changed`);
    });

    exactKeys(result.acceptance_policy, [
      "all_candidates_require_explicit_disposition", "single_accept_per_dimension_required",
      "actor_ref_establishes_identity", "actor_ref_establishes_authority",
      "acceptance_strengthens_claim_semantics", "auto_acceptance_permitted",
      "cross_dimension_promotion_permitted", "truth_promotion_permitted",
      "aggregate_score_permitted", "aggregate_verdict_permitted"
    ], "acceptance_policy");
    assert(result.acceptance_policy.all_candidates_require_explicit_disposition === true, "all-candidate disposition policy");
    assert(result.acceptance_policy.single_accept_per_dimension_required === true, "single accept policy");
    [
      "actor_ref_establishes_identity", "actor_ref_establishes_authority",
      "acceptance_strengthens_claim_semantics", "auto_acceptance_permitted",
      "cross_dimension_promotion_permitted", "truth_promotion_permitted",
      "aggregate_score_permitted", "aggregate_verdict_permitted"
    ].forEach((key) => assert(result.acceptance_policy[key] === false, `${key} must remain false`));
    assert(result.aggregate_score_present === false, "aggregate score");
    assert(result.aggregate_verdict_present === false, "aggregate verdict");
  }

  function appendText(parent, tag, text) {
    const node = document.createElement(tag);
    node.textContent = String(text);
    parent.appendChild(node);
    return node;
  }

  function renderResult(result, target) {
    target.replaceChildren();
    appendText(target, "h2", "Explicit acceptance result");
    appendText(target, "p", `Acceptance event: ${result.acceptance_event.id}`);
    appendText(target, "p", `Actor reference: ${result.acceptance_event.actor_ref} — reference only, not identity or authority proof.`);
    appendText(target, "p", `Accepted: ${result.accepted_candidate_ids.join(", ") || "none"}`);
    appendText(target, "p", `Rejected: ${result.rejected_candidate_ids.join(", ") || "none"}`);
    appendText(target, "p", `Deferred: ${result.deferred_candidate_ids.join(", ") || "none"}`);

    appendText(target, "h2", "Materialized P1.3 dimension claims");
    DIMENSION_ORDER.forEach((dimension) => {
      const claim = result.materialized_interactive_input.dimension_claims[dimension];
      const section = document.createElement("section");
      appendText(section, "h3", dimension);
      appendText(section, "p", `Value: ${claim.value}`);
      appendText(section, "p", `Evaluation: ${claim.evaluation}`);
      appendText(section, "p", `Source layer: ${claim.source_layer}`);
      appendText(section, "p", claim.explanation);
      target.appendChild(section);
    });

    appendText(target, "h2", "Materialized P1.3 input JSON");
    appendText(target, "pre", JSON.stringify(result.materialized_interactive_input, null, 2));
    appendText(target, "h2", "Full acceptance result JSON");
    appendText(target, "pre", JSON.stringify(result, null, 2));
  }

  const api = {
    INPUT_SCHEMA,
    RESULT_SCHEMA,
    ACCEPTANCE_SCOPE,
    buildAcceptanceInput,
    validateAcceptanceInput,
    materializeCandidateAcceptance,
    validateAcceptanceResult
  };
  root.UUAAPCandidateAcceptance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    const textarea = document.getElementById("acceptance-input-json");
    const fileInput = document.getElementById("acceptance-file-input");
    const button = document.getElementById("materialize-button");
    const error = document.getElementById("acceptance-error");
    const resultTarget = document.getElementById("acceptance-result");

    if (fileInput && textarea) {
      fileInput.addEventListener("change", () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => { textarea.value = String(reader.result); });
        reader.readAsText(fileInput.files[0]);
      });
    }
    if (button && textarea && error && resultTarget) {
      button.addEventListener("click", () => {
        error.textContent = "";
        resultTarget.replaceChildren();
        try {
          const record = JSON.parse(textarea.value);
          renderResult(materializeCandidateAcceptance(record), resultTarget);
        } catch (caught) {
          error.textContent = `Acceptance validation failed: ${caught instanceof Error ? caught.message : String(caught)}`;
        }
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
