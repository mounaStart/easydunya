#!/usr/bin/env node
/**
 * Test distance restante + fin de voyage (sans conduire).
 *
 * Usage:
 *   npm run test:route
 *   npm run test:route -- --google     (avec Google via Supabase, lit .env)
 *   npm run test:route -- --from=rosso --to=aleg
 *
 * Simule des positions le long de l'itinéraire et compare:
 *   - ancienne méthode: distance routière chauffeur → centre-ville
 *   - nouvelle méthode: distance restante le long de l'itinéraire
 */
import {
  CITIES,
  fetchGoogleRoute,
  fetchOsrmRoute,
  formatM,
  loadDotEnv,
  pointAtProgress,
  pointDistanceM,
  tripRemainingM,
} from "./lib/route-math.mjs";

const END_TRIP_RADIUS_M = 500;
const useGoogle = process.argv.includes("--google");

function argCity(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const key = hit.split("=")[1]?.toLowerCase();
  return CITIES[key] ?? fallback;
}

async function directRouteRemainingM(driver, dest, fetchDirect) {
  try {
    const route = await fetchDirect(driver, dest);
    return route.distanceM;
  } catch {
    return null;
  }
}

function printRow(label, driver, dest, geometry, directRemainingM) {
  const newM = tripRemainingM(geometry, null, dest, driver);
  const straightM = pointDistanceM(driver, dest);
  const canEndOld = directRemainingM != null && directRemainingM <= END_TRIP_RADIUS_M;
  const canEndNew = newM <= END_TRIP_RADIUS_M;
  console.log(`\n📍 ${label}`);
  console.log(`   GPS: ${driver.lat.toFixed(5)}, ${driver.lng.toFixed(5)}`);
  console.log(`   Vol d'oiseau → ville: ${formatM(straightM)}`);
  console.log(
    `   Ancienne (route GPS→ville): ${directRemainingM != null ? formatM(directRemainingM) : "—"}`
  );
  console.log(`   Nouvelle (le long trajet):  ${formatM(newM)}`);
  console.log(
    `   Terminer voyage? ancienne=${canEndOld ? "✅ OUI" : "❌ NON"}  nouvelle=${canEndNew ? "✅ OUI" : "❌ NON"}`
  );
}

async function main() {
  loadDotEnv();

  const from = argCity("from", CITIES.nouakchott);
  const to = argCity("to", CITIES.aleg);

  console.log("═══════════════════════════════════════════════════════");
  console.log(" Easy Dunya — test distance / fin de voyage (simulation)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Trajet: ${from.name} → ${to.name}`);
  console.log(`Seuil fin voyage: ${END_TRIP_RADIUS_M} m`);

  let route;
  if (useGoogle) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error("\n❌ --google nécessite VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env");
      process.exit(1);
    }
    console.log("\n⏳ Itinéraire Google Directions (via Supabase)…");
    route = await fetchGoogleRoute(from, to, url, key);
  } else {
    console.log("\n⏳ Itinéraire OSRM (OpenStreetMap, sans clé Google)…");
    route = await fetchOsrmRoute(from, to);
  }

  console.log(
    `✓ ${route.provider.toUpperCase()} — ${formatM(route.distanceM)} (${Math.round(route.durationS / 60)} min)`
  );
  console.log(`  Points sur la route: ${route.geometry.length}`);

  const fetchDirect = useGoogle
    ? (a, b) => fetchGoogleRoute(a, b, process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
    : (a, b) => fetchOsrmRoute(a, b);

  const scenarios = [
    { label: "Départ (0 %)", progress: 0 },
    { label: "Mi-parcours (50 %)", progress: 0.5 },
    { label: "Proche arrivée (95 %)", progress: 0.95 },
    { label: "Fin de route (100 %)", progress: 1 },
    { label: "Centre-ville (coords BDD)", point: { lat: to.lat, lng: to.lng } },
    {
      label: "Centre-ville + 200 m (simulation GPS)",
      point: { lat: to.lat + 0.0018, lng: to.lng + 0.0018 },
    },
  ];

  for (const s of scenarios) {
    const driver = s.point ?? pointAtProgress(route.geometry, s.progress);
    const directM = await directRouteRemainingM(driver, to, fetchDirect);
    printRow(s.label, driver, to, route.geometry, directM);
  }

  console.log("\n───────────────────────────────────────────────────────");
  console.log("Résumé: à l'arrivée, la NOUVELLE méthode doit afficher ≤ 500 m");
  console.log("        et permettre « Terminer le voyage ».");
  console.log("───────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n❌ Erreur:", err.message);
  process.exit(1);
});
