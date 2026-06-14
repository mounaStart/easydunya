// =====================================================================
// Génère une paire de clés VAPID (Web Push) sans aucune dépendance.
// Usage :  node scripts/generate-vapid.mjs
//
// - VAPID_PUBLIC_KEY  -> .env (VITE_VAPID_PUBLIC_KEY) + secret Edge Function
// - VAPID_PRIVATE_KEY -> secret Edge Function uniquement (NE PAS exposer)
// =====================================================================
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });

const x = Buffer.from(pub.x, "base64url");
const y = Buffer.from(pub.y, "base64url");
const publicKeyB64 = Buffer.concat([Buffer.from([0x04]), x, y]).toString(
  "base64url"
);
const privateKeyB64 = Buffer.from(priv.d, "base64url").toString("base64url");

console.log("\n=== Clés VAPID Easy Dunya ===\n");
console.log("VAPID_PUBLIC_KEY  =", publicKeyB64);
console.log("VAPID_PRIVATE_KEY =", privateKeyB64);
console.log("\nÀ configurer :");
console.log("  .env                -> VITE_VAPID_PUBLIC_KEY=<clé publique>");
console.log("  supabase secrets    -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
console.log("");
