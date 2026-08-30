// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "C2PASwiftRoundTripFixture",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(
            url: "https://github.com/contentauth/c2pa-swift.git",
            revision: "b43d93b7c15daca4f04d33284b821fd1330bbf88"
        )
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
