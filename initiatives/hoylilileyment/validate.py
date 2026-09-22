#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Offline structural checks; not a water, legal, identity or impact audit."""
from __future__ import annotations
import copy
import json
import math
from pathlib import Path
import sys
from typing import Any, Callable
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

ROOT = Path(__file__).resolve().parent
MAX_BYTES = 1_000_000


def unique_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def reject_constant(value: str) -> None:
    raise ValueError(f'Non-finite JSON constant: {value}')


def finite_float(text: str) -> float:
    value = float(text)
    if not math.isfinite(value):
        raise ValueError('JSON numeric overflow')
    return value


def parse(text: str) -> Any:
    if len(text.encode('utf-8')) > MAX_BYTES:
        raise ValueError('JSON byte ceiling exceeded')
    return json.loads(text, object_pairs_hook=unique_pairs,
                      parse_constant=reject_constant, parse_float=finite_float)


def load(name: str) -> Any:
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT) or path.stat().st_size > MAX_BYTES:
        raise ValueError('Invalid input path or byte ceiling exceeded')
    return parse(path.read_text(encoding='utf-8'))


def reject_nonfinite(value: Any) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError('Non-finite numeric value')
    if isinstance(value, dict):
        for child in value.values():
            reject_nonfinite(child)
    elif isinstance(value, list):
        for child in value:
            reject_nonfinite(child)


def validate(schema: dict[str, Any], instance: Any) -> None:
    reject_nonfinite(instance)
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(instance)


def check_observation(schema: dict[str, Any], record: dict[str, Any], catalog: dict[str, Any]) -> None:
    validate(schema, record)
    definitions = {m['id']: m for m in catalog['metrics']}
    seen: set[str] = set()
    has_values = any(m['value'] is not None for m in record['metrics'])
    start, end = record['period']['start'], record['period']['end']
    if has_values and not all((record['basin_id'], record['population_scope'], start, end)):
        raise ValueError('Values require basin, population scope and period')
    if (start is None) != (end is None) or (start is not None and start > end):
        raise ValueError('Invalid period')
    for metric in record['metrics']:
        key = metric['metric_id']
        if key not in definitions or key in seen:
            raise ValueError('Unknown or duplicate metric')
        seen.add(key)
        definition = definitions[key]
        if metric['unit'] != definition['unit']:
            raise ValueError('Metric unit mismatch')
        if metric['unit'] != 'currency' and metric['currency'] is not None:
            raise ValueError('Currency code on a non-currency metric')
        value = metric['value']
        if value is None:
            continue
        if 'minimum' in definition and value < definition['minimum']:
            raise ValueError('Value below metric minimum')
        if 'maximum' in definition and value > definition['maximum']:
            raise ValueError('Value above metric maximum')
        if metric['unit'] == 'currency' and not metric['currency']:
            raise ValueError('Currency code required')
        if key in {'additional_replenishment_estimate', 'fiscal_benefit_consumer_pass_through'} and not metric['counterfactual']:
            raise ValueError('Counterfactual required; this does not certify additionality')


def main() -> int:
    offer, offer_schema = load('offer.json'), load('offer.schema.json')
    observation_schema, proposal_schema = load('observation.schema.json'), load('proposal.schema.json')
    catalog, example, metadata = load('metrics.json'), load('examples/not-measured.json'), load('metadata.jsonld')
    check_offer = lambda value: validate(offer_schema, value)
    check_record = lambda value: check_observation(observation_schema, value, catalog)
    check_proposal = lambda value: validate(proposal_schema, value)
    check_offer(offer)
    check_record(example)
    if len({m['id'] for m in catalog['metrics']}) != len(catalog['metrics']):
        raise ValueError('Duplicate catalog identifier')
    if catalog['version'] != offer['version'] or catalog['status'] != 'PROPOSED_CATALOG_NOT_RESULTS':
        raise ValueError('Catalog status/version mismatch')
    if metadata['@type'] != 'CreativeWork' or metadata['version'] != offer['version']:
        raise ValueError('Linked-data status/version mismatch')
    if metadata['encoding']['contentUrl'] != offer['publication']['raw_manifest_url']:
        raise ValueError('Manifest discovery URL mismatch')
    for name in offer['documents'].values():
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            raise ValueError('Missing or escaping document link')
    proposal = {'version': '0.2.0', 'record_type': 'NON_BINDING_PROPOSAL', 'offer_id': offer['id'], 'actor_kind': 'MODEL', 'actor_disclosure': 'Synthetic test only', 'proposal': 'Review the measurement method before collecting data.', 'evidence_refs': [], 'limitations': 'No real-world evidence; synthetic validation fixture.', 'conflicts': 'Unknown; test fixture only.', 'authority_effect': 'NONE', 'commitment_created': False, 'contains_personal_data': False}
    check_proposal(proposal)
    measured = copy.deepcopy(example)
    measured.update(basin_id='SYNTHETIC-BASIN', population_scope='Synthetic fixture, no people', period={'start': '2026-09-01', 'end': '2026-09-02'})
    measured['metrics'] = [copy.deepcopy(example['metrics'][0])]
    measured['metrics'][0].update(value=1, evidence_status='MEASURED', source_refs=['https://example.invalid/synthetic-fixture'], method='Synthetic test method', uncertainty='Synthetic fixture; no real measurement')
    check_record(measured)
    tests: list[tuple[str, Callable[[], None]]] = []

    def mutation(name: str, original: Any, path: tuple[Any, ...], value: Any, checker: Callable[[Any], None]) -> None:
        changed = copy.deepcopy(original)
        target = changed
        for segment in path[:-1]:
            target = target[segment]
        target[path[-1]] = value
        tests.append((name, lambda obj=changed, check=checker: check(obj)))

    for name, section, key, value in [
        ('authority-escalation', 'authority', 'effect', 'EXECUTE'),
        ('payment-activation', 'authority', 'payment_collection', True),
        ('automatic-tax-exemption', 'fiscal_analysis', 'automatic_exemption', True),
        ('invented-tax-eligibility', 'fiscal_analysis', 'eligibility', True),
        ('personal-surveillance', 'privacy', 'personal_consumption_surveillance', True),
        ('universal-person-quota', 'measurement_policy', 'universal_per_person_quota', True),
        ('hci-operational-power', 'governance', 'hci_direct_operational_authority', 'FULL'),
        ('claimed-pilot-launch', 'pilot', 'status', 'LIVE'),
        ('runtime-enforcement-claim', 'machine_participation', 'runtime_enforcement_deployed', True),
    ]:
        mutation(name, offer, (section, key), value, check_offer)
    mutation('unknown-offer-field', offer, ('undeclared_authority',), True, check_offer)
    missing = copy.deepcopy(offer)
    del missing['authority']
    tests.append(('missing-authority-boundary', lambda: check_offer(missing)))
    mutation('unknown-as-zero', example, ('metrics', 0, 'value'), 0, check_record)
    mutation('unknown-metric', example, ('metrics', 0, 'metric_id'), 'moral_purity', check_record)
    mutation('measurement-without-evidence', measured, ('metrics', 0, 'source_refs'), [], check_record)
    mutation('causal-upgrade', example, ('causal_effect',), 'PROVEN', check_record)
    mutation('unit-drift', example, ('metrics', 0, 'unit'), 'litre', check_record)
    mutation('duplicate-metric', example, ('metrics',), example['metrics'] + [example['metrics'][0]], check_record)
    mutation('proposal-as-commitment', proposal, ('commitment_created',), True, check_proposal)
    mutation('proposal-with-personal-data-declared', proposal, ('contains_personal_data',), True, check_proposal)
    mutation('measurement-without-basin', measured, ('basin_id',), None, check_record)
    mutation('reversed-period', measured, ('period', 'end'), '2026-08-31', check_record)
    mutation('invalid-date', measured, ('period', 'end'), '2026-02-30', check_record)
    mutation('negative-withdrawal', measured, ('metrics', 0, 'value'), -1, check_record)
    mutation('nonfinite-native-value', measured, ('metrics', 0, 'value'), float('inf'), check_record)
    mutation('currency-on-volume', measured, ('metrics', 0, 'currency'), 'RUB', check_record)
    mutation('recovery-without-counterfactual', measured, ('metrics', 0, 'metric_id'), 'additional_replenishment_estimate', check_record)
    for name, text in [('duplicate-json-keys', '{"x":1,"x":2}'), ('nan', '{"x":NaN}'), ('numeric-overflow', '{"x":1e999}'), ('trailing-json', '{} {}'), ('byte-ceiling', ' ' * (MAX_BYTES + 1))]:
        tests.append((name, lambda source=text: parse(source)))
    passed: list[str] = []
    for name, action in tests:
        try:
            action()
        except (ValueError, ValidationError):
            passed.append(name)
        else:
            raise ValueError(f'Negative test unexpectedly accepted: {name}')
    report = {'status': 'PASS', 'version': offer['version'], 'positive_checks': ['offer-schema', 'unmeasured-observation', 'synthetic-measured-observation', 'proposal-schema', 'catalog-consistency', 'linked-data-consistency', 'local-document-links'], 'negative_passed': len(passed), 'negative_tests': passed, 'scope': 'STRUCTURE_AND_DECLARED_BOUNDARIES_ONLY', 'independent_review': False, 'real_world_impact_proven': False, 'legal_eligibility_proven': False, 'personal_data_absence_proven': False, 'remote_evidence_fetched': False}
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f'FAIL: {error}', file=sys.stderr)
        raise SystemExit(1)
