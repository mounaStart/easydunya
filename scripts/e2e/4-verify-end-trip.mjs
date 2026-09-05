#!/usr/bin/env node
/**
 * Étape 4 — Vérifier distance à Aleg et terminer le trajet si besoin.
 *
 * Usage: npm run test:e2e:verify
 */
import { formatM, tripRemainingM, fetchOsrmRoute, CITIES } from "../lib/route-math.mjs";
import {
  fetchTrip,
  loginDriver,
  readState,
  requireTripId,
  writeState,
} from "../lib/e2e-client.mjs";

const END_TRIP_RADIUS_M = 500;

async function main() {
  console.log("══════════════════════════════════════════");
  console.log(" E2E 4/4 — Vérifier arrivée Aleg / fin voyage");
  console.log("══════════════════════════════════════════\n");

  const tripId = requireTripId();
  const state = readState();
  const { supabase } = await loginDriver();

  let trip = await fetchTrip(supabase, tripId);
  if (!trip) {
    console.error("❌ Voyage introuvable");
    process.exit(1);
  }

  console.log(`Voyage: ${trip.from_name_fr} → ${trip.to_name_fr}`);
  console.log(`Statut actuel: ${trip.status}\n`);

  if (trip.status === "completed") {
    console.log("✅ TEST RÉUSSI — Voyage déjà terminé.");
    writeState({ status: "completed", step: "verified", testPassed: true });
    await supabase.auth.signOut();
    return;
  }

  if (trip.status !== "in_progress") {
    console.error(`❌ Statut inattendu: ${trip.status} (attendu: in_progress ou completed)`);
    process.exit(1);
  }

  const from = {
    lat: state.fromLat ?? trip.from_lat ?? CITIES.nouakchott.lat,
    lng: state.fromLng ?? trip.from_lng ?? CITIES.nouakchott.lng,
  };
  const to = {
    lat: state.toLat ?? trip.to_lat ?? CITIES.aleg.lat,
    lng: state.toLng ?? trip.to_lng ?? CITIES.aleg.lng,
  };
  const driver = state.lastGps
    ? { lat: state.lastGps.lat, lng: state.lastGps.lng }
    : { lat: to.lat, lng: to.lng };

  const route = await fetchOsrmRoute(from, to);
  const remainingM = tripRemainingM(route.geometry, from, to, driver);

  console.log("── Vérification distance ──");
  console.log(`   Position:  ${driver.lat}, ${driver.lng}`);
  console.log(`   Restant:   ${formatM(remainingM)}`);
  console.log(`   Seuil:     ${END_TRIP_RADIUS_M} m`);
  console.log(
    `   À Aleg?    ${remainingM <= END_TRIP_RADIUS_M ? "✅ OUI" : "❌ NON"}`
  );

  if (state.lastGpsResponse) {
    console.log("\n── Dernière réponse GPS serveur ──");
    console.log(JSON.stringify(state.lastGpsResponse, null, 2));
  }

  if (remainingM > END_TRIP_RADIUS_M) {
    console.error("\n❌ TEST ÉCHOUÉ — Encore trop loin de la destination.");
    console.error("   Relancez: npm run test:e2e:gps-aleg");
    writeState({ testPassed: false, verifyRemainingM: remainingM });
    process.exit(1);
  }

  if (trip.status === "in_progress") {
    console.log("\n⏳ Distance OK — tentative fin de voyage (driver_end_trip)…");
    const { error } = await supabase.rpc("driver_end_trip", { p_trip_id: tripId });
    if (error) {
      console.error("❌ driver_end_trip:", error.message);
      process.exit(1);
    }
    trip = await fetchTrip(supabase, tripId);
  }

  if (trip?.status === "completed") {
    console.log("\n✅ TEST RÉUSSI — Voyage terminé à Aleg.");
    writeState({
      status: "completed",
      step: "verified",
      testPassed: true,
      verifyRemainingM: remainingM,
    });
  } else {
    console.error(`\n❌ TEST ÉCHOUÉ — Statut final: ${trip?.status}`);
    writeState({ testPassed: false });
    process.exit(1);
  }

  await supabase.auth.signOut();
  console.log("");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
