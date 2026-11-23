// SPDX-License-Identifier: Apache-2.0
// Public test inputs only. Package/target identity is attached by the outer runner.
import Foundation
import C2PA

struct ProbeError: Error { let message: String }
func object(_ d: Data) throws -> [String: Any] {
    guard let v = try JSONSerialization.jsonObject(with: d) as? [String: Any] else {
        throw ProbeError(message: "expected JSON object")
    }
    return v
}
func bytes(_ o: Any) throws -> Data {
    try JSONSerialization.data(withJSONObject: o, options: [.sortedKeys])
}
func equal(_ a: Any, _ b: Any) throws -> Bool { try bytes(a) == bytes(b) }
func write(_ o: Any, _ name: String, _ dir: URL) throws {
    try bytes(o).write(to: dir.appendingPathComponent(name))
}
func read(_ name: String, _ dir: URL) throws -> Data { try Data(contentsOf: dir.appendingPathComponent(name)) }
func normalizedPayload(_ input: [String: Any]) -> [String: Any] {
    var out = input
    if var loc = out["location"] as? [String: Any], let hash = loc["hash"] as? String,
       let data = Data(base64Encoded: hash) {
        loc["hash"] = Array(data); out["location"] = loc
    }
    return out
}
let argv = CommandLine.arguments
if argv.count != 3 { fputs("usage: PreservationProbe FIXTURE_DIR OUTPUT_DIR\n", stderr); exit(2) }
let fixture = URL(fileURLWithPath: argv[1]), output = URL(fileURLWithPath: argv[2])
let decoder = JSONDecoder(), encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
var result: [String: Any] = ["schema": "urn:uu-aap:swift-public-consumer-probe:0.1"]
let unknown = "org.example.uu_aap_reference"

// Historical Codable fixtures: this layer does not sign or read an asset.
do {
    let data = try read("claim-generator-info.json", fixture)
    let before = try object(data), model = try decoder.decode(ClaimGeneratorInfo.self, from: data)
    let afterData = try encoder.encode(model), after = try object(afterData)
    try afterData.write(to: output.appendingPathComponent("codec-claim-output.json"))
    var inspectable = false
    if let field = model.additionalFields?[unknown], let expected = before[unknown] {
        let seen = try JSONSerialization.jsonObject(with: encoder.encode(field))
        inspectable = try equal(expected, seen)
    }
    var preserved = false
    if let x = before[unknown], let y = after[unknown] { preserved = try equal(x, y) }
    let forbidden = ["authority", "responsibility", "trust", "trusted", "author", "publication_authorization"]
    let noPromotion = !forbidden.contains { before[$0] == nil && after[$0] != nil }
    result["codec_claim"] = ["status": inspectable && preserved && noPromotion ? "PASS" : "LOSSY",
        "unknown_inspectable": inspectable, "unknown_preserved": preserved, "no_promotion": noPromotion]
} catch { result["codec_claim"] = ["status": "ERROR", "detail": String(describing: error)] }
do {
    let data = try read("external-reference.json", fixture), before = try object(data)
    let model = try decoder.decode(AssertionDefinition.self, from: data)
    let afterData = try encoder.encode(model), after = try object(afterData)
    try afterData.write(to: output.appendingPathComponent("codec-assertion-output.json"))
    var generic = false
    if case .custom(let label, let payload) = model, label == "c2pa.external-reference", let expected = before["data"] {
        generic = try equal(expected, JSONSerialization.jsonObject(with: encoder.encode(payload)))
    }
    let preserved = try equal(before, after)
    result["codec_assertion"] = ["status": generic && preserved ? "PASS" : "LOSSY",
        "generic_payload_preserved": generic]
} catch { result["codec_assertion"] = ["status": "ERROR", "detail": String(describing: error)] }

// Separate native signing fixture: valid hash length; encoded through public models.
var native: [String: Any] = ["status": "NOT_EXECUTED", "stage": "prepare", "signed": false,
    "reader_json_called": false, "reader_crjson_called": false,
    "claim_preserved": false, "assertion_preserved": false, "signature_validated": false]
do {
    let claimInput = try read("claim-generator-info.json", fixture)
    let assertionInput = try read("native-external-reference.json", fixture)
    let claim = try decoder.decode(ClaimGeneratorInfo.self, from: claimInput)
    let assertion = try decoder.decode(AssertionDefinition.self, from: assertionInput)
    let claimObject = try object(encoder.encode(claim)), assertionObject = try object(encoder.encode(assertion))
    let actions: [String: Any] = ["label": "c2pa.actions.v2", "data": ["actions": [[
        "action": "c2pa.created", "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture"]]]]
    let manifest: [String: Any] = ["claim_generator_info": [claimObject], "title": "UU-AAP synthetic PNG",
        "format": "image/png", "assertions": [actions, assertionObject]]
    try write(manifest, "native-manifest-input.json", output)
    native["stage"] = "sign"
    func sign() throws {
        let builder = try Builder(manifestJSON: String(decoding: bytes(manifest), as: UTF8.self))
        let signer = try Signer(certsPEM: String(decoding: read("certs.pem", fixture), as: UTF8.self),
            privateKeyPEM: String(decoding: read("private.key", fixture), as: UTF8.self), algorithm: .es256, tsa: nil)
        let source = try Stream(readFrom: fixture.appendingPathComponent("source.png"))
        let dest = try Stream(writeTo: output.appendingPathComponent("signed.png"))
        _ = try builder.sign(format: "image/png", source: source, destination: dest, signer: signer)
    }
    try sign(); native["signed"] = true; native["stage"] = "read"
    let stream = try Stream(readFrom: output.appendingPathComponent("signed.png"))
    let reader = try Reader(format: "image/png", stream: stream)
    native["reader_json_called"] = true
    let json = try reader.json()
    try Data(json.utf8).write(to: output.appendingPathComponent("native-reader.json"))
    let report = try object(Data(json.utf8))
    guard let active = report["active_manifest"] as? String,
        let manifests = report["manifests"] as? [String: Any], let current = manifests[active] as? [String: Any] else {
        throw ProbeError(message: "active manifest missing from native Reader JSON")
    }
    let expectedClaim = try object(claimInput)[unknown]
    let actualClaims = current["claim_generator_info"] as? [[String: Any]] ?? []
    let matchingClaims = actualClaims.filter { $0["name"] as? String == claimObject["name"] as? String }
    if matchingClaims.count == 1, let actual = matchingClaims[0][unknown], let expected = expectedClaim {
        native["claim_preserved"] = try equal(expected, actual)
    }
    let list = current["assertions"] as? [[String: Any]] ?? []
    let matches = list.filter { $0["label"] as? String == "c2pa.external-reference" }
    if matches.count == 1, let actual = matches[0]["data"] as? [String: Any],
       let expected = try object(assertionInput)["data"] as? [String: Any] {
        native["assertion_preserved"] = try equal(normalizedPayload(expected), normalizedPayload(actual))
    }
    let validation = report["validation_results"] as? [String: Any] ?? [:]
    let activeResult = validation["activeManifest"] as? [String: Any] ?? [:]
    let success = (activeResult["success"] as? [[String: Any]] ?? []).compactMap { $0["code"] as? String }.sorted()
    let failures = (activeResult["failure"] as? [[String: Any]] ?? []).compactMap { $0["code"] as? String }.sorted()
    native["signature_validated"] = success.contains("claimSignature.validated")
    native["validation_success_codes"] = success
    native["validation_failure_codes"] = failures
    native["reader_crjson_called"] = true
    let crjson = try reader.crJSON()
    try Data(crjson.utf8).write(to: output.appendingPathComponent("native-reader-crjson.json"))
    _ = try JSONSerialization.jsonObject(with: Data(crjson.utf8), options: [.fragmentsAllowed])
    native["crjson_parsed"] = true
    native["stage"] = "complete"
    native["status"] = (native["claim_preserved"] as? Bool == true && native["assertion_preserved"] as? Bool == true) ? "PASS" : "LOSSY"
} catch { native["status"] = "ERROR"; native["detail"] = String(describing: error) }
result["native"] = native
result["claims"] = ["cross_sdk_compatibility": false, "c2pa_conformance": false,
    "trusted_signer": false, "truth": false, "authority": false, "external_review": false]
do { try write(result, "probe.json", output) }
catch { fputs("probe receipt write failed: \(error)\n", stderr); exit(1) }
