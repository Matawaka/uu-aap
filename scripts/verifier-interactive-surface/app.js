(() => {
  "use strict";

  const DIMENSION_ORDER = [
    "integrity",
    "identity",
    "provenance",
    "availability",
    "authority",
    "responsibility",
    "truth",
  ];
  const EVALUATION_STATES = new Set([
    "OBSERVED",
    "SUPPORTED",
    "NOT_SUPPORTED",
    "UNKNOWN",
    "NOT_EVALUATED",
    "NOT_APPLICABLE",
  ]);
  const FORBIDDEN_KEYS = new Set([
    "overall_trust",
    "trust_score",
    "truth_score",
    "reputation_score",
    "reliability_score",
    "confidence_score",
    "compatibility_score",
    "overall_verdict",
    "verified",
    "verified_true",
  ]);
  const ALLOWED_AGGREGATE_FLAGS = new Set([
    "aggregate_score_present",
    "aggregate_verdict_present",
  ]);
  const INPUT_FIELDS = [
    "artifact",
    "dimension_claims",
    "disputes",
    "evidence_items",
    "related_observations",
    "schema",
    "warnings",
  ];
  const DIMENSION_FIELDS = [
    "does_not_establish",
    "evaluation",
    "evidence_refs",
    "explanation",
    "source_layer",
    "value",
  ];
  const EVIDENCE_FIELDS = ["id", "kind", "payload", "source_layer", "summary"];

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
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

  function semanticProjection(value) {
    const projected = clone(value);
    if (Array.isArray(projected.evidence_items)) {
      for (const item of projected.evidence_items) {
        if (item && typeof item === "object" && !Array.isArray(item) && Object.hasOwn(item, "payload")) {
          item.payload = {};
        }
      }
    }
    return projected;
  }

  function scanSemanticKeys(value, path = "") {
    if (Array.isArray(value)) {
      value.forEach((child, index) => scanSemanticKeys(child, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const normalized = key.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
      if (ALLOWED_AGGREGATE_FLAGS.has(normalized)) {
        assert(child === false, `${childPath} must remain false`);
      } else {
        assert(!FORBIDDEN_KEYS.has(normalized), `forbidden aggregate/verdict field: ${childPath}`);
      }
      scanSemanticKeys(child, childPath);
    }
  }

  function validateDimension(name, dimension) {
    assert(dimension && typeof dimension === "object" && !Array.isArray(dimension), `${name}: dimension must be an object`);
    assert(sameKeys(dimension, DIMENSION_FIELDS), `${name}: dimension fields changed`);
    assert(typeof dimension.value === "string" && dimension.value.length > 0, `${name}: empty value`);
    assert(EVALUATION_STATES.has(dimension.evaluation), `${name}: invalid evaluation`);
    assert(typeof dimension.source_layer === "string" && dimension.source_layer.length > 0, `${name}: source_layer`);
    assert(Array.isArray(dimension.evidence_refs), `${name}: evidence_refs`);
    assert(typeof dimension.explanation === "string" && dimension.explanation.length > 0, `${name}: explanation`);
    assert(Array.isArray(dimension.does_not_establish) && dimension.does_not_establish.length > 0, `${name}: non-effects required`);
    assert(dimension.does_not_establish.every((item) => typeof item === "string" && item.length > 0), `${name}: non-effect item`);
    if (dimension.evaluation === "NOT_EVALUATED") {
      assert(dimension.value === "NOT_EVALUATED", `${name}: missing evidence must render NOT_EVALUATED`);
      assert(dimension.evidence_refs.length === 0, `${name}: NOT_EVALUATED must not fabricate evidence`);
    } else {
      assert(dimension.evidence_refs.length > 0, `${name}: evaluated dimension needs evidence refs`);
    }
  }

  function validateInteractiveInput(record) {
    assert(record && typeof record === "object" && !Array.isArray(record), "interactive input must be an object");
    assert(sameKeys(record, INPUT_FIELDS), "interactive input fields changed");
    assert(record.schema === "urn:uu-aap:interactive-verifier-input:0.1", "unsupported interactive input schema");

    assert(record.artifact && typeof record.artifact === "object" && !Array.isArray(record.artifact), "artifact must be an object");
    assert(sameKeys(record.artifact, ["id", "description"]), "artifact fields changed");
    assert(typeof record.artifact.id === "string" && record.artifact.id.length > 0, "artifact.id must be non-empty");
    assert(typeof record.artifact.description === "string" && record.artifact.description.length > 0, "artifact.description must be non-empty");

    assert(Array.isArray(record.evidence_items), "evidence_items must be an array");
    const evidenceIds = new Set();
    record.evidence_items.forEach((item, index) => {
      assert(item && typeof item === "object" && !Array.isArray(item), `evidence_items[${index}] must be an object`);
      assert(sameKeys(item, EVIDENCE_FIELDS), `evidence_items[${index}] fields changed`);
      for (const field of ["id", "kind", "source_layer", "summary"]) {
        assert(typeof item[field] === "string" && item[field].length > 0, `evidence_items[${index}].${field}`);
      }
      assert(item.payload && typeof item.payload === "object" && !Array.isArray(item.payload), `evidence_items[${index}].payload must be an object`);
      assert(!evidenceIds.has(item.id), `duplicate evidence id: ${item.id}`);
      evidenceIds.add(item.id);
    });

    assert(record.dimension_claims && typeof record.dimension_claims === "object" && !Array.isArray(record.dimension_claims), "dimension_claims must be an object");
    assert(sameKeys(record.dimension_claims, DIMENSION_ORDER), "exactly seven semantic dimensions are required");
    for (const name of DIMENSION_ORDER) {
      const dimension = record.dimension_claims[name];
      validateDimension(name, dimension);
      for (const evidenceRef of dimension.evidence_refs) {
        assert(evidenceIds.has(evidenceRef), `${name}: undeclared evidence ref: ${evidenceRef}`);
      }
    }

    assert(record.related_observations && typeof record.related_observations === "object" && !Array.isArray(record.related_observations), "related_observations must be an object");
    assert(Array.isArray(record.warnings), "warnings must be an array");
    record.warnings.forEach((warning, index) => {
      assert(warning && typeof warning === "object" && !Array.isArray(warning), `warnings[${index}] must be an object`);
      assert(sameKeys(warning, ["code", "message"]), `warnings[${index}] fields changed`);
      assert(typeof warning.code === "string" && warning.code.length > 0, `warnings[${index}].code`);
      assert(typeof warning.message === "string" && warning.message.length > 0, `warnings[${index}].message`);
    });
    assert(Array.isArray(record.disputes) && record.disputes.every((item) => item && typeof item === "object" && !Array.isArray(item)), "disputes must contain objects");

    scanSemanticKeys(semanticProjection(record));
  }

  function normalizeInteractiveInput(record) {
    validateInteractiveInput(record);
    return {
      schema: "urn:uu-aap:interactive-verifier-result:0.1",
      artifact: clone(record.artifact),
      dimension_order: [...DIMENSION_ORDER],
      dimensions: Object.fromEntries(DIMENSION_ORDER.map((name) => [name, clone(record.dimension_claims[name])])),
      evidence_items: clone(record.evidence_items),
      related_observations: clone(record.related_observations),
      warnings: clone(record.warnings),
      disputes: clone(record.disputes),
      presentation_policy: {
        color_only_semantics_permitted: false,
        umbrella_verified_badge_permitted: false,
        cross_dimension_promotion_permitted: false,
        aggregate_score_permitted: false,
        aggregate_verdict_permitted: false,
      },
      aggregate_score_present: false,
      aggregate_verdict_present: false,
    };
  }

  function addText(parent, tagName, text) {
    const element = document.createElement(tagName);
    element.textContent = String(text);
    parent.appendChild(element);
    return element;
  }

  function addList(parent, title, items) {
    addText(parent, "h3", title);
    const list = document.createElement("ul");
    for (const item of items) {
      addText(list, "li", item);
    }
    parent.appendChild(list);
  }

  function renderResult(result, container) {
    container.replaceChildren();
    addText(container, "h2", "Validated explicit result");
    addText(container, "p", `Artifact: ${result.artifact.id}`);
    addText(container, "p", result.artifact.description);

    for (const name of DIMENSION_ORDER) {
      const dimension = result.dimensions[name];
      const section = document.createElement("section");
      section.dataset.dimension = name;
      addText(section, "h2", name[0].toUpperCase() + name.slice(1));
      addText(section, "p", `Value: ${dimension.value}`);
      addText(section, "p", `Evaluation: ${dimension.evaluation}`);
      addText(section, "p", `Source layer: ${dimension.source_layer}`);
      addText(section, "p", dimension.explanation);
      addList(section, "Evidence references", dimension.evidence_refs.length ? dimension.evidence_refs : ["None supplied"]);
      addList(section, "Does not establish", dimension.does_not_establish);
      container.appendChild(section);
    }

    const evidenceSection = document.createElement("section");
    addText(evidenceSection, "h2", "Declared evidence inventory");
    for (const item of result.evidence_items) {
      const article = document.createElement("article");
      addText(article, "h3", item.id);
      addText(article, "p", `Kind: ${item.kind}`);
      addText(article, "p", `Source layer: ${item.source_layer}`);
      addText(article, "p", item.summary);
      const payload = document.createElement("pre");
      payload.textContent = JSON.stringify(item.payload, null, 2);
      article.appendChild(payload);
      evidenceSection.appendChild(article);
    }
    container.appendChild(evidenceSection);

    if (result.warnings.length) {
      const warningSection = document.createElement("section");
      addText(warningSection, "h2", "Warnings");
      const list = document.createElement("ul");
      for (const warning of result.warnings) {
        addText(list, "li", `${warning.code}: ${warning.message}`);
      }
      warningSection.appendChild(list);
      container.appendChild(warningSection);
    }

    const normalized = document.createElement("pre");
    normalized.textContent = JSON.stringify(result, null, 2);
    const normalizedSection = document.createElement("section");
    addText(normalizedSection, "h2", "Normalized local result JSON");
    normalizedSection.appendChild(normalized);
    container.appendChild(normalizedSection);
  }

  function installUi() {
    const textarea = document.getElementById("input-json");
    const fileInput = document.getElementById("file-input");
    const validateButton = document.getElementById("validate-button");
    const errorBox = document.getElementById("validation-error");
    const resultBox = document.getElementById("validation-result");
    if (!textarea || !fileInput || !validateButton || !errorBox || !resultBox) {
      return;
    }

    validateButton.addEventListener("click", () => {
      errorBox.textContent = "";
      resultBox.replaceChildren();
      try {
        const input = JSON.parse(textarea.value);
        const result = normalizeInteractiveInput(input);
        renderResult(result, resultBox);
      } catch (error) {
        errorBox.textContent = `Validation failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    });

    fileInput.addEventListener("change", () => {
      const selected = fileInput.files && fileInput.files[0];
      if (!selected) {
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        textarea.value = typeof reader.result === "string" ? reader.result : "";
        errorBox.textContent = "Local file loaded. Select Validate local input to process it.";
        resultBox.replaceChildren();
      });
      reader.addEventListener("error", () => {
        errorBox.textContent = "Could not read the selected local file.";
      });
      reader.readAsText(selected);
    });
  }

  globalThis.UUAAPInteractive = {
    DIMENSION_ORDER,
    normalizeInteractiveInput,
    validateInteractiveInput,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", installUi, { once: true });
    } else {
      installUi();
    }
  }
})();
