#!/usr/bin/env python3

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/ccrp-c4')


def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def validator(name: str):
    schema = load(ROOT / 'schema' / name)
    return Draft202012Validator(schema, format_checker=FormatChecker())


state_validator = validator('coordination-state.c4.schema.json')
transition_validator = validator('coordination-transition.c4.schema.json')
transition_result_validator = validator('coordination-transition-result.c4.schema.json')
admission_validator = validator('context-admission-result.c4.schema.json')
lease_validator = validator('execution-lease.c2.schema.json')

initial = load(OUT / 'initial.coordination-state.json')
state_validator.validate(initial)
assert initial['coordination_status'] == 'active'
assert initial['claims']['cross_context_coordination_state_established'] is True
assert initial['claims']['current_execution_owner_established'] is True

transition_files = sorted(OUT.glob('*.coordination-transition.json'))
assert transition_files, 'expected C4 coordination transition vectors'
for path in transition_files:
    transition_validator.validate(load(path))
    print(f'VALID CCRP/C4 transition: {path.name}')

result_files = sorted(OUT.glob('*.coordination-transition-result.json'))
assert result_files, 'expected C4 coordination transition results'
for path in result_files:
    artifact = load(path)
    transition_result_validator.validate(artifact)
    assert artifact['source_artifacts_preserved'] is True
    assert artifact['claims']['execution_admitted'] is False
    assert artifact['claims']['materialization_permitted'] is False
    assert artifact['claims']['canonical_state_established'] is False
    assert artifact['claims']['poai_authority_established'] is False
    assert artifact['claims']['policy_relative_canonicality_established'] is False
    assert artifact['claims']['universal_canonicality_established'] is False
    assert artifact['claims']['poai_v_conformance_established'] is False
    state_validator.validate(artifact['next_state'])
    if artifact['successor_lease'] is not None:
        lease_validator.validate(artifact['successor_lease'])
    print(f"VALID CCRP/C4 transition result: {path.name} -> {artifact['decision']}")

admission_files = sorted(OUT.glob('*.context-admission-result.json'))
assert admission_files, 'expected C4 context admission results'
for path in admission_files:
    artifact = load(path)
    admission_validator.validate(artifact)
    assert artifact['source_artifacts_preserved'] is True
    assert artifact['claims']['execution_admitted'] is False
    assert artifact['claims']['materialization_permitted'] is False
    assert artifact['claims']['canonical_state_established'] is False
    assert artifact['claims']['poai_authority_established'] is False
    assert artifact['claims']['historical_provenance_preserved'] is True
    assert artifact['claims']['poai_v_conformance_established'] is False
    print(f"VALID CCRP/C4 context admission: {path.name} -> {artifact['decision']}")

for name in ['resume.successor-execution-lease.json', 'handoff.successor-execution-lease.json']:
    lease = load(OUT / name)
    lease_validator.validate(lease)
    assert lease['claims']['execution_admitted'] is False
    assert lease['claims']['materialization_permitted'] is False
    assert lease['claims']['canonical_state_established'] is False
    print(f'VALID C4-produced CCRP/C2 successor lease: {name}')

pause = load(OUT / 'pause.coordination-transition-result.json')
assert pause['decision'] == 'accepted'
assert pause['next_state']['coordination_status'] == 'paused'
assert pause['next_state']['active_lease_ref'] is None
assert pause['claims']['pause_barrier_established'] is True
assert pause['claims']['successor_epoch_established'] is False

paused_admission = load(OUT / 'paused.context-admission-result.json')
assert paused_admission['decision'] == 'not_admitted'
assert 'context_paused_or_inactive' in paused_admission['reason_codes']

resume = load(OUT / 'resume.coordination-transition-result.json')
assert resume['decision'] == 'accepted'
assert resume['claims']['resume_established'] is True
assert resume['claims']['successor_epoch_established'] is True
assert resume['successor_lease']['epoch'] == initial['epoch'] + 1
assert resume['successor_lease']['fencing_token'] == initial['fencing_token'] + 1
assert resume['next_state']['origin_ref'] == initial['origin_ref']
assert resume['next_state']['owner']['session_id'] != initial['origin_ref']['session_id']

resumed_admission = load(OUT / 'resumed.context-admission-result.json')
assert resumed_admission['decision'] == 'context_admitted'
assert resumed_admission['claims']['context_admission_established'] is True
assert resumed_admission['claims']['execution_admitted'] is False

old_admission = load(OUT / 'delayed-old.context-admission-result.json')
assert old_admission['decision'] == 'not_admitted'
assert 'session_not_current_owner' in old_admission['reason_codes']
assert 'stale_epoch' in old_admission['reason_codes']
assert 'stale_fencing_token' in old_admission['reason_codes']

stale_c2 = load(OUT / 'delayed-old.execution-admission-result.c2.json')
assert stale_c2['decision'] == 'not_admitted'
assert 'stale_epoch' in stale_c2['reason_codes']
assert 'stale_fencing_token' in stale_c2['reason_codes']

handoff = load(OUT / 'handoff.coordination-transition-result.json')
assert handoff['decision'] == 'accepted'
assert handoff['claims']['handoff_established'] is True
assert handoff['claims']['successor_epoch_established'] is True
assert handoff['successor_lease']['epoch'] == resume['successor_lease']['epoch'] + 1
assert handoff['successor_lease']['fencing_token'] == resume['successor_lease']['fencing_token'] + 1

handoff_admission = load(OUT / 'handoff.context-admission-result.json')
assert handoff_admission['decision'] == 'context_admitted'
assert handoff_admission['claims']['context_admission_established'] is True

wrong_from = load(OUT / 'wrong-from.coordination-transition-result.json')
assert wrong_from['decision'] == 'rejected'
assert 'from_owner_mismatch' in wrong_from['reason_codes']

resume_while_active = load(OUT / 'resume-while-active.coordination-transition-result.json')
assert resume_while_active['decision'] == 'rejected'
assert 'resume_requires_paused_context' in resume_while_active['reason_codes']

stale_resume = load(OUT / 'stale-resume.coordination-transition-result.json')
assert stale_resume['decision'] == 'hold'
assert 'current_revision_reread_required' in stale_resume['reason_codes']

scope_expansion = load(OUT / 'scope-expansion.coordination-transition-result.json')
assert scope_expansion['decision'] == 'rejected'
assert 'operation_scope_change_not_permitted' in scope_expansion['reason_codes']

intent_mismatch = load(OUT / 'intent-mismatch.coordination-transition-result.json')
assert intent_mismatch['decision'] == 'rejected'
assert 'intent_mismatch' in intent_mismatch['reason_codes']

print('CCRP/C4 JSON Schema and semantic vectors validated')
