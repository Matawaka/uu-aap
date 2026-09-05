// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "C2PASwiftUpstreamMergeReaudit",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(
            url: "https://github.com/contentauth/c2pa-swift.git",
            revision: "6fa8a78c16abac3b3f7eb4832c2cc943c9c19f0f"
        ),
        .package(url: "https://github.com/apple/swift-certificates.git", exact: "1.19.4"),
        .package(url: "https://github.com/apple/swift-asn1.git", exact: "1.7.1"),
        .package(url: "https://github.com/apple/swift-crypto.git", exact: "4.5.1")
    ],
    targets: [
        .executableTarget(
            name: "RoundTripFixture",
            dependencies: [
                .product(name: "C2PA", package: "c2pa-swift")
            ]
        )
    ]
)
