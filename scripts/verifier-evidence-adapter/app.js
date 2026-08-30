(function (root) {
  "use strict";

  const DIMENSION_ORDER = ["integrity", "identity", "provenance", "availability", "authority", "responsibility", "truth"];
  const INPUT_SCHEMA = "urn:uu-aap:evidence-adapter-input:0.1";
  const RESULT_SCHEMA = "urn:uu-aap:evidence-adapter-result:0.1";
  const REGISTRY = {
    "c2pa.provenance.v0.1": { dimension: "provenance", source_layer: "C2PA" },
    "poai.availability.v0.1": { dimension: "availability", source_layer: "PoAI" },
    "uuaap.authority.v0.1": { dimension: "authority", source_layer: "UU-AAP" },
    "uuaap.responsibility.v0.1": { dimension: "responsibility", source_layer: "UU-AAP" }
  };
  const FORBIDDEN_KEYS = new Set([
    "overall_trust", "trust_score", "truth_score", "reputation_score",
    "reliability_score", "confidence_score", "compatibility_score",
    "overall_verdict", "verified", "verified_true"
  ]);

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

  function scanSemantic(value, path) {
    if (Array.isArray(value)) {
      value.forEach((child, index) => scanSemantic(child, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      const normalized = key.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
      if (normalized === "aggregate_score_present" || normalized === "aggregate_verdict_present") {
        assert(child === false, `${childPath} must remain false`);
      } else {
        assert(!FORBIDDEN_KEYS.has(normalized), `forbidden aggregate/verdict field: ${childPath}`);
      }
      scanSemantic(child, childPath);
    });
  }

  function semanticProjection(value) {
    const projected = clone(value);
    ["observations", "evidence_items"].forEach((key) => {
      (projected[key] || []).forEach((item) => {
        if (item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, "payload")) {
          item.payload = {};
        }
      });
    });
    return projected;
  }

  function validateDimension(name, dimension) {
    exactKeys(dimension, ["value", "evaluation", "source_layer", "evidence_refs", "explanation", "does_not_establish"], `${name} claim`);
    assert(typeof dimension.value === "string" && dimension.value, `${name}: value`);
    assert(["OBSERVED", "SUPPORTED", "NOT_SUPPORTED", "UNKNOWN", "NOT_EVALUATED", "NOT_APPLICABLE"].includes(dimension.evaluation), `${name}: evaluation`);
    assert(typeof dimension.source_layer === "string" && dimension.source_layer, `${name}: source_layer`);
    assert(Array.isArray(dimension.evidence_refs), `${name}: evidence_refs`);
    assert(typeof dimension.explanation === "string" && dimension.explanation, `${name}: explanation`);
    assert(Array.isArray(dimension.does_not_establish) && dimension.does_not_establish.length > 0, `${name}: does_not_establish`);
    if (dimension.evaluation === "NOT_EVALUATED") {
      assert(dimension.value === "NOT_EVALUATED", `${name}: NOT_EVALUATED value`);
      assert(dimension.evidence_refs.length === 0, `${name}: NOT_EVALUATED evidence`);
    } else {
      assert(dimension.evidence_refs.length > 0, `${name}: evidence required`);
    }
  }

  function validateInput(record) {
    exactKeys(record, ["schema", "artifact", "observations"], "adapter input");
    assert(record.schema === INPUT_SCHEMA, "unsupported adapter input schema");
    exactKeys(record.artifact, ["id", "description"], "artifact");
    assert(typeof record.artifact.id === "string" && record.artifact.id, "artifact.id");
    assert(typeof record.artifact.description === "string" && record.artifact.description, "artifact.description");
    assert(Array.isArray(record.observations), "observations must be an array");
    const seen = new Set();
    record.observations.forEach((observation, index) => {
      const label = `observations[${index}]`;
      exactKeys(observation, ["id", "adapter_id", "source_layer", "summary", "loss_notes", "payload"], label);
      ["id", "adapter_id", "source_layer", "summary"].forEach((field) => {
        assert(typeof observation[field] === "string" && observation[field], `${label}.${field}`);
      });
      assert(Array.isArray(observation.loss_notes), `${label}.loss_notes`);
      observation.loss_notes.forEach((item) => assert(typeof item === "string" && item, `${label}.loss_notes item`));
      assert(observation.payload && typeof observation.payload === "object" && !Array.isArray(observation.payload), `${label}.payload`);
      assert(!seen.has(observation.id), `duplicate observation id: ${observation.id}`);
      seen.add(observation.id);
    });
    scanSemantic(semanticProjection(record), "");
  }

  function makeClaim(value, evaluation, sourceLayer, evidenceRef, explanation, nonEffects) {
    const claim = {
      value,
      evaluation,
      source_layer: sourceLayer,
      evidence_refs: [evidenceRef],
      explanation,
      does_not_establish: nonEffects
    };
    validateDimension("candidate", claim);
    return claim;
  }

  function adaptKnown(observation) {
    const payload = observation.payload;
    const evidenceRef = `evidence:${observation.id}`;

    if (observation.adapter_id === "c2pa.provenance.v0.1") {
      ["success", "hasCredentials", "manifestData_present"].forEach((field) => {
        assert(Object.prototype.hasOwnProperty.call(payload, field), `${observation.id}: missing C2PA payload field ${field}`);
        assert(typeof payload[field] === "boolean", `${observation.id}: ${field} must be boolean`);
      });
      if (!payload.success) {
        return {
          claim: null,
          warnings: [{ code: "C2PA_ADAPTER_NO_SUCCESS_RESULT", message: `${observation.id}: C2PA observation did not report successful inspection; no provenance candidate emitted.` }]
        };
      }
      if (payload.hasCredentials && payload.manifestData_present) {
        return {
          claim: makeClaim(
            "CREDENTIALS_PRESENT", "OBSERVED", "C2PA", evidenceRef,
            "The bounded C2PA observation explicitly reports readable credentials and manifest data.",
            ["identity", "authorship", "decision-time availability", "authority", "responsibility", "factual truth"]
          ),
          warnings: []
        };
      }
      return {
        claim: makeClaim(
          "NO_SUPPORTED_CREDENTIALS_OBSERVED", "OBSERVED", "C2PA", evidenceRef,
          "The bounded C2PA observation completed without reporting both supported credentials and manifest data.",
          ["that the artifact was not generated by an AI system", "that provenance never existed", "identity", "authority", "responsibility", "factual truth"]
        ),
        warnings: [{ code: "C2PA_ABSENCE_INCONCLUSIVE", message: `${observation.id}: absence of a supported credential signal is inconclusive about origin.` }]
      };
    }

    if (observation.adapter_id === "poai.availability.v0.1") {
      assert(["available", "unavailable", "unknown"].includes(payload.overall_status), `${observation.id}: invalid PoAI overall_status`);
      assert(typeof payload.reason === "string" && payload.reason, `${observation.id}: PoAI reason required`);
      const values = {
        available: "AVAILABLE_BEFORE_CUTOFF",
        unavailable: "UNAVAILABLE_BEFORE_CUTOFF",
        unknown: "AVAILABILITY_UNKNOWN"
      };
      return {
        claim: makeClaim(
          values[payload.overall_status], "OBSERVED", "PoAI", evidenceRef, payload.reason,
          ["consideration", "reliance", "authority", "responsibility", "factual truth"]
        ),
        warnings: []
      };
    }

    if (observation.adapter_id === "uuaap.authority.v0.1") {
      assert(typeof payload.actor_id === "string" && payload.actor_id, `${observation.id}: actor_id required`);
      assert(["human", "ai_system", "organization", "other"].includes(payload.actor_type), `${observation.id}: invalid actor_type`);
      assert(Array.isArray(payload.scopes) && payload.scopes.length > 0, `${observation.id}: scopes required`);
      payload.scopes.forEach((item) => assert(typeof item === "string" && item, `${observation.id}: invalid scope`));
      assert(["accepted", "limited", "rejected", "unknown"].includes(payload.status), `${observation.id}: invalid status`);
      if (!["accepted", "limited"].includes(payload.status)) {
        return {
          claim: null,
          warnings: [{ code: "AUTHORITY_NOT_ACCEPTED", message: `${observation.id}: authority status is ${payload.status}; no authority candidate emitted.` }]
        };
      }
      const value = payload.status === "accepted" ? "SCOPED_AUTHORITY_ACCEPTED" : "SCOPED_AUTHORITY_LIMITED";
      return {
        claim: makeClaim(
          value, "OBSERVED", "UU-AAP", evidenceRef,
          `Declared ${payload.actor_type} actor ${payload.actor_id} has ${payload.status} authority scopes: ${payload.scopes.join(", ")}.`,
          ["identity beyond declared actor metadata", "authorship", "responsibility", "artifact integrity", "factual truth"]
        ),
        warnings: []
      };
    }

    if (observation.adapter_id === "uuaap.responsibility.v0.1") {
      assert(typeof payload.actor_id === "string" && payload.actor_id, `${observation.id}: actor_id required`);
      assert(typeof payload.scope === "string" && payload.scope, `${observation.id}: responsibility scope required`);
      assert(["accepted", "rejected", "unknown"].includes(payload.status), `${observation.id}: invalid status`);
      if (payload.status !== "accepted") {
        return {
          claim: null,
          warnings: [{ code: "RESPONSIBILITY_NOT_ACCEPTED", message: `${observation.id}: responsibility status is ${payload.status}; no responsibility candidate emitted.` }]
        };
      }
      return {
        claim: makeClaim(
          "SCOPED_RESPONSIBILITY_PRESENT", "OBSERVED", "UU-AAP", evidenceRef,
          `Declared actor ${payload.actor_id} accepts scoped responsibility: ${payload.scope}.`,
          ["identity beyond declared actor metadata", "authorship", "authority outside the declared scope", "artifact integrity", "factual truth"]
        ),
        warnings: []
      };
    }

    throw new Error(`registered adapter has no implementation: ${observation.adapter_id}`);
  }

  function validateResult(result) {
    exactKeys(result, [
      "schema", "artifact", "dimension_order", "evidence_items", "candidate_claims",
      "adapter_receipts", "unmapped_observations", "warnings", "adapter_policy",
      "aggregate_score_present", "aggregate_verdict_present"
    ], "adapter result");
    assert(result.schema === RESULT_SCHEMA, "unsupported adapter result schema");
    assert(JSON.stringify(result.dimension_order) === JSON.stringify(DIMENSION_ORDER), "dimension order changed");

    const evidenceIds = new Set();
    result.evidence_items.forEach((item, index) => {
      exactKeys(item, ["id", "kind", "source_layer", "summary", "payload"], `evidence_items[${index}]`);
      assert(!evidenceIds.has(item.id), `duplicate evidence id: ${item.id}`);
      evidenceIds.add(item.id);
      assert(item.payload && typeof item.payload === "object" && !Array.isArray(item.payload), `evidence_items[${index}].payload`);
    });

    exactKeys(result.candidate_claims, DIMENSION_ORDER, "candidate_claims");
    const candidateIds = new Set();
    DIMENSION_ORDER.forEach((dimension) => {
      const bucket = result.candidate_claims[dimension];
      assert(Array.isArray(bucket), `${dimension}: candidate bucket must be an array`);
      bucket.forEach((candidate) => {
        exactKeys(candidate, ["candidate_id", "adapter_id", "observation_id", "claim"], `${dimension} candidate`);
        assert(!candidateIds.has(candidate.candidate_id), `duplicate candidate id: ${candidate.candidate_id}`);
        candidateIds.add(candidate.candidate_id);
        assert(REGISTRY[candidate.adapter_id], `${dimension}: unknown adapter in candidate`);
        assert(REGISTRY[candidate.adapter_id].dimension === dimension, `${dimension}: adapter ${candidate.adapter_id} promoted outside allowlist`);
        validateDimension(dimension, candidate.claim);
        candidate.claim.evidence_refs.forEach((ref) => assert(evidenceIds.has(ref), `${dimension}: undeclared evidence ref ${ref}`));
      });
    });
    assert(result.candidate_claims.integrity.length === 0, "integrity candidates forbidden in v0.1");
    assert(result.candidate_claims.identity.length === 0, "identity candidates forbidden in v0.1");
    assert(result.candidate_claims.truth.length === 0, "truth candidates forbidden in v0.1");

    const receiptIds = new Set();
    result.adapter_receipts.forEach((receipt) => {
      exactKeys(receipt, ["adapter_id", "observation_id", "allowed_dimension", "status", "loss_notes"], "adapter receipt");
      assert(!receiptIds.has(receipt.observation_id), `duplicate receipt observation: ${receipt.observation_id}`);
      receiptIds.add(receipt.observation_id);
      assert(["CANDIDATE_EMITTED", "NO_CANDIDATE", "UNMAPPED"].includes(receipt.status), "invalid receipt status");
      assert(receipt.allowed_dimension === null || DIMENSION_ORDER.includes(receipt.allowed_dimension), "invalid allowed dimension");
      assert(Array.isArray(receipt.loss_notes), "receipt loss_notes");
    });

    assert(Array.isArray(result.unmapped_observations), "unmapped_observations must be an array");
    assert(new Set(result.unmapped_observations).size === result.unmapped_observations.length, "duplicate unmapped observation");
    result.warnings.forEach((warning) => exactKeys(warning, ["code", "message"], "warning"));

    exactKeys(result.adapter_policy, [
      "candidate_claims_require_explicit_acceptance", "auto_acceptance_permitted",
      "cross_dimension_promotion_permitted", "truth_promotion_permitted",
      "aggregate_score_permitted", "aggregate_verdict_permitted"
    ], "adapter_policy");
    assert(result.adapter_policy.candidate_claims_require_explicit_acceptance === true, "candidate acceptance gate");
    ["auto_acceptance_permitted", "cross_dimension_promotion_permitted", "truth_promotion_permitted", "aggregate_score_permitted", "aggregate_verdict_permitted"].forEach((key) => {
      assert(result.adapter_policy[key] === false, `${key} must remain false`);
    });
    assert(result.aggregate_score_present === false, "aggregate score");
    assert(result.aggregate_verdict_present === false, "aggregate verdict");
    scanSemantic(semanticProjection(result), "");
  }

  function adaptEvidence(record) {
    validateInput(record);
    const candidateClaims = {};
    DIMENSION_ORDER.forEach((name) => { candidateClaims[name] = []; });
    const evidenceItems = [];
    const adapterReceipts = [];
    const unmapped = [];
    const warnings = [];
    const candidateIds = new Set();

    record.observations.forEach((observation) => {
      evidenceItems.push({
        id: `evidence:${observation.id}`,
        kind: observation.adapter_id,
        source_layer: observation.source_layer,
        summary: observation.summary,
        payload: clone(observation.payload)
      });
      const spec = REGISTRY[observation.adapter_id];
      if (!spec) {
        unmapped.push(observation.id);
        adapterReceipts.push({
          adapter_id: observation.adapter_id,
          observation_id: observation.id,
          allowed_dimension: null,
          status: "UNMAPPED",
          loss_notes: clone(observation.loss_notes)
        });
        warnings.push({
          code: "UNKNOWN_ADAPTER",
          message: `${observation.id}: adapter ${observation.adapter_id} is not registered; observation preserved without a candidate claim.`
        });
        return;
      }

      assert(observation.source_layer === spec.source_layer, `${observation.id}: source_layer ${observation.source_layer} does not match adapter ${observation.adapter_id}`);
      const adapted = adaptKnown(observation);
      adapted.warnings.forEach((warning) => warnings.push(warning));
      let status = "NO_CANDIDATE";
      if (adapted.claim) {
        const candidateId = `candidate:${observation.id}:${spec.dimension}`;
        assert(!candidateIds.has(candidateId), `duplicate candidate id: ${candidateId}`);
        candidateIds.add(candidateId);
        candidateClaims[spec.dimension].push({
          candidate_id: candidateId,
          adapter_id: observation.adapter_id,
          observation_id: observation.id,
          claim: adapted.claim
        });
        status = "CANDIDATE_EMITTED";
      }
      adapterReceipts.push({
        adapter_id: observation.adapter_id,
        observation_id: observation.id,
        allowed_dimension: spec.dimension,
        status,
        loss_notes: clone(observation.loss_notes)
      });
    });

    const result = {
      schema: RESULT_SCHEMA,
      artifact: clone(record.artifact),
      dimension_order: [...DIMENSION_ORDER],
      evidence_items: evidenceItems,
      candidate_claims: candidateClaims,
      adapter_receipts: adapterReceipts,
      unmapped_observations: unmapped,
      warnings,
      adapter_policy: {
        candidate_claims_require_explicit_acceptance: true,
        auto_acceptance_permitted: false,
        cross_dimension_promotion_permitted: false,
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

  function appendText(parent, tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function renderResult(result, target) {
    target.textContent = "";
    appendText(target, "h2", "Candidate claims — not accepted verifier claims");
    DIMENSION_ORDER.forEach((dimension) => {
      const section = document.createElement("section");
      appendText(section, "h3", dimension);
      const bucket = result.candidate_claims[dimension];
      if (bucket.length === 0) {
        appendText(section, "p", "No candidate emitted.");
      } else {
        bucket.forEach((candidate) => {
          appendText(section, "p", `${candidate.claim.value} (${candidate.claim.evaluation}) via ${candidate.adapter_id}`);
          appendText(section, "p", candidate.claim.explanation);
        });
      }
      target.appendChild(section);
    });
    appendText(target, "h2", "Adapter receipts");
    result.adapter_receipts.forEach((receipt) => {
      appendText(target, "p", `${receipt.observation_id}: ${receipt.status}; allowed dimension: ${receipt.allowed_dimension === null ? "none" : receipt.allowed_dimension}`);
    });
    appendText(target, "h2", "Warnings");
    if (result.warnings.length === 0) appendText(target, "p", "None.");
    result.warnings.forEach((warning) => appendText(target, "p", `${warning.code}: ${warning.message}`));
    appendText(target, "h2", "Normalized adapter result JSON");
    appendText(target, "pre", JSON.stringify(result, null, 2));
  }

  const api = { DIMENSION_ORDER, INPUT_SCHEMA, RESULT_SCHEMA, REGISTRY, validateInput, adaptEvidence, validateResult };
  root.UUAAPEvidenceAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    const input = document.getElementById("adapter-input-json");
    const file = document.getElementById("adapter-file-input");
    const button = document.getElementById("adapt-button");
    const error = document.getElementById("adapter-error");
    const resultTarget = document.getElementById("adapter-result");

    if (file && input) {
      file.addEventListener("change", () => {
        if (!file.files || file.files.length === 0) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => { input.value = String(reader.result); });
        reader.readAsText(file.files[0]);
      });
    }
    if (button && input && error && resultTarget) {
      button.addEventListener("click", () => {
        error.textContent = "";
        resultTarget.textContent = "";
        try {
          const record = JSON.parse(input.value);
          renderResult(adaptEvidence(record), resultTarget);
        } catch (caught) {
          error.textContent = `Adapter validation failed: ${caught instanceof Error ? caught.message : String(caught)}`;
        }
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
