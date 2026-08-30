(() => {
  "use strict";

  const INPUT_SCHEMA = "urn:uu-aap:verifier-contestability-input:0.1";
  const RESULT_SCHEMA = "urn:uu-aap:verifier-contestability-result:0.1";
  const DIMENSION_ORDER = ["integrity", "identity", "provenance", "availability", "authority", "responsibility", "truth"];
  const RECORD_FIELDS = [
    "id", "kind", "dimension", "actor_ref", "recorded_at", "statement", "evidence_refs",
    "status", "response_status", "disposition", "related_record_id", "successor_claim",
  ];
  const EVIDENCE_FIELDS = ["id", "kind", "source_layer", "summary", "payload"];
  const CORRECTION_STATES = new Set(["PROPOSED", "APPLIED_SUCCESSOR"]);
  const DISPUTE_STATES = new Set(["OPEN", "RESPONDED", "RESOLVED", "UNRESOLVED"]);
  const APPEAL_STATES = new Set(["OPEN", "RESOLVED", "UNRESOLVED"]);
  const RESPONSE_STATES = new Set(["NONE", "RESPONSE_PRESENT"]);

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sortedKeys(value) {
    return Object.keys(value).sort();
  }

  function sameKeys(value, expected) {
    return JSON.stringify(sortedKeys(value)) === JSON.stringify([...expected].sort());
  }

  function validateEvidenceItems(items, baseIds) {
    assert(Array.isArray(items), "contestability_evidence_items must be an array");
    const ids = new Set();
    items.forEach((item, index) => {
      const label = `contestability_evidence_items[${index}]`;
      assert(item && typeof item === "object" && !Array.isArray(item), `${label} must be an object`);
      assert(sameKeys(item, EVIDENCE_FIELDS), `${label} fields changed`);
      for (const field of ["id", "kind", "source_layer", "summary"]) {
        assert(typeof item[field] === "string" && item[field].length > 0, `${label}.${field}`);
      }
      assert(item.payload && typeof item.payload === "object" && !Array.isArray(item.payload), `${label}.payload must be an object`);
      assert(!baseIds.has(item.id), `contestability evidence id collides with base evidence: ${item.id}`);
      assert(!ids.has(item.id), `duplicate contestability evidence id: ${item.id}`);
      ids.add(item.id);
    });
    return ids;
  }

  function validateSuccessorClaim(dimension, claim, base, contestabilityEvidence) {
    assert(claim && typeof claim === "object" && !Array.isArray(claim), `${dimension}: successor claim required`);
    const synthetic = clone(base);
    synthetic.evidence_items = [...clone(base.evidence_items), ...clone(contestabilityEvidence)];
    synthetic.dimension_claims[dimension] = clone(claim);
    globalThis.UUAAPInteractive.validateInteractiveInput(synthetic);
  }

  function validateRecord(record, index, evidenceIds, priorRecords, base, contestabilityEvidence) {
    const label = `records[${index}]`;
    assert(record && typeof record === "object" && !Array.isArray(record), `${label} must be an object`);
    assert(sameKeys(record, RECORD_FIELDS), `${label} fields changed`);
    assert(typeof record.id === "string" && record.id.length > 0, `${label}.id`);
    assert(!priorRecords.has(record.id), `duplicate contestability record id: ${record.id}`);
    assert(new Set(["CORRECTION", "DISPUTE", "APPEAL"]).has(record.kind), `${label}.kind`);
    assert(DIMENSION_ORDER.includes(record.dimension), `${label}.dimension`);
    assert(typeof record.actor_ref === "string" && record.actor_ref.length > 0, `${label}.actor_ref`);
    assert(typeof record.recorded_at === "string" && record.recorded_at.length > 0, `${label}.recorded_at`);
    assert(typeof record.statement === "string" && record.statement.length > 0, `${label}.statement`);
    assert(Array.isArray(record.evidence_refs), `${label}.evidence_refs`);
    assert(record.evidence_refs.every((ref) => typeof ref === "string" && ref.length > 0), `${label}.evidence_refs item`);
    assert(new Set(record.evidence_refs).size === record.evidence_refs.length, `${label}.evidence_refs duplicate`);
    for (const ref of record.evidence_refs) assert(evidenceIds.has(ref), `${label}: undeclared evidence ref: ${ref}`);

    if (record.kind === "CORRECTION") {
      assert(CORRECTION_STATES.has(record.status), `${label}.status`);
      assert(record.response_status === "NONE", `${label}: correction response_status must be NONE`);
      assert(new Set(["PENDING", "ACCEPTED", "REJECTED"]).has(record.disposition), `${label}.disposition`);
      assert(record.related_record_id === null, `${label}: correction related_record_id must be null`);
      validateSuccessorClaim(record.dimension, record.successor_claim, base, contestabilityEvidence);
      if (record.status === "APPLIED_SUCCESSOR") {
        assert(record.disposition === "ACCEPTED", `${label}: applied correction must be ACCEPTED`);
      } else {
        assert(new Set(["PENDING", "REJECTED"]).has(record.disposition), `${label}: proposed correction cannot be applied`);
      }
    } else if (record.kind === "DISPUTE") {
      assert(DISPUTE_STATES.has(record.status), `${label}.status`);
      assert(RESPONSE_STATES.has(record.response_status), `${label}.response_status`);
      assert(new Set(["PENDING", "UPHELD", "REJECTED", "UNRESOLVED"]).has(record.disposition), `${label}.disposition`);
      assert(record.related_record_id === null, `${label}: dispute related_record_id must be null`);
      assert(record.successor_claim === null, `${label}: dispute must not provide successor_claim`);
      if (new Set(["OPEN", "RESPONDED"]).has(record.status)) {
        assert(record.disposition === "PENDING", `${label}: open/responded dispute must remain PENDING`);
      } else if (record.status === "RESOLVED") {
        assert(new Set(["UPHELD", "REJECTED"]).has(record.disposition), `${label}: resolved dispute needs explicit disposition`);
      } else {
        assert(record.disposition === "UNRESOLVED", `${label}: unresolved dispute must remain UNRESOLVED`);
      }
    } else {
      assert(APPEAL_STATES.has(record.status), `${label}.status`);
      assert(RESPONSE_STATES.has(record.response_status), `${label}.response_status`);
      assert(new Set(["PENDING", "UPHELD", "REJECTED", "UNRESOLVED"]).has(record.disposition), `${label}.disposition`);
      assert(typeof record.related_record_id === "string" && record.related_record_id.length > 0, `${label}: appeal related_record_id required`);
      assert(priorRecords.has(record.related_record_id), `${label}: appeal must target a prior record`);
      const target = priorRecords.get(record.related_record_id);
      assert(new Set(["CORRECTION", "DISPUTE"]).has(target.kind), `${label}: appeal target kind`);
      assert(target.dimension === record.dimension, `${label}: appeal target dimension mismatch`);
      assert(record.successor_claim === null, `${label}: appeal must not provide successor_claim`);
      if (record.status === "OPEN") {
        assert(record.disposition === "PENDING", `${label}: open appeal must remain PENDING`);
      } else if (record.status === "RESOLVED") {
        assert(new Set(["UPHELD", "REJECTED"]).has(record.disposition), `${label}: resolved appeal needs explicit disposition`);
      } else {
        assert(record.disposition === "UNRESOLVED", `${label}: unresolved appeal must remain UNRESOLVED`);
      }
    }
  }

  function validateContestabilityInput(record) {
    assert(record && typeof record === "object" && !Array.isArray(record), "contestability input must be an object");
    assert(sameKeys(record, ["schema", "base_interactive_input", "contestability_evidence_items", "records"]), "contestability input fields changed");
    assert(record.schema === INPUT_SCHEMA, "unsupported contestability input schema");
    globalThis.UUAAPInteractive.validateInteractiveInput(record.base_interactive_input);

    const baseIds = new Set(record.base_interactive_input.evidence_items.map((item) => item.id));
    const contestIds = validateEvidenceItems(record.contestability_evidence_items, baseIds);
    const evidenceIds = new Set([...baseIds, ...contestIds]);
    assert(Array.isArray(record.records), "records must be an array");
    const prior = new Map();
    record.records.forEach((item, index) => {
      validateRecord(item, index, evidenceIds, prior, record.base_interactive_input, record.contestability_evidence_items);
      prior.set(item.id, item);
    });
  }

  function initialOverlay() {
    return {
      correction_status: "NONE",
      dispute_status: "NONE",
      appeal_status: "NONE",
      record_ids: [],
      historical_claims: [],
      successor_claim: null,
      unresolved_dispute_record_ids: [],
      active_appeal_record_ids: [],
    };
  }

  function deriveCorrectionStatus(records) {
    const statuses = records.filter((item) => item.kind === "CORRECTION").map((item) => item.status);
    if (!statuses.length) return "NONE";
    if (statuses.includes("APPLIED_SUCCESSOR")) return "APPLIED_SUCCESSOR";
    return "PROPOSED";
  }

  function deriveDisputeStatus(records) {
    const statuses = records.filter((item) => item.kind === "DISPUTE").map((item) => item.status);
    if (!statuses.length) return "NONE";
    if (statuses.includes("UNRESOLVED")) return "UNRESOLVED";
    if (statuses.includes("OPEN")) return "OPEN";
    if (statuses.includes("RESPONDED")) return "RESPONDED";
    return "RESOLVED";
  }

  function deriveAppealStatus(records) {
    const statuses = records.filter((item) => item.kind === "APPEAL").map((item) => item.status);
    if (!statuses.length) return "NONE";
    if (statuses.includes("UNRESOLVED")) return "UNRESOLVED";
    if (statuses.includes("OPEN")) return "OPEN";
    return "RESOLVED";
  }

  function materializeContestabilityOverlay(record) {
    validateContestabilityInput(record);
    const base = record.base_interactive_input;
    const currentClaims = Object.fromEntries(DIMENSION_ORDER.map((name) => [name, clone(base.dimension_claims[name])]));
    const overlay = Object.fromEntries(DIMENSION_ORDER.map((name) => [name, initialOverlay()]));
    const history = [];
    const recordsByDimension = Object.fromEntries(DIMENSION_ORDER.map((name) => [name, []]));

    for (const item of record.records) {
      const copied = clone(item);
      history.push(copied);
      const dimension = item.dimension;
      const dimensionRecords = recordsByDimension[dimension];
      dimensionRecords.push(copied);
      const state = overlay[dimension];
      state.record_ids.push(item.id);

      if (item.kind === "CORRECTION" && item.status === "APPLIED_SUCCESSOR") {
        state.historical_claims.push(clone(currentClaims[dimension]));
        currentClaims[dimension] = clone(item.successor_claim);
        state.successor_claim = clone(item.successor_claim);
      }
      if (item.kind === "DISPUTE" && new Set(["OPEN", "UNRESOLVED"]).has(item.status)) {
        state.unresolved_dispute_record_ids.push(item.id);
      }
      if (item.kind === "APPEAL" && new Set(["OPEN", "UNRESOLVED"]).has(item.status)) {
        state.active_appeal_record_ids.push(item.id);
      }
      state.correction_status = deriveCorrectionStatus(dimensionRecords);
      state.dispute_status = deriveDisputeStatus(dimensionRecords);
      state.appeal_status = deriveAppealStatus(dimensionRecords);
    }

    return {
      schema: RESULT_SCHEMA,
      artifact: clone(base.artifact),
      base_interactive_input: clone(base),
      dimension_order: [...DIMENSION_ORDER],
      current_dimension_claims: currentClaims,
      contestability_evidence_items: clone(record.contestability_evidence_items),
      contestability_overlay: overlay,
      history,
      contestability_policy: {
        overlay_is_verifier_dimension: false,
        dispute_mutates_claim: false,
        appeal_mutates_claim: false,
        correction_preserves_history: true,
        actor_ref_establishes_identity: false,
        actor_ref_establishes_authority: false,
        correction_establishes_truth: false,
        unresolved_disagreement_permitted: true,
        forced_consensus_permitted: false,
        reputation_penalty_inference_permitted: false,
        aggregate_score_permitted: false,
        aggregate_verdict_permitted: false,
      },
      aggregate_score_present: false,
      aggregate_verdict_present: false,
    };
  }

  function addText(parent, tag, text) {
    const node = document.createElement(tag);
    node.textContent = String(text);
    parent.appendChild(node);
    return node;
  }

  function renderResult(result, container) {
    container.replaceChildren();
    addText(container, "h2", "Contestability overlay result");
    addText(container, "p", `Artifact: ${result.artifact.id}`);
    for (const dimension of DIMENSION_ORDER) {
      const section = document.createElement("section");
      section.dataset.dimension = dimension;
      const claim = result.current_dimension_claims[dimension];
      const state = result.contestability_overlay[dimension];
      addText(section, "h3", dimension);
      addText(section, "p", `Current value: ${claim.value}`);
      addText(section, "p", `Evaluation: ${claim.evaluation}`);
      addText(section, "p", `Correction: ${state.correction_status}`);
      addText(section, "p", `Dispute: ${state.dispute_status}`);
      addText(section, "p", `Appeal: ${state.appeal_status}`);
      addText(section, "p", `Historical claims preserved: ${state.historical_claims.length}`);
      container.appendChild(section);
    }
    const history = document.createElement("section");
    addText(history, "h3", "Contestability history");
    for (const item of result.history) {
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(item, null, 2);
      history.appendChild(pre);
    }
    container.appendChild(history);
    const raw = document.createElement("pre");
    raw.textContent = JSON.stringify(result, null, 2);
    container.appendChild(raw);
  }

  function installUi() {
    const textarea = document.getElementById("contestability-input-json");
    const fileInput = document.getElementById("contestability-file-input");
    const button = document.getElementById("contestability-button");
    const errorBox = document.getElementById("contestability-error");
    const resultBox = document.getElementById("contestability-result");
    if (!textarea || !fileInput || !button || !errorBox || !resultBox) return;

    button.addEventListener("click", () => {
      errorBox.textContent = "";
      resultBox.replaceChildren();
      try {
        const input = JSON.parse(textarea.value);
        const result = materializeContestabilityOverlay(input);
        renderResult(result, resultBox);
      } catch (error) {
        errorBox.textContent = `Validation failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    });

    fileInput.addEventListener("change", () => {
      const selected = fileInput.files && fileInput.files[0];
      if (!selected) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        textarea.value = typeof reader.result === "string" ? reader.result : "";
        errorBox.textContent = "Local file loaded. Select Apply contestability overlay to process it.";
        resultBox.replaceChildren();
      });
      reader.addEventListener("error", () => {
        errorBox.textContent = "Could not read the selected local file.";
      });
      reader.readAsText(selected);
    });
  }

  globalThis.UUAAPContestability = {
    DIMENSION_ORDER,
    materializeContestabilityOverlay,
    validateContestabilityInput,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", installUi, { once: true });
    } else {
      installUi();
    }
  }
})();
