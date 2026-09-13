/** Échoue si les clés VITE_* manquent (build IPA embarqué). */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const url = (process.env.VITE_SUPABASE_URL ?? "").trim();
const key = (process.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const ok =
  url.startsWith("http") &&
  key.length >= 20 &&
  !key.includes("COLLEZ") &&
  !key.includes("missing") &&
  !url.includes("localhost");

if (!ok) {
  console.error(
    "Clés Supabase manquantes. Créez .env avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY\n" +
      "(Netlify → Environment variables, ou Supabase → Settings → API)."
  );
  process.exit(1);
}
console.log("VITE_SUPABASE_* OK →", url);
