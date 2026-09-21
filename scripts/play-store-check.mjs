/** Contrôle Play Store : suppression de compte, privacy, manifeste Android. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exitCode = 1;
};
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

if (!exists("src/pages/LegalDoc.tsx") || !exists("src/content/privacyV1.ts")) {
  fail("Page politique de confidentialité manquante");
}
const app = read("src/App.tsx");
if (!app.includes('path="confidentialite"') || !app.includes('path="cgu"')) {
  fail("Routes /confidentialite et /cgu manquantes");
}

const profile = read("src/pages/passenger/Profile.tsx");
if (!profile.includes("deleteOwnAccount") || !profile.includes("deleteAccount")) {
  fail("Profil : suppression de compte manquante (politique User Data Play)");
}
if (!exists("supabase/functions/delete-own-account/index.ts")) {
  fail("Edge function delete-own-account manquante");
}

const manifest = read("android/app/src/main/AndroidManifest.xml");
if (manifest.includes('android:allowBackup="true"')) {
  fail("Android : allowBackup=true (données de compte dans la sauvegarde Google)");
}
if (!manifest.includes("AD_ID") || !manifest.includes('tools:node="remove"')) {
  fail("Android : retirer AD_ID du manifeste fusionné (pas de pub)");
}
if (manifest.includes("ACCESS_BACKGROUND_LOCATION")) {
  fail("Android : pas de localisation en arrière-plan");
}
if (manifest.includes("READ_MEDIA") || manifest.includes("READ_EXTERNAL_STORAGE") || manifest.includes("CAMERA")) {
  fail("Android : permission photo/stockage/caméra non utilisée");
}
if (!manifest.includes("usesCleartextTraffic") || manifest.includes('usesCleartextTraffic="true"')) {
  fail("Android : HTTPS only (cleartext interdit)");
}

const paths = read("android/app/src/main/res/xml/file_paths.xml");
if (paths.includes("external-path") && paths.includes('path="."')) {
  fail("FileProvider : ne pas exposer tout le stockage externe");
}

const gradle = read("android/app/build.gradle");
if (!gradle.includes("applicationId \"app.easydunya\"")) {
  fail("applicationId doit rester app.easydunya");
}

const login = read("src/pages/Login.tsx");
if (/iOS build \d+|ED \d+|réserver admin/.test(login)) {
  fail("Login contient un tampon de debug");
}

const assetlinks = read("public/assetlinks.json");
if (assetlinks.includes("neon_trifle") || assetlinks.includes("app.netlify")) {
  fail("assetlinks.json pointe encore vers le package TWA PWABuilder");
}

if (process.exitCode) {
  console.error("Contrôle Play Store : échec");
  process.exit(process.exitCode);
}
console.log("OK — contrôles Play Store locaux (compte, privacy, manifeste, pas de debug)");
