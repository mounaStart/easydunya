/** Contrôle App Store : bannières debug, nom, privacy, suppression de compte. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exitCode = 1;
};

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const login = read("src/pages/Login.tsx");
if (/iOS build \d+|ED \d+|réserver admin/.test(login)) {
  fail("Login.tsx contient encore un tampon de debug visible");
}

const plist = read("ios/App/App/Info.plist");
if (!plist.includes("<string>Easy Dunya</string>")) {
  fail("Info.plist : CFBundleDisplayName doit être Easy Dunya");
}
if (plist.includes("ED 22") || /<string>ED \d+<\/string>/.test(plist)) {
  fail("Info.plist : nom interne de debug encore présent");
}
if (plist.includes("NSLocationAlwaysAndWhenInUseUsageDescription")) {
  fail("Info.plist : retirer Always — l'app ne demande que WhenInUse");
}
if (plist.includes("UIBackgroundModes")) {
  fail("Info.plist : pas de background mode pour la 1re soumission (pas de push / pas de GPS fond)");
}
if (!plist.includes("ITSAppUsesNonExemptEncryption")) {
  fail("Info.plist : ITSAppUsesNonExemptEncryption manquant");
}

if (!exists("ios/App/App/PrivacyInfo.xcprivacy")) {
  fail("PrivacyInfo.xcprivacy manquant");
} else {
  const privacy = read("ios/App/App/PrivacyInfo.xcprivacy");
  if (!privacy.includes("NSPrivacyTracking") || privacy.includes("<true/>\n	<key>NSPrivacyTracking")) {
    /* tracking must be false — checked below */
  }
  if (!privacy.includes("<key>NSPrivacyTracking</key>") || !privacy.includes("<false/>")) {
    fail("PrivacyInfo : NSPrivacyTracking doit être false");
  }
  if (!privacy.includes("NSPrivacyCollectedDataTypePreciseLocation")) {
    fail("PrivacyInfo : déclarer la localisation précise");
  }
}

const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
if (!pbx.includes("PrivacyInfo.xcprivacy")) {
  fail("project.pbxproj : PrivacyInfo.xcprivacy n'est pas dans la cible");
}
if (!pbx.includes("MARKETING_VERSION = 1.1.0")) {
  fail("Version marketing attendue : 1.1.0");
}

const profile = read("src/pages/passenger/Profile.tsx");
if (!profile.includes("deleteOwnAccount") || !profile.includes("deleteAccount")) {
  fail("Profil : bouton de suppression de compte manquant (guideline 5.1.1v)");
}

if (!exists("supabase/functions/delete-own-account/index.ts")) {
  fail("Edge function delete-own-account manquante");
}

const entitlements = read("ios/App/App/App.entitlements");
if (entitlements.includes("aps-environment") || entitlements.includes("com.apple.developer.aps")) {
  fail("Entitlements : ne pas déclarer Push tant que la capacité n'est pas prête");
}

if (process.exitCode) {
  console.error("Contrôle App Store : échec");
  process.exit(process.exitCode);
}
console.log("OK — contrôles App Store locaux (bannières, nom, privacy, suppression de compte)");
