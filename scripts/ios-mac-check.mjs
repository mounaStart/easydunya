/** À lancer sur le Mac : node scripts/ios-mac-check.mjs */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const run = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  } catch (e) {
    return String(e.stdout || e.stderr || e.message).trim();
  }
};

console.log("=== dossier ===");
console.log(root);
console.log("=== git ===");
console.log(run("git rev-parse --abbrev-ref HEAD"));
console.log(run("git log -1 --oneline"));
console.log("=== Layout.tsx (doit être VIDE) ===");
const layout = fs.readFileSync(path.join(root, "src/components/Layout.tsx"), "utf8");
console.log(
  layout.includes("Profil introuvable")
    ? "ANCIEN CODE — git pull n'a pas marché"
    : "OK : plus d'écran Profil introuvable dans le source"
);
console.log("=== .env ===");
console.log(fs.existsSync(path.join(root, ".env")) ? "présent" : "ABSENT");
const cfg = path.join(root, "ios/App/App/capacitor.config.json");
console.log("=== capacitor.config.json ===");
if (fs.existsSync(cfg)) {
  const txt = fs.readFileSync(cfg, "utf8");
  console.log(txt);
  console.log(
    txt.includes("netlify") ? "ERREUR : charge encore Netlify" : "OK : pas de Netlify"
  );
} else {
  console.log("absent (pas encore de cap sync)");
}
const pub = path.join(root, "ios/App/App/public");
console.log("=== ios/App/App/public ===");
if (!fs.existsSync(pub)) {
  console.log("ABSENT — npm run cap:ios n'a jamais copié le site");
} else {
  const files = [];
  const walk = (d) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|css|txt)$/.test(n)) files.push(p);
    }
  };
  walk(pub);
  const blob = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  console.log("Profil introuvable dans public :", blob.includes("Profil introuvable") ? "OUI = ANCIEN JS" : "non");
  console.log("iOS build 21 dans public :", blob.includes("iOS build 21") ? "OUI = BON JS" : "NON");
}
