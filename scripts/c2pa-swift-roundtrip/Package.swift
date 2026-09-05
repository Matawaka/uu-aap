// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "C2PASwiftRoundTripFixture",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(
            url: "https://github.com/contentauth/c2pa-swift.git",
            revision: "b43d93b7c15daca4f04d33284b821fd1330bbf88"
        ),
        // Match the lower bounds declared by the pinned c2pa-swift frontier so the
        // fixture does not drift when later compatible dependency versions appear.
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
