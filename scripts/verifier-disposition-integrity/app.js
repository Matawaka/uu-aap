(function (root) {
  "use strict";

  const INPUT_SCHEMA = "urn:uu-aap:federated-disposition-integrity-input:0.1";
  const RESULT_SCHEMA = "urn:uu-aap:federated-disposition-integrity-result:0.1";
  const P1_10_RESULT_SCHEMA = "urn:uu-aap:federated-candidate-disposition-result:0.1";
  const PREDECESSOR_MAIN = "b2cb224e84fb552461deb25de4460c696ebd6830";
  const P1_10_PYTHON_BLOB = "85fab33a16d59796b40675b53f017d365898933c";
  const P1_10_BROWSER_BLOB = "1cab33e0598fea1833ad25e5af45c0a2c39a4990";
  const NON_EFFECTS = [
    "factual truth",
    "actor identity",
    "actor authority",
    "authorship",
    "responsibility acceptance",
    "publication authority",
    "action authority",
    "source priority",
    "source independence",
    "consensus",
    "negative reputation"
  ];

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function deepEqual(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, i) => deepEqual(item, right[i]));
    }
    if (left && right && typeof left === "object" && typeof right === "object") {
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      return leftKeys.length === rightKeys.length && leftKeys.every((key, i) => key === rightKeys[i] && deepEqual(left[key], right[key]));
    }
    return false;
  }
  function exactKeys(value, expected, label) {
    assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    assert(deepEqual(actual, wanted), `${label} fields changed`);
  }
  function dispositionApi() {
    const api = root.UUAAPFederatedDisposition;
    assert(api && typeof api.validateResult === "function" && typeof api.materializeFederatedDisposition === "function", "historical P1.10 browser API is required");
    return api;
  }
  function interactiveApi() {
    const api = root.UUAAPInteractive;
    assert(api && typeof api.validateInteractiveInput === "function", "historical P1.3 browser validator is required");
    return api;
  }

  function validateInput(record) {
    exactKeys(record, ["schema", "federated_disposition_result"], "disposition integrity input");
    assert(record.schema === INPUT_SCHEMA, "unsupported disposition integrity input schema");
    const source = record.federated_disposition_result;
    assert(source && typeof source === "object" && !Array.isArray(source), "federated_disposition_result must be an object");
    assert(source.schema === P1_10_RESULT_SCHEMA, "P1.11 consumes P1.10 result v0.1 only");
  }

  function verifyDispositionIntegrity(record) {
    validateInput(record);
    const supplied = record.federated_disposition_result;
    const p10 = dispositionApi();
    const p13 = interactiveApi();

    p10.validateResult(supplied);
    p13.validateInteractiveInput(supplied.materialized_interactive_input);

    const canonicalInput = {
      schema: p10.INPUT_SCHEMA,
      federated_candidate_set: clone(supplied.federated_candidate_set),
      disposition_event: clone(supplied.disposition_event)
    };
    const canonical = p10.materializeFederatedDisposition(canonicalInput);
    assert(deepEqual(supplied, canonical), "supplied P1.10 result differs from canonical historical rematerialization");

    const result = {
      schema: RESULT_SCHEMA,
      artifact: clone(supplied.artifact),
      source_result_schema: P1_10_RESULT_SCHEMA,
      source_bindings: {
        predecessor_main: PREDECESSOR_MAIN,
        p1_10_python_blob: P1_10_PYTHON_BLOB,
        p1_10_browser_blob: P1_10_BROWSER_BLOB
      },
      canonical_rematerialization_equal: true,
      p1_3_materialized_input_valid: true,
      does_not_establish: clone(NON_EFFECTS),
      aggregate_score_present: false,
      aggregate_verdict_present: false
    };
    validateResult(result);
    return result;
  }

  function validateResult(result) {
    exactKeys(result, [
      "schema", "artifact", "source_result_schema", "source_bindings",
      "canonical_rematerialization_equal", "p1_3_materialized_input_valid",
      "does_not_establish", "aggregate_score_present", "aggregate_verdict_present"
    ], "disposition integrity result");
    assert(result.schema === RESULT_SCHEMA, "unsupported disposition integrity result schema");
    exactKeys(result.artifact, ["id", "description"], "artifact");
    assert(typeof result.artifact.id === "string" && result.artifact.id.length > 0, "artifact.id required");
    assert(typeof result.artifact.description === "string" && result.artifact.description.length > 0, "artifact.description required");
    assert(result.source_result_schema === P1_10_RESULT_SCHEMA, "source result schema changed");
    exactKeys(result.source_bindings, ["predecessor_main", "p1_10_python_blob", "p1_10_browser_blob"], "source_bindings");
    assert(deepEqual(result.source_bindings, {
      predecessor_main: PREDECESSOR_MAIN,
      p1_10_python_blob: P1_10_PYTHON_BLOB,
      p1_10_browser_blob: P1_10_BROWSER_BLOB
    }), "historical P1.10 source bindings changed");
    assert(result.canonical_rematerialization_equal === true, "canonical rematerialization equality must be true");
    assert(result.p1_3_materialized_input_valid === true, "P1.3 materialized input validity must be true");
    assert(deepEqual(result.does_not_establish, NON_EFFECTS), "integrity closure non-effects changed");
    assert(result.aggregate_score_present === false, "aggregate score forbidden");
    assert(result.aggregate_verdict_present === false, "aggregate verdict forbidden");
  }

  const api = {
    INPUT_SCHEMA,
    RESULT_SCHEMA,
    PREDECESSOR_MAIN,
    P1_10_PYTHON_BLOB,
    P1_10_BROWSER_BLOB,
    validateInput,
    validateResult,
    verifyDispositionIntegrity
  };
  root.UUAAPDispositionIntegrity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
