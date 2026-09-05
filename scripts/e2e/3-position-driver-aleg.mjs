#!/usr/bin/env node
/**
 * Étape 3 — Placer le chauffeur à Aleg (GPS simulé).
 *
 * Usage: npm run test:e2e:gps-aleg
 */
import {
  CITIES,
  fetchOsrmRoute,
  formatM,
  tripRemainingM,
} from "../lib/route-math.mjs";
import {
  loginDriver,
  readState,
  requireTripId,
  writeState,
} from "../lib/e2e-client.mjs";

const END_TRIP_RADIUS_M = 500;

async function main() {
  console.log("══════════════════════════════════════════");
  console.log(" E2E 3/4 — Position chauffeur à Aleg");
  console.log("══════════════════════════════════════════\n");

  const tripId = requireTripId();
  const state = readState();
  const { supabase } = await loginDriver();

  const from = {
    lat: state.fromLat ?? CITIES.nouakchott.lat,
    lng: state.fromLng ?? CITIES.nouakchott.lng,
  };
  const to = {
    lat: state.toLat ?? CITIES.aleg.lat,
    lng: state.toLng ?? CITIES.aleg.lng,
  };

  // Position: centre-ville Aleg (coords BDD = arrivée simulée)
  const driver = { lat: to.lat, lng: to.lng };

  console.log("⏳ Calcul itinéraire + distance restante…");
  const route = await fetchOsrmRoute(from, to);
  const remainingM = tripRemainingM(route.geometry, from, to, driver);

  console.log(`\n📍 Position simulée: ${driver.lat}, ${driver.lng} (Aleg)`);
  console.log(`   Distance restante: ${formatM(remainingM)}`);
  console.log(`   Seuil fin voyage:  ${END_TRIP_RADIUS_M} m`);
  console.log(
    `   Peut terminer?      ${remainingM <= END_TRIP_RADIUS_M ? "✅ OUI" : "❌ NON"}`
  );

  console.log("\n⏳ Envoi GPS au serveur (driver_update_gps)…");
  const { data, error } = await supabase.rpc("driver_update_gps", {
    p_trip_id: tripId,
    p_lat: driver.lat,
    p_lng: driver.lng,
    p_route_remaining_m: remainingM,
  });

  if (error) {
    console.error("❌ RPC:", error.message);
    if (error.message.includes("does not exist")) {
      console.error("   → Appliquez migrations 0036 + 0037 sur Supabase.");
    }
    process.exit(1);
  }

  writeState({
    step: "gps_aleg",
    lastGps: { lat: driver.lat, lng: driver.lng, remainingM },
    lastGpsResponse: data,
  });

  console.log("\n✅ GPS enregistré");
  console.log("   Réponse serveur:", JSON.stringify(data, null, 2));

  if (data?.completed) {
    console.log("\n🎉 Le serveur a terminé le voyage automatiquement !");
    writeState({ status: "completed", step: "auto_completed" });
  } else {
    console.log("\n➡️  Prochaine étape: npm run test:e2e:verify\n");
  }

  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
