#!/usr/bin/env python3
"""Deterministic consistency validator for this audit-only evidence package."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


AUDIT_DIR = Path(__file__).resolve().parent
REPO_ROOT = AUDIT_DIR.parents[2]
FRONTIER = "2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee"
CLASSIFICATIONS = {
    "PROVEN",
    "DOCUMENTED",
    "IMPLIED",
    "MISSING",
    "CONFLICTING",
    "OUT_OF_SCOPE",
}
SEVERITIES = {"BLOCKING", "HIGH", "MEDIUM", "LOW", "NOTE"}


def fail(message: str) -> None:
    raise SystemExit(f"AUDIT VALIDATION FAILED: {message}")


def load_json(name: str) -> Any:
    path = AUDIT_DIR / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"missing required artifact: {name}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {name}: {exc}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def main() -> None:
    required = {
        "README.md",
        "connectivity-report.md",
        "connectivity-graph.json",
        "findings.json",
        "evidence-index.json",
        "audit-summary.json",
        "recovery-state.json",
        "validate-audit.py",
    }
    present = {path.name for path in AUDIT_DIR.iterdir() if path.is_file()}
    require(required <= present, f"required files absent: {sorted(required - present)}")

    graph = load_json("connectivity-graph.json")
    findings_doc = load_json("findings.json")
    evidence = load_json("evidence-index.json")
    summary = load_json("audit-summary.json")
    recovery = load_json("recovery-state.json")

    for name, document in (
        ("connectivity-graph.json", graph),
        ("findings.json", findings_doc),
        ("evidence-index.json", evidence),
        ("audit-summary.json", summary),
        ("recovery-state.json", recovery),
    ):
        require(
            document.get("expected_frontier") == FRONTIER,
            f"{name} changed or omitted EXPECTED_FRONTIER",
        )
        require(
            document.get("observed_main_sha") == FRONTIER,
            f"{name} has an unexpected observed_main_sha",
        )

    nodes = graph.get("nodes")
    edges = graph.get("edges")
    require(isinstance(nodes, list), "graph.nodes must be a list")
    require(isinstance(edges, list), "graph.edges must be a list")

    node_ids = [node.get("id") for node in nodes]
    require(all(node_ids), "every graph node must have an id")
    require(len(node_ids) == len(set(node_ids)), "graph node ids must be unique")
    node_set = set(node_ids)

    edge_ids = [edge.get("id") for edge in edges]
    require(all(edge_ids), "every graph edge must have an id")
    require(len(edge_ids) == len(set(edge_ids)), "graph edge ids must be unique")

    relation_counts: Counter[str] = Counter()
    for edge in edges:
        for field in (
            "source",
            "target",
            "relation_type",
            "classification",
            "evidence_refs",
            "authority_effect",
            "notes",
        ):
            require(field in edge, f"edge {edge.get('id')} omits {field}")
        require(edge["source"] in node_set, f"edge {edge['id']} has unknown source")
        require(edge["target"] in node_set, f"edge {edge['id']} has unknown target")
        require(
            edge["classification"] in CLASSIFICATIONS,
            f"edge {edge['id']} has invalid classification",
        )
        require(
            isinstance(edge["evidence_refs"], list) and edge["evidence_refs"],
            f"edge {edge['id']} needs concrete evidence_refs",
        )
        relation_counts[edge["classification"]] += 1

    require(len(nodes) == summary.get("nodes_examined"), "node count mismatch")
    require(len(edges) == summary.get("relations_examined"), "relation count mismatch")
    summary_count_fields = {
        "PROVEN": "proven_count",
        "DOCUMENTED": "documented_count",
        "IMPLIED": "implied_count",
        "MISSING": "missing_count",
        "CONFLICTING": "conflicting_count",
        "OUT_OF_SCOPE": "out_of_scope_count",
    }
    for classification, field in summary_count_fields.items():
        require(
            relation_counts[classification] == summary.get(field),
            f"{classification} count does not match {field}",
        )

    findings = findings_doc.get("findings")
    require(isinstance(findings, list) and findings, "findings list is empty")
    finding_ids = [finding.get("finding_id") for finding in findings]
    require(len(finding_ids) == len(set(finding_ids)), "finding ids must be unique")

    severity_counts: Counter[str] = Counter()
    required_finding_fields = {
        "finding_id",
        "severity",
        "category",
        "claim",
        "classification",
        "evidence",
        "affected_paths",
        "affected_layers",
        "expected_boundary",
        "observed_state",
        "remediation_needed",
        "remediation_authorized",
    }
    for finding in findings:
        missing = required_finding_fields - finding.keys()
        require(not missing, f"{finding.get('finding_id')} omits {sorted(missing)}")
        require(finding["severity"] in SEVERITIES, "invalid finding severity")
        require(
            finding["classification"] in CLASSIFICATIONS,
            "invalid finding classification",
        )
        require(
            isinstance(finding["evidence"], list) and finding["evidence"],
            f"{finding['finding_id']} needs evidence",
        )
        require(
            finding["remediation_authorized"] is False,
            f"{finding['finding_id']} must not authorize remediation",
        )
        severity_counts[finding["severity"]] += 1

    severity_fields = {
        "BLOCKING": "blocking_findings",
        "HIGH": "high_findings",
        "MEDIUM": "medium_findings",
        "LOW": "low_findings",
        "NOTE": "note_findings",
    }
    for severity, field in severity_fields.items():
        require(
            severity_counts[severity] == summary.get(field),
            f"{severity} count does not match {field}",
        )

    evidence_entries = evidence.get("entries")
    require(isinstance(evidence_entries, list) and evidence_entries, "evidence entries absent")
    evidence_ids = [item.get("evidence_id") for item in evidence_entries]
    require(len(evidence_ids) == len(set(evidence_ids)), "evidence ids must be unique")

    for item in evidence_entries:
        for field in (
            "evidence_id",
            "commit_sha",
            "path",
            "relevant_artifact",
            "sha256",
            "issue_pr_reference",
            "validator_workflow_relation",
            "evidence_role",
        ):
            require(field in item, f"{item.get('evidence_id')} omits {field}")
        require(
            item["commit_sha"] == FRONTIER,
            f"{item['evidence_id']} is not indexed at the observed frontier",
        )
        artifact_path = REPO_ROOT / item["path"]
        require(
            artifact_path.is_file(),
            f"{item['evidence_id']} points to missing path {item['path']}",
        )
        require(
            sha256(artifact_path) == item["sha256"],
            f"{item['evidence_id']} hash mismatch for {item['path']}",
        )

    require(summary.get("audit_complete") is True, "audit_complete must be true")
    require(
        summary.get("audit_status") == "PREPARED_NOT_PUBLISHED",
        "unexpected publication status",
    )
    require(summary.get("audit_branch") == "NONE", "no branch may be claimed")
    require(summary.get("audit_pr") == "NONE", "no PR may be claimed")

    require(recovery.get("recovery_reason") == "network_interruption", "recovery reason mismatch")
    require(recovery.get("frontier_diverged") is False, "recovery frontier must not diverge")
    require(recovery.get("existing_audit_branch_found") is False, "unexpected prior audit branch")
    require(recovery.get("existing_audit_pr_found") is False, "unexpected prior audit PR")
    require(recovery.get("partial_artifacts_found") is True, "partial artifacts must be recorded")
    require(recovery.get("recovered_existing_work") is True, "existing work recovery not recorded")
    require(recovery.get("duplicate_publication_created") is False, "duplicate publication claimed")
    require(
        recovery.get("concurrent_unmerged_state_included_in_audited_architecture") is False,
        "parallel unmerged work must remain outside the frozen architecture",
    )
    require(recovery.get("architecture_modified") is False, "recovery modified architecture")
    require(recovery.get("recovery_created_new_authority") is False, "recovery created authority")

    for flag in (
        "architecture_modified",
        "external_effect_authorized",
        "action_permit_created",
        "successor_permit_created",
        "stable_core_change_implied",
        "remediation_authorized",
    ):
        require(summary.get(flag) is False, f"{flag} must remain false")

    readme = (AUDIT_DIR / "README.md").read_text(encoding="utf-8")
    report = (AUDIT_DIR / "connectivity-report.md").read_text(encoding="utf-8")
    for phrase in (
        "Audit Publication != Architecture Change",
        "authorizes no remediation",
    ):
        require(phrase in readme, f"README omits required statement: {phrase}")
        require(phrase in report, f"report omits required statement: {phrase}")

    print(
        "KONTUR audit package PASS: "
        f"{len(nodes)} nodes, {len(edges)} relations, {len(findings)} findings, "
        f"{len(evidence_entries)} hashed repository artifacts"
    )


if __name__ == "__main__":
    main()



