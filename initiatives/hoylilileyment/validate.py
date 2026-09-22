#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Offline package checks. No water, legal, identity or impact certification."""
from __future__ import annotations
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Callable
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
MAX_BYTES = 1_000_000


def pairs_unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def bad_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON constant: {value}")


def parse(text: str) -> Any:
    if len(text.encode('utf-8')) > MAX_BYTES:
        raise ValueError('JSON byte ceiling exceeded')
    return json.loads(text, object_pairs_hook=pairs_unique, parse_constant=bad_constant)


def load(name: str) -> Any:
    path = ROOT / name
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('JSON byte ceiling exceeded')
    return parse(path.read_text(encoding='utf-8'))


def validate(schema: dict[str, Any], instance: Any) -> None:
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(instance)


def observation_check(schema: dict[str, Any], record: dict[str, Any], catalog: dict[str, Any]) -> None:
    validate(schema, record)
    definitions = {m['id']: m for m in catalog['metrics']}
    seen: set[str] = set()
    has_values = any(m['value'] is not None for m in record['metrics'])
    if has_values:
        if not record['basin_id'] or not record['population_scope']:
            raise ValueError('Measured or estimated records require a basin and population scope')
        if not record['period']['start'] or not record['period']['end']:
            raise ValueError('Measured or estimated records require a period')
    start, end = record['period']['start'], record['period']['end']
    if (start is None) != (end is None):
        raise ValueError('Both period endpoints are required together')
    if start is not None and start > end:
        raise ValueError('Period is reversed')
    for metric in record['metrics']:
        key = metric['metric_id']
        if key not in definitions or key in seen:
            raise ValueError('Unknown or duplicate metric')
        seen.add(key)
        definition = definitions[key]
        if metric['unit'] != definition['unit']:
            raise ValueError('Metric unit mismatch')
        value = metric['value']
        if value is None:
            continue
        if 'minimum' in definition and value < definition['minimum']:
            raise ValueError('Value below metric minimum')
        if 'maximum' in definition and value > definition['maximum']:
            raise ValueError('Value above metric maximum')
        if definition['unit'] == 'currency' and not metric['currency']:
            raise ValueError('Currency code required')
        if definition['unit'] != 'currency' and metric['currency'] is not None:
            raise ValueError('Currency code on a non-currency metric')
        if key in {'additional_replenishment_estimate', 'fiscal_benefit_consumer_pass_through'} and not metric['counterfactual']:
            raise ValueError('Counterfactual required; this still does not certify additionality')


def main() -> int:
    offer = load('offer.json')
    offer_schema = load('offer.schema.json')
    observation_schema = load('observation.schema.json')
    proposal_schema = load('proposal.schema.json')
    catalog = load('metrics.json')
    example = load('examples/not-measured.json')
    metadata = load('metadata.jsonld')
    validate(offer_schema, offer)
    observation_check(observation_schema, example, catalog)
    if len({m['id'] for m in catalog['metrics']}) != len(catalog['metrics']):
        raise ValueError('Duplicate catalog identifier')
    if metadata['@type'] != 'CreativeWork' or metadata['version'] != offer['version']:
        raise ValueError('Linked-data status/version mismatch')
    if metadata['encoding']['contentUrl'] != offer['publication']['raw_manifest_url']:
        raise ValueError('Manifest discovery URL mismatch')
    for name in offer['documents'].values():
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            raise ValueError('Missing or escaping document link')
    proposal = {'version': '0.2.0', 'record_type': 'NON_BINDING_PROPOSAL', 'offer_id': offer['id'], 'actor_kind': 'MODEL', 'actor_disclosure': 'Synthetic test only', 'proposal': 'Review the measurement method before collecting data.', 'evidence_refs': [], 'limitations': 'No real-world evidence; synthetic validation fixture.', 'conflicts': 'Unknown; test fixture only.', 'authority_effect': 'NONE', 'commitment_created': False, 'contains_personal_data': False}
    validate(proposal_schema, proposal)
    tests: list[tuple[str, Callable[[], None]]] = []

    def offer_mutation(name: str, section: str, key: str, value: Any) -> None:
        bad = copy.deepcopy(offer)
        bad[section][key] = value
        tests.append((name, lambda b=bad: validate(offer_schema, b)))

    offer_mutation('reject-authority-escalation', 'authority', 'effect', 'EXECUTE')
    offer_mutation('reject-payment-activation', 'authority', 'payment_collection', True)
    offer_mutation('reject-automatic-tax-exemption', 'fiscal_analysis', 'automatic_exemption', True)
    offer_mutation('reject-invented-tax-eligibility', 'fiscal_analysis', 'eligibility', True)
    offer_mutation('reject-personal-surveillance', 'privacy', 'personal_consumption_surveillance', True)
    offer_mutation('reject-universal-person-quota', 'measurement_policy', 'universal_per_person_quota', True)
    offer_mutation('reject-hci-operational-power', 'governance', 'hci_direct_operational_authority', 'FULL')
    offer_mutation('reject-claimed-pilot-launch', 'pilot', 'status', 'LIVE')
    offer_mutation('reject-runtime-enforcement-claim', 'machine_participation', 'runtime_enforcement_deployed', True)
    bad = copy.deepcopy(offer)
    bad['undeclared_authority'] = True
    tests.append(('reject-unknown-offer-field', lambda: validate(offer_schema, bad)))
    bad_missing = copy.deepcopy(offer)
    del bad_missing['authority']
    tests.append(('reject-missing-authority-boundary', lambda: validate(offer_schema, bad_missing)))
    unknown_zero = copy.deepcopy(example)
    unknown_zero['metrics'][0]['value'] = 0
    tests.append(('reject-unknown-as-zero', lambda: observation_check(observation_schema, unknown_zero, catalog)))
    unknown_metric = copy.deepcopy(example)
    unknown_metric['metrics'][0]['metric_id'] = 'moral_purity'
    tests.append(('reject-unknown-metric', lambda: observation_check(observation_schema, unknown_metric, catalog)))
    measured = copy.deepcopy(example)
    measured['metrics'][0].update(value=1, evidence_status='MEASURED', method='Synthetic test method', uncertainty='Not evaluated; synthetic fixture')
    tests.append(('reject-measurement-without-evidence', lambda: observation_check(observation_schema, measured, catalog)))
    causal = copy.deepcopy(example)
    causal['causal_effect'] = 'PROVEN'
    tests.append(('reject-causal-upgrade', lambda: observation_check(observation_schema, causal, catalog)))
    unit = copy.deepcopy(example)
    unit['metrics'][0]['unit'] = 'litre'
    tests.append(('reject-unit-drift', lambda: observation_check(observation_schema, unit, catalog)))
    duplicate = copy.deepcopy(example)
    duplicate['metrics'].append(copy.deepcopy(duplicate['metrics'][0]))
    tests.append(('reject-duplicate-metric', lambda: observation_check(observation_schema, duplicate, catalog)))
    delegated = copy.deepcopy(proposal)
    delegated['commitment_created'] = True
    tests.append(('reject-proposal-as-commitment', lambda: validate(proposal_schema, delegated)))
    tests.append(('reject-duplicate-json-keys', lambda: parse('{"x":1,"x":2}')))
    tests.append(('reject-nan', lambda: parse('{"x":NaN}')))
    tests.append(('reject-trailing-json', lambda: parse('{} {}')))
    passed: list[str] = []
    for name, action in tests:
        try:
            action()
        except (ValueError, TypeError) as exc:
            passed.append(name)
        except Exception as exc:
            from jsonschema.exceptions import ValidationError
            if isinstance(exc, ValidationError):
                passed.append(name)
            else:
                raise
        else:
            raise ValueError(f'Negative test unexpectedly accepted: {name}')
    integrity_status = 'NOT_PRESENT'
    hash_path = ROOT / 'SHA256SUMS.json'
    if hash_path.exists():
        sums = load('SHA256SUMS.json')
        for name, expected in sums['files'].items():
            path = (ROOT / name).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                raise ValueError('Invalid integrity path')
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError(f'Integrity mismatch: {name}')
        integrity_status = 'PASS'
    print(json.dumps({'status': 'PASS', 'version': offer['version'], 'positive_checks': ['offer-schema', 'observation-schema-and-semantics', 'proposal-schema', 'catalog-identifiers', 'linked-data-consistency', 'local-document-links'], 'negative_passed': len(passed), 'negative_tests': passed, 'integrity': integrity_status, 'scope': 'LOCAL_STRUCTURE_AND_DECLARED_BOUNDARIES_ONLY', 'independent_review': False, 'real_world_impact_proven': False, 'legal_eligibility_proven': False}, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f'FAIL: {error}', file=sys.stderr)
        raise SystemExit(1)
