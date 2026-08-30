(function (root) {
  "use strict";

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function appendText(parent, tag, text) {
    const node = document.createElement(tag);
    node.textContent = String(text);
    parent.appendChild(node);
    return node;
  }

  function integrityApi() {
    const api = root.UUAAPDispositionIntegrity;
    assert(api && typeof api.verifyDispositionIntegrity === "function", "P1.11 disposition integrity verifier is required");
    return api;
  }

  function render(result, target) {
    target.replaceChildren();
    appendText(target, "h2", "Bounded P1.11 integrity receipt");
    appendText(target, "p", `artifact: ${result.artifact.id}`);
    appendText(target, "p", `canonical_rematerialization_equal: ${result.canonical_rematerialization_equal}`);
    appendText(target, "p", `p1_3_materialized_input_valid: ${result.p1_3_materialized_input_valid}`);
    appendText(target, "p", `predecessor_main: ${result.source_bindings.predecessor_main}`);
    appendText(target, "p", `p1_10_python_blob: ${result.source_bindings.p1_10_python_blob}`);
    appendText(target, "p", `p1_10_browser_blob: ${result.source_bindings.p1_10_browser_blob}`);
    appendText(target, "h2", "Does not establish");
    const list = document.createElement("ul");
    result.does_not_establish.forEach((item) => appendText(list, "li", item));
    target.appendChild(list);
    appendText(target, "h2", "Canonical integrity result JSON");
    appendText(target, "pre", JSON.stringify(result, null, 2));
  }

  function verifyText(text) {
    return integrityApi().verifyDispositionIntegrity(JSON.parse(text));
  }

  root.UUAAPDispositionIntegritySurface = {verifyText, render};

  if (typeof document !== "undefined") {
    const input = document.getElementById("integrity-input-json");
    const file = document.getElementById("integrity-file-input");
    const button = document.getElementById("integrity-button");
    const error = document.getElementById("integrity-error");
    const target = document.getElementById("integrity-result");

    if (file && input) {
      file.addEventListener("change", () => {
        const selected = file.files && file.files[0];
        if (!selected) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          input.value = typeof reader.result === "string" ? reader.result : "";
          if (error) error.textContent = "Local file loaded. Select Verify disposition result integrity to process it.";
          if (target) target.replaceChildren();
        });
        reader.readAsText(selected);
      });
    }

    if (button && input && error && target) {
      button.addEventListener("click", () => {
        error.textContent = "";
        target.replaceChildren();
        try {
          render(verifyText(input.value), target);
        } catch (caught) {
          error.textContent = `Integrity verification failed: ${caught instanceof Error ? caught.message : String(caught)}`;
        }
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
