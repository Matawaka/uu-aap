#!/usr/bin/env bash
set -euo pipefail

rm -rf /tmp/uu-aap-c2pa-swift /tmp/uu-aap-c2pa-android /tmp/uu-aap-swift-pr.json

git clone -q https://github.com/contentauth/c2pa-swift.git /tmp/uu-aap-c2pa-swift
curl -fsSL https://api.github.com/repos/contentauth/c2pa-swift/pulls/161 -o /tmp/uu-aap-swift-pr.json

SWIFT_PR_STATE="$(python - <<'PY'
import json
print(json.load(open('/tmp/uu-aap-swift-pr.json'))['state'])
PY
)"
SWIFT_PR_HEAD="$(python - <<'PY'
import json
print(json.load(open('/tmp/uu-aap-swift-pr.json'))['head']['sha'])
PY
)"
SWIFT_MAIN_SHA="$(git -C /tmp/uu-aap-c2pa-swift rev-parse HEAD)"

git -C /tmp/uu-aap-c2pa-swift fetch -q origin "$SWIFT_PR_HEAD"
git -C /tmp/uu-aap-c2pa-swift checkout -q "$SWIFT_PR_HEAD"

swift_candidate_package=/tmp/uu-aap-c2pa-swift/Package.swift
swift_candidate_claim=/tmp/uu-aap-c2pa-swift/Library/Sources/Manifest/ClaimGeneratorInfo.swift
swift_candidate_reader=/tmp/uu-aap-c2pa-swift/Library/Sources/Reader.swift

SWIFT_CANDIDATE_RELEASE="$(grep -oE 'releases/download/v[0-9.]+/C2PAC\.xcframework\.zip' "$swift_candidate_package" | head -n1 | sed -E 's#releases/download/(v[0-9.]+)/.*#\1#')"
if grep -q 'c2pa_reader_crjson' "$swift_candidate_reader"; then SWIFT_CANDIDATE_CRJSON=true; else SWIFT_CANDIDATE_CRJSON=false; fi
if grep -q 'additionalFields' "$swift_candidate_claim"; then SWIFT_CANDIDATE_ADDITIONAL=true; else SWIFT_CANDIDATE_ADDITIONAL=false; fi

git -C /tmp/uu-aap-c2pa-swift checkout -q "$SWIFT_MAIN_SHA"
swift_main_package=/tmp/uu-aap-c2pa-swift/Package.swift
swift_main_claim=/tmp/uu-aap-c2pa-swift/Library/Sources/Manifest/ClaimGeneratorInfo.swift
SWIFT_MAIN_RELEASE="$(grep -oE 'releases/download/v[0-9.]+/C2PAC\.xcframework\.zip' "$swift_main_package" | head -n1 | sed -E 's#releases/download/(v[0-9.]+)/.*#\1#')"
if grep -q 'additionalFields' "$swift_main_claim"; then SWIFT_MAIN_ADDITIONAL=true; else SWIFT_MAIN_ADDITIONAL=false; fi

git clone -q https://github.com/contentauth/c2pa-android.git /tmp/uu-aap-c2pa-android
ANDROID_MAIN_SHA="$(git -C /tmp/uu-aap-c2pa-android rev-parse HEAD)"
android_json=/tmp/uu-aap-c2pa-android/library/src/main/kotlin/org/contentauth/c2pa/C2PAJson.kt
android_claim=/tmp/uu-aap-c2pa-android/library/src/main/kotlin/org/contentauth/c2pa/manifest/ClaimGeneratorInfo.kt
android_assertion=/tmp/uu-aap-c2pa-android/library/src/main/kotlin/org/contentauth/c2pa/manifest/AssertionDefinition.kt
if grep -q 'ignoreUnknownKeys = true' "$android_json"; then ANDROID_IGNORE_UNKNOWN=true; else ANDROID_IGNORE_UNKNOWN=false; fi
if grep -q 'additionalFields' "$android_claim"; then ANDROID_ADDITIONAL=true; else ANDROID_ADDITIONAL=false; fi
if grep -q 'data class Custom' "$android_assertion"; then ANDROID_CUSTOM=true; else ANDROID_CUSTOM=false; fi

export SWIFT_PR_STATE SWIFT_PR_HEAD SWIFT_MAIN_SHA SWIFT_CANDIDATE_RELEASE SWIFT_CANDIDATE_CRJSON SWIFT_CANDIDATE_ADDITIONAL SWIFT_MAIN_RELEASE SWIFT_MAIN_ADDITIONAL
export ANDROID_MAIN_SHA ANDROID_IGNORE_UNKNOWN ANDROID_ADDITIONAL ANDROID_CUSTOM

python - <<'PY'
import json, os

def b(name):
    return os.environ[name].lower() == 'true'

obs = {
    'schema': 'urn:uu-aap:c2pa-sdk-current-observation:0.2',
    'observation_source': 'public_github_read_only',
    'swift': {
        'available': True,
        'pr_state': os.environ['SWIFT_PR_STATE'],
        'pr_head_sha': os.environ['SWIFT_PR_HEAD'],
        'main_sha': os.environ['SWIFT_MAIN_SHA'],
        'candidate_public_binary_release': os.environ['SWIFT_CANDIDATE_RELEASE'],
        'candidate_reader_crjson_present': b('SWIFT_CANDIDATE_CRJSON'),
        'candidate_claim_generator_additional_fields_present': b('SWIFT_CANDIDATE_ADDITIONAL'),
        'main_public_binary_release': os.environ['SWIFT_MAIN_RELEASE'],
        'main_claim_generator_additional_fields_present': b('SWIFT_MAIN_ADDITIONAL'),
    },
    'android': {
        'available': True,
        'main_sha': os.environ['ANDROID_MAIN_SHA'],
        'ignore_unknown_keys': b('ANDROID_IGNORE_UNKNOWN'),
        'claim_generator_additional_fields_present': b('ANDROID_ADDITIONAL'),
        'assertion_definition_custom_present': b('ANDROID_CUSTOM'),
    },
}
print(json.dumps(obs, indent=2, sort_keys=True))
PY
