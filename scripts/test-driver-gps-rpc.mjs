#!/usr/bin/env node
/**
 * Test RPC Supabase driver_update_gps avec positions simulées.
 * Nécessite un voyage EN COURS créé manuellement (ou via SQL).
 *
 * Variables (.env ou export):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   TEST_DRIVER_PHONE      ex. 22246123456
 *   TEST_DRIVER_PASSWORD   ex. 46123456ED
 *   TEST_TRIP_ID           uuid du voyage in_progress
 *
 * Usage:
 *   npm run test:gps-rpc
 *
 * Le script envoie 5 positions le long de Nouakchott→Aleg
 * et affiche la réponse JSON (completed / distance).
 */
import { createClient } from "@supabase/supabase-js";
import {
  CITIES,
  fetchOsrmRoute,
  formatM,
  loadDotEnv,
  pointAtProgress,
  tripRemainingM,
} from "./lib/route-math.mjs";

loadDotEnv();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const phone = process.env.TEST_DRIVER_PHONE;
const password = process.env.TEST_DRIVER_PASSWORD;
const tripId = process.env.TEST_TRIP_ID;

function phoneToEmail(raw) {
  const digits = String(raw).replace(/\D/g, "").replace(/^222/, "");
  return `${digits}@phone.easydunya.app`;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" Test RPC driver_update_gps (Supabase prod/staging)");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!url || !anonKey) {
    console.error("❌ VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requis dans .env");
    process.exit(1);
  }
  if (!phone || !password || !tripId) {
    console.error("❌ Variables requises dans .env:");
    console.error("   TEST_DRIVER_PHONE=...");
    console.error("   TEST_DRIVER_PASSWORD=...");
    console.error("   TEST_TRIP_ID=uuid-voyage-en-cours");
    console.error("\nCréez d'abord un voyage, démarrez-le (in_progress), copiez son id.");
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  console.log("Connexion chauffeur…");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });
  if (authErr) {
    console.error("❌ Connexion:", authErr.message);
    process.exit(1);
  }
  console.log(`✓ Connecté: ${auth.user?.id}\n`);

  const from = CITIES.nouakchott;
  const to = CITIES.aleg;
  const route = await fetchOsrmRoute(from, to);

  const progressPoints = [0.5, 0.85, 0.95, 0.99, 1.0];

  for (const p of progressPoints) {
    const driver = pointAtProgress(route.geometry, p);
    const remaining = tripRemainingM(route.geometry, from, to, driver);

    console.log(`\n── Position ${Math.round(p * 100)} % — restant ${formatM(remaining)} ──`);

    const { data, error } = await supabase.rpc("driver_update_gps", {
      p_trip_id: tripId,
      p_lat: driver.lat,
      p_lng: driver.lng,
      p_route_remaining_m: remaining,
    });

    if (error) {
      console.error("❌ RPC:", error.message);
      if (error.message.includes("function") && error.message.includes("does not exist")) {
        console.error("   → Appliquez la migration 0037 sur Supabase.");
      }
      continue;
    }

    console.log("   Réponse:", JSON.stringify(data, null, 2));

    if (data?.completed) {
      console.log("\n✅ Voyage terminé automatiquement par le serveur !");
      break;
    }
  }

  await supabase.auth.signOut();
  console.log("\nDéconnexion.\n");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
