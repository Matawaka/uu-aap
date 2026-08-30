#!/usr/bin/env python3
import base64
import hashlib
import json
import sys
from pathlib import Path


def build(record_path: Path, pilot_path: Path):
    record_bytes = record_path.read_bytes()
    pilot = json.loads(pilot_path.read_text(encoding="utf-8"))
    digest = hashlib.sha256(record_bytes).digest()

    artifact_bytes = b"P0.6 synthetic publication artifact fixture\n"
    external = pilot["c2pa_2_4_assertions"]["external_reference"]
    ai = pilot["c2pa_2_4_assertions"]["ai_disclosure"]
    org = pilot["publication_composition"]["publisher_org"]

    request = {
        "content": base64.b64encode(artifact_bytes).decode("ascii"),
        "mime_type": pilot["publication_composition"]["artifact_mime_type"],
        "signature_type": "both",
        "creator_name": pilot["publication_composition"]["cms_pipeline_label"],
        "org_name": org["name"],
        "org_url": org["url"],
        "extra_assertions": [
            {
                "label": ai["label"],
                "created": True,
                "data": {
                    "modelType": ai["modelType"],
                    "contentProfile": {
                        "humanOversightLevel": ai["humanOversightLevel"]
                    }
                }
            },
            {
                "label": external["label"],
                "kind": "Cbor",
                "created": False,
                "data": {
                    "location": {
                        "url": external["target"],
                        "alg": external["digest_alg"],
                        "hash": list(digest),
                        "dc:format": external["content_type"],
                        "size": len(record_bytes)
                    },
                    "description": "Hash-bound external UU-AAP publication governance record"
                }
            }
        ]
    }

    receipt = {
        "schema": "urn:uu-aap:c2pa-wordpress-signing-request-receipt:0.1",
        "upstream_endpoint": pilot["upstream"]["observed_interface"]["sign_endpoint"],
        "signature_type": "both",
        "external_record_sha256": hashlib.sha256(record_bytes).hexdigest(),
        "external_record_bytes": len(record_bytes),
        "assertion_labels": [a["label"] for a in request["extra_assertions"]],
        "live_signing_executed": False,
        "c2pa_conformance_claimed": False,
        "custom_uuaap_c2pa_namespace_registered": False
    }
    return request, receipt


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage: build-request.py EXTERNAL_RECORD PILOT REQUEST_OUT")
    record_path = Path(sys.argv[1])
    pilot_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])
    request, receipt = build(record_path, pilot_path)
    output_path.write_text(json.dumps(request, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
