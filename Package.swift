// swift-tools-version:6.2
import PackageDescription

let package = Package(
    name: "bill",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "BillAI", targets: ["BillAI"]),
        .library(name: "Bill", targets: ["Bill"]),
        .library(name: "BillGitHub", targets: ["BillGitHub"]),
        .library(name: "BillDiscord", targets: ["BillDiscord"]),
        .library(name: "BillServer", targets: ["BillServer"]),
        .executable(name: "bill", targets: ["BillExample"]),
    ],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.115.0"),
        .package(url: "https://github.com/vapor/postgres-nio.git", from: "1.33.0"),
        .package(url: "https://github.com/swift-server/async-http-client.git", from: "1.37.0"),
        .package(url: "https://github.com/DiscordBM/DiscordBM.git", from: "1.16.2"),
        .package(url: "https://github.com/apple/swift-crypto.git", "3.0.0"..<"5.0.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.6.0"),
    ],
    targets: [
        .target(
            name: "BillAI",
            dependencies: [
                .product(name: "AsyncHTTPClient", package: "async-http-client"),
                .product(name: "Logging", package: "swift-log"),
            ]
        ),
        .target(
            name: "Bill",
            dependencies: [
                "BillAI",
                .product(name: "AsyncHTTPClient", package: "async-http-client"),
                .product(name: "Crypto", package: "swift-crypto"),
                .product(name: "PostgresNIO", package: "postgres-nio"),
            ]
        ),
        .target(
            name: "BillGitHub",
            dependencies: [
                "Bill",
                .product(name: "AsyncHTTPClient", package: "async-http-client"),
                .product(name: "_CryptoExtras", package: "swift-crypto"),
            ]
        ),
        .target(name: "BillDiscord", dependencies: ["Bill", .product(name: "DiscordBM", package: "DiscordBM")]),
        .target(name: "BillServer", dependencies: ["Bill", .product(name: "Vapor", package: "vapor")]),
        .executableTarget(
            name: "BillExample",
            dependencies: ["Bill", "BillGitHub", "BillDiscord", "BillServer", .product(name: "Vapor", package: "vapor")]
        ),
        .testTarget(name: "BillTests", dependencies: ["Bill", "BillGitHub", "BillDiscord", "BillServer", .product(name: "Vapor", package: "vapor")]),
    ]
)
