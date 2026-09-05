import Foundation
import C2PA

enum FixtureFailure: Error, CustomStringConvertible {
    case message(String)

    var description: String {
        switch self {
        case .message(let text): return text
        }
    }
}

func loadJSON(_ path: String) throws -> Data {
    guard FileManager.default.fileExists(atPath: path) else {
        throw FixtureFailure.message("fixture not found: \(path)")
    }
    return try Data(contentsOf: URL(fileURLWithPath: path))
}

func jsonObject(_ data: Data) throws -> Any {
    try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
}

func canonicalJSON(_ object: Any) throws -> Data {
    guard JSONSerialization.isValidJSONObject(object) else {
        throw FixtureFailure.message("object is not valid JSON")
    }
    return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
}

func jsonEqual(_ lhs: Any, _ rhs: Any) throws -> Bool {
    try canonicalJSON(lhs) == canonicalJSON(rhs)
}

func objectDictionary(_ value: Any, context: String) throws -> [String: Any] {
    guard let dictionary = value as? [String: Any] else {
        throw FixtureFailure.message("\(context) is not a JSON object")
    }
    return dictionary
}

let args = CommandLine.arguments
if args.count != 3 {
    FileHandle.standardError.write(Data("usage: RoundTripFixture <claim-generator-info.json> <external-reference.json>\n".utf8))
    exit(2)
}

let decoder = JSONDecoder()
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]

do {
    // 1. Unknown-field preservation in an open Swift model changed by upstream PR #161.
    let claimInputData = try loadJSON(args[1])
    let claimInputObject = try objectDictionary(try jsonObject(claimInputData), context: "claim input")
    let claim = try decoder.decode(ClaimGeneratorInfo.self, from: claimInputData)

    guard let additionalFields = claim.additionalFields else {
        throw FixtureFailure.message("ClaimGeneratorInfo lost all unknown fields during decode")
    }
    guard let unknownReference = additionalFields["org.example.uu_aap_reference"] else {
        throw FixtureFailure.message("expected unknown UU-AAP reference field was not inspectable after decode")
    }

    let inspectedUnknownData = try JSONEncoder().encode(unknownReference)
    let inspectedUnknownObject = try jsonObject(inspectedUnknownData)
    guard let originalUnknownObject = claimInputObject["org.example.uu_aap_reference"] else {
        throw FixtureFailure.message("claim input is missing expected unknown reference field")
    }
    guard try jsonEqual(originalUnknownObject, inspectedUnknownObject) else {
        throw FixtureFailure.message("unknown reference changed while exposed through additionalFields")
    }

    let claimOutputData = try encoder.encode(claim)
    let claimOutputObject = try objectDictionary(try jsonObject(claimOutputData), context: "claim output")
    guard let roundTrippedUnknownObject = claimOutputObject["org.example.uu_aap_reference"] else {
        throw FixtureFailure.message("unknown UU-AAP reference field disappeared during encode")
    }
    guard try jsonEqual(originalUnknownObject, roundTrippedUnknownObject) else {
        throw FixtureFailure.message("unknown UU-AAP reference field changed across decode/encode")
    }

    // Known model fields may be canonically encoded, but no new authority/trust key is allowed to appear.
    let forbiddenPromotions = ["authority", "responsibility", "trust", "trusted", "author", "publication_authorization"]
    for key in forbiddenPromotions where claimOutputObject[key] != nil && claimInputObject[key] == nil {
        throw FixtureFailure.message("unknown extension was promoted into top-level governance/trust key: \(key)")
    }

    // 2. Preserve the complete standard C2PA external-reference payload.
    // At the pinned Swift frontier the label is not modeled as a dedicated enum case, so the SDK must
    // retain it through the generic custom assertion + AnyCodable path rather than silently dropping data.
    let assertionInputData = try loadJSON(args[2])
    let assertionInputObject = try jsonObject(assertionInputData)
    let assertion = try decoder.decode(AssertionDefinition.self, from: assertionInputData)

    switch assertion {
    case .custom(let label, let data):
        guard label == "c2pa.external-reference" else {
            throw FixtureFailure.message("unexpected custom assertion label: \(label)")
        }
        let payloadData = try JSONEncoder().encode(data)
        let payloadObject = try jsonObject(payloadData)
        let assertionInputDictionary = try objectDictionary(assertionInputObject, context: "external-reference input")
        guard let expectedPayload = assertionInputDictionary["data"] else {
            throw FixtureFailure.message("external-reference fixture missing data")
        }
        guard try jsonEqual(expectedPayload, payloadObject) else {
            throw FixtureFailure.message("external-reference payload changed during decode/inspection")
        }
    default:
        throw FixtureFailure.message("external-reference did not remain a lossless generic assertion at pinned Swift frontier")
    }

    let assertionOutputData = try encoder.encode(assertion)
    let assertionOutputObject = try jsonObject(assertionOutputData)
    guard try jsonEqual(assertionInputObject, assertionOutputObject) else {
        throw FixtureFailure.message("external-reference assertion changed across decode/encode")
    }

    let receipt: [String: Any] = [
        "schema": "urn:uu-aap:c2pa-swift-roundtrip-receipt:0.1",
        "upstream_repository": "contentauth/c2pa-swift",
        "upstream_pr": 161,
        "upstream_head_sha": "b43d93b7c15daca4f04d33284b821fd1330bbf88",
        "upstream_base_sha": "7f337301de08a3d35a07abbf36ccc5f490e8b391",
        "evaluation_frontier_kind": "pinned-candidate-commit",
        "external_reference_label": "c2pa.external-reference",
        "assertion_payload_semantic_roundtrip": true,
        "claim_generator_unknown_field_inspectable": true,
        "claim_generator_unknown_field_semantic_roundtrip": true,
        "unknown_field_promoted_to_authority_or_trust": false,
        "byte_equivalence_required": false,
        "semantic_equivalence_required": true,
        "p0_3_complete": false,
        "conclusion": "Pinned c2pa-swift PR #161 candidate preserves both the generic C2PA external-reference payload and an unknown nested ClaimGeneratorInfo extension without authority/trust promotion."
    ]

    let receiptData = try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(receiptData)
    FileHandle.standardOutput.write(Data("\n".utf8))
} catch {
    FileHandle.standardError.write(Data("C2PA Swift round-trip fixture FAILED: \(error)\n".utf8))
    exit(1)
}
