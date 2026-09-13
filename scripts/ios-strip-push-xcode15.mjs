/**
 * Capacitor 8.5 + plugin Push ne compile pas sous Xcode 15.2 (macOS 13).
 * On retire PushNotifications du Package.swift iOS après `cap sync`.
 * Les notifs iOS reviendront avec Xcode 16 (macOS 14.5+).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "ios/App/CapApp-SPM/Package.swift");

if (!fs.existsSync(pkgPath)) {
  console.warn("ios-strip-push: Package.swift introuvable, ignoré");
  process.exit(0);
}

const before = fs.readFileSync(pkgPath, "utf8");
const after = before
  .replace(
    /\n\s*\.package\(name: "CapacitorPushNotifications", path: "[^"]+"\),?/g,
    ""
  )
  .replace(
    /\n\s*\.product\(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"\),?/g,
    ""
  );

if (after === before) {
  console.log("ios-strip-push: rien à retirer (déjà absent ou format inconnu)");
} else {
  fs.writeFileSync(pkgPath, after);
  console.log("ios-strip-push: plugin Push retiré de Package.swift (Xcode 15.2)");
}
