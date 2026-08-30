(function (root) {
  "use strict";

  const DIMENSION_ORDER = ["integrity", "identity", "provenance", "availability", "authority", "responsibility", "truth"];
  const INPUT_SCHEMA = "urn:uu-aap:candidate-source-federation-input:0.1";
  const RESULT_SCHEMA = "urn:uu-aap:federated-candidate-set:0.1";
  const SOURCE_FAMILIES = ["P1.4_ADAPTER", "P1.8_ATTESTATION"];
  const ADAPTER_RESULT_SCHEMA = "urn:uu-aap:evidence-adapter-result:0.1";
  const ATTESTATION_RESULT_SCHEMA = "urn:uu-aap:scoped-attestation-bridge-result:0.1";

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function exactKeys(value, expected, label) {
    assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    assert(JSON.stringify(actual) === JSON.stringify(wanted), `${label} fields changed: ${actual.join(",")}`);
  }

  function sourceApis() {
    const adapter = root.UUAAPEvidenceAdapter;
    const attest = root.UUAAPAttestations;
    assert(adapter && typeof adapter.validateResult === "function", "P1.4 browser validator is required");
    assert(attest && typeof attest.validateResult === "function", "P1.8 browser validator is required");
    return { adapter, attest };
  }

  function validateSourceOrder(value) {
    assert(Array.isArray(value) && value.length === 2, "source_order must contain exactly two source families");
    assert(new Set(value).size === 2, "source_order contains a duplicate source family");
    assert(value.every((item) => SOURCE_FAMILIES.includes(item)), "source_order contains an unsupported family");
  }

  function validateInput(record) {
    exactKeys(record, ["schema", "source_order", "adapter_result", "attestation_result"], "federation input");
    assert(record.schema === INPUT_SCHEMA, "unsupported federation input schema");
    validateSourceOrder(record.source_order);
    const { adapter, attest } = sourceApis();
    adapter.validateResult(record.adapter_result);
    attest.validateResult(record.attestation_result);
    assert(deepEqual(record.adapter_result.artifact, record.attestation_result.artifact), "P1.4 and P1.8 sources must describe the same artifact");
  }

  function buildSourceBuckets(record) {
    const buckets = {
      "P1.4_ADAPTER": Object.fromEntries(DIMENSION_ORDER.map((name) => [name, []])),
      "P1.8_ATTESTATION": Object.fromEntries(DIMENSION_ORDER.map((name) => [name, []]))
    };
    DIMENSION_ORDER.forEach((dimension) => {
      record.adapter_result.candidate_claims[dimension].forEach((candidate) => {
        buckets["P1.4_ADAPTER"][dimension].push({
          federated_candidate_id: `federated:P1.4_ADAPTER:${candidate.candidate_id}`,
          source_family: "P1.4_ADAPTER",
          source_candidate_id: candidate.candidate_id,
          source_observation_id: candidate.observation_id,
          source_record_schema: ADAPTER_RESULT_SCHEMA,
          dimension,
          claim: clone(candidate.claim)
        });
      });
    });
    record.attestation_result.identity_candidates.forEach((candidate) => {
      buckets["P1.8_ATTESTATION"].identity.push({
        federated_candidate_id: `federated:P1.8_ATTESTATION:${candidate.candidate_id}`,
        source_family: "P1.8_ATTESTATION",
        source_candidate_id: candidate.candidate_id,
        source_observation_id: candidate.observation_id,
        source_record_schema: ATTESTATION_RESULT_SCHEMA,
        dimension: "identity",
        claim: clone(candidate.claim)
      });
    });
    return buckets;
  }

  function sourceIndex(result) {
    const index = new Map();
    const adapter = result.source_results["P1.4_ADAPTER"];
    DIMENSION_ORDER.forEach((dimension) => {
      adapter.candidate_claims[dimension].forEach((candidate) => {
        index.set(`P1.4_ADAPTER\u0000${candidate.candidate_id}`, {
          dimension,
          claim: candidate.claim,
          observation_id: candidate.observation_id
        });
      });
    });
    result.source_results["P1.8_ATTESTATION"].identity_candidates.forEach((candidate) => {
      index.set(`P1.8_ATTESTATION\u0000${candidate.candidate_id}`, {
        dimension: "identity",
        claim: candidate.claim,
        observation_id: candidate.observation_id
      });
    });
    return index;
  }

  function expectedWarnings(result) {
    return [
      ...result.source_results["P1.4_ADAPTER"].warnings.map((item) => ({
        source_family: "P1.4_ADAPTER", code: item.code, message: item.message
      })),
      ...result.source_results["P1.8_ATTESTATION"].warnings.map((item) => ({
        source_family: "P1.8_ATTESTATION", code: item.code, message: item.message
      }))
    ];
  }

  function validateResult(result) {
    exactKeys(result, [
      "schema", "artifact", "dimension_order", "source_order", "source_results",
      "candidate_buckets", "auxiliary_attestations", "source_warnings", "federation_policy",
      "aggregate_score_present", "aggregate_verdict_present"
    ], "federation result");
    assert(result.schema === RESULT_SCHEMA, "unsupported federation result schema");
    assert(deepEqual(result.dimension_order, DIMENSION_ORDER), "dimension order changed");
    validateSourceOrder(result.source_order);
    exactKeys(result.source_results, SOURCE_FAMILIES, "source_results");
    const { adapter, attest } = sourceApis();
    adapter.validateResult(result.source_results["P1.4_ADAPTER"]);
    attest.validateResult(result.source_results["P1.8_ATTESTATION"]);
    assert(deepEqual(result.artifact, result.source_results["P1.4_ADAPTER"].artifact), "adapter artifact changed");
    assert(deepEqual(result.artifact, result.source_results["P1.8_ATTESTATION"].artifact), "attestation artifact changed");
    exactKeys(result.candidate_buckets, DIMENSION_ORDER, "candidate_buckets");

    const index = sourceIndex(result);
    const seenFederated = new Set();
    const seenSource = new Set();
    DIMENSION_ORDER.forEach((dimension) => {
      const bucket = result.candidate_buckets[dimension];
      assert(Array.isArray(bucket), `${dimension} candidate bucket must be an array`);
      bucket.forEach((item) => {
        exactKeys(item, [
          "federated_candidate_id", "source_family", "source_candidate_id",
          "source_observation_id", "source_record_schema", "dimension", "claim"
        ], `${dimension} federated candidate`);
        assert(item.dimension === dimension, `${dimension}: candidate crossed dimension`);
        assert(SOURCE_FAMILIES.includes(item.source_family), `${dimension}: unknown source family`);
        const sourceKey = `${item.source_family}\u0000${item.source_candidate_id}`;
        assert(index.has(sourceKey), `${dimension}: unknown source candidate`);
        const expected = index.get(sourceKey);
        assert(expected.dimension === dimension, `${dimension}: source candidate dimension changed`);
        assert(item.source_observation_id === expected.observation_id, `${dimension}: source observation changed`);
        const expectedSchema = item.source_family === "P1.4_ADAPTER" ? ADAPTER_RESULT_SCHEMA : ATTESTATION_RESULT_SCHEMA;
        assert(item.source_record_schema === expectedSchema, `${dimension}: source schema changed`);
        assert(deepEqual(item.claim, expected.claim), `${dimension}: federation changed candidate semantics`);
        assert(item.federated_candidate_id === `federated:${item.source_family}:${item.source_candidate_id}`, `${dimension}: unstable federated id`);
        assert(!seenFederated.has(item.federated_candidate_id), "duplicate federated candidate id");
        assert(!seenSource.has(sourceKey), "source candidate duplicated during federation");
        seenFederated.add(item.federated_candidate_id);
        seenSource.add(sourceKey);
      });
    });
    assert(seenSource.size === index.size, "federation omitted one or more source candidates");

    exactKeys(result.auxiliary_attestations, ["role_attestations", "review_attestations"], "auxiliary_attestations");
    assert(deepEqual(result.auxiliary_attestations.role_attestations, result.source_results["P1.8_ATTESTATION"].role_attestations), "role attestations changed");
    assert(deepEqual(result.auxiliary_attestations.review_attestations, result.source_results["P1.8_ATTESTATION"].review_attestations), "review attestations changed");

    assert(Array.isArray(result.source_warnings), "source_warnings must be an array");
    result.source_warnings.forEach((warning) => {
      exactKeys(warning, ["source_family", "code", "message"], "source warning");
      assert(SOURCE_FAMILIES.includes(warning.source_family), "source warning family");
    });
    assert(deepEqual(result.source_warnings, expectedWarnings(result)), "source warnings changed or lost");

    exactKeys(result.federation_policy, [
      "federation_performs_acceptance", "source_count_establishes_confidence",
      "source_order_establishes_priority", "same_dimension_candidates_imply_consensus",
      "multiple_sources_imply_independent_witnesses", "cross_dimension_promotion_permitted",
      "auxiliary_attestations_are_candidates", "identity_to_authority_promotion_permitted",
      "truth_promotion_permitted", "aggregate_score_permitted", "aggregate_verdict_permitted"
    ], "federation_policy");
    Object.entries(result.federation_policy).forEach(([key, value]) => assert(value === false, `${key} must remain false`));
    assert(result.aggregate_score_present === false, "aggregate score must remain false");
    assert(result.aggregate_verdict_present === false, "aggregate verdict must remain false");
  }

  function federateCandidateSources(record) {
    validateInput(record);
    const perSource = buildSourceBuckets(record);
    const buckets = Object.fromEntries(DIMENSION_ORDER.map((name) => [name, []]));
    record.source_order.forEach((family) => {
      DIMENSION_ORDER.forEach((dimension) => {
        buckets[dimension].push(...clone(perSource[family][dimension]));
      });
    });
    const result = {
      schema: RESULT_SCHEMA,
      artifact: clone(record.adapter_result.artifact),
      dimension_order: [...DIMENSION_ORDER],
      source_order: clone(record.source_order),
      source_results: {
        "P1.4_ADAPTER": clone(record.adapter_result),
        "P1.8_ATTESTATION": clone(record.attestation_result)
      },
      candidate_buckets: buckets,
      auxiliary_attestations: {
        role_attestations: clone(record.attestation_result.role_attestations),
        review_attestations: clone(record.attestation_result.review_attestations)
      },
      source_warnings: [
        ...record.adapter_result.warnings.map((item) => ({source_family: "P1.4_ADAPTER", code: item.code, message: item.message})),
        ...record.attestation_result.warnings.map((item) => ({source_family: "P1.8_ATTESTATION", code: item.code, message: item.message}))
      ],
      federation_policy: {
        federation_performs_acceptance: false,
        source_count_establishes_confidence: false,
        source_order_establishes_priority: false,
        same_dimension_candidates_imply_consensus: false,
        multiple_sources_imply_independent_witnesses: false,
        cross_dimension_promotion_permitted: false,
        auxiliary_attestations_are_candidates: false,
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

  function appendText(parent, tag, text) {
    const node = document.createElement(tag);
    node.textContent = String(text);
    parent.appendChild(node);
    return node;
  }

  function renderResult(result, target) {
    target.replaceChildren();
    appendText(target, "h2", "Federated candidates — no acceptance or ranking");
    DIMENSION_ORDER.forEach((dimension) => {
      const section = document.createElement("section");
      appendText(section, "h3", dimension);
      const bucket = result.candidate_buckets[dimension];
      if (bucket.length === 0) appendText(section, "p", "No candidate supplied.");
      bucket.forEach((candidate) => {
        appendText(section, "p", `${candidate.claim.value} (${candidate.claim.evaluation}) — ${candidate.source_family} / ${candidate.source_candidate_id}`);
        appendText(section, "p", candidate.claim.explanation);
      });
      target.appendChild(section);
    });
    appendText(target, "h2", "Auxiliary attestations — not candidates");
    appendText(target, "p", `Roles: ${result.auxiliary_attestations.role_attestations.length}; reviews: ${result.auxiliary_attestations.review_attestations.length}`);
    appendText(target, "h2", "Source-qualified warnings");
    if (result.source_warnings.length === 0) appendText(target, "p", "None.");
    result.source_warnings.forEach((warning) => appendText(target, "p", `${warning.source_family} / ${warning.code}: ${warning.message}`));
    appendText(target, "h2", "Federated candidate JSON");
    appendText(target, "pre", JSON.stringify(result, null, 2));
  }

  const api = {
    DIMENSION_ORDER,
    INPUT_SCHEMA,
    RESULT_SCHEMA,
    SOURCE_FAMILIES,
    validateInput,
    validateResult,
    federateCandidateSources
  };
  root.UUAAPCandidateFederation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    const input = document.getElementById("federation-input-json");
    const file = document.getElementById("federation-file-input");
    const button = document.getElementById("federation-button");
    const error = document.getElementById("federation-error");
    const resultTarget = document.getElementById("federation-result");
    if (file && input) {
      file.addEventListener("change", () => {
        const selected = file.files && file.files[0];
        if (!selected) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          input.value = typeof reader.result === "string" ? reader.result : "";
          if (error) error.textContent = "Local file loaded. Select Federate candidate sources to process it.";
          if (resultTarget) resultTarget.replaceChildren();
        });
        reader.readAsText(selected);
      });
    }
    if (button && input && error && resultTarget) {
      button.addEventListener("click", () => {
        error.textContent = "";
        resultTarget.replaceChildren();
        try {
          renderResult(federateCandidateSources(JSON.parse(input.value)), resultTarget);
        } catch (caught) {
          error.textContent = `Federation validation failed: ${caught instanceof Error ? caught.message : String(caught)}`;
        }
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
