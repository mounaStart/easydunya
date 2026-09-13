/**
 * Capacitor 8.5 plugins (App, Push, Geolocation, StatusBar) ne compilent
 * pas sous Xcode 15.2 / macOS 13. On ne garde que le runtime Capacitor.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "ios/App/CapApp-SPM/Package.swift");

const minimal = `// swift-tools-version: 5.9
import PackageDescription

// Minimal iOS deps for Xcode 15.2 (macOS 13). Full plugins need Xcode 16.
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.2")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ]
        )
    ]
)
`;

if (!fs.existsSync(pkgPath)) {
  console.warn("ios-xcode15: Package.swift introuvable, ignoré");
  process.exit(0);
}

fs.writeFileSync(pkgPath, minimal);
console.log("ios-xcode15: Package.swift minimal (sans plugins) pour Xcode 15.2");
