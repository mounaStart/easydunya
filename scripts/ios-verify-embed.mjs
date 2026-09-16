/** Vérifie que Xcode chargera le JS local (pas Netlify) et le build actuel. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "ios/App/App/public");
const cfgPath = path.join(root, "ios/App/App/capacitor.config.json");
const stamp = "iOS build 13";

if (!fs.existsSync(publicDir)) {
  console.error("ios/App/App/public absent. Relancez : npm run cap:ios");
  process.exit(1);
}

if (fs.existsSync(cfgPath)) {
  const cfg = fs.readFileSync(cfgPath, "utf8");
  if (cfg.includes("netlify.app") || /"url"\s*:\s*"https?:/.test(cfg)) {
    console.error("capacitor.config.json pointe encore vers un site distant (Netlify).");
    console.error("Xcode ignore alors le JS local. Relancez : npm run cap:ios");
    process.exit(1);
  }
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|html|css)$/.test(name)) out.push(p);
  }
  return out;
}

const found = walk(publicDir).some((file) => fs.readFileSync(file, "utf8").includes(stamp));
if (!found) {
  console.error(`Le dossier iOS n'a pas « ${stamp} ».`);
  console.error("git pull + npm run cap:ios n'a pas été pris. Ne lancez pas Xcode.");
  process.exit(1);
}

console.log("OK — Xcode a le JS embarqué :", stamp);
console.log("Ensuite : fermer Xcode, Product → Clean, supprimer l'app iPhone, ▶");
